import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ReqBody = {
  photoIds: string[];
};

type ResultItem = {
  id: string;
  thumbnailUrl: string;
  mediumUrl: string;
};

const deriveBasePath = (path: string) => {
  // Remove extension and any legacy suffixes
  return path.replace(/(_thumb|_original)?\.[^.]+$/i, "");
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PHOTO-DERIVATIVES] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      throw new Error("Missing backend environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");

    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const body = (await req.json()) as ReqBody;
    const photoIds = Array.isArray(body?.photoIds) ? body.photoIds : [];
    if (photoIds.length === 0) {
      return new Response(JSON.stringify({ results: [] satisfies ResultItem[] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    log("Start", { count: photoIds.length, userId: user.id });

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("user_photos")
      .select("id, user_id, photo_url")
      .in("id", photoIds)
      .eq("user_id", user.id);

    if (rowsError) throw rowsError;

    const results: ResultItem[] = [];

    for (const row of rows ?? []) {
      const originalPath = row.photo_url as string;
      const base = deriveBasePath(originalPath);

      // NOTE: ImageScript v1.2.x supports JPEG/PNG encoding (not WebP).
      // We generate *small* JPEG derivatives to guarantee the grid never loads multi-MB originals.
      const mediumPath = `${base}.jpg`;
      const thumbPath = `${base}_thumb.jpg`;

      // Download source (could be legacy large jpg or already a smaller derivative)
      const { data: downloaded, error: dlError } = await supabaseAdmin.storage
        .from("user-photos")
        .download(originalPath);
      if (dlError) {
        log("Download failed", { id: row.id, path: originalPath, err: dlError.message });
        continue;
      }

      const buf = new Uint8Array(await downloaded.arrayBuffer());
      const img = await Image.decode(buf);

      // Medium (~1200px wide)
      const medium = img.width > 1200 ? img.resize(1200, Image.RESIZE_AUTO) : img;
      const mediumBytes = await medium.encodeJPEG(80);

      // Thumb (400px wide)
      const thumb = img.width > 400 ? img.resize(400, Image.RESIZE_AUTO) : img;
      const thumbBytes = await thumb.encodeJPEG(70);

      // Upload (upsert) with long cache
      await supabaseAdmin.storage.from("user-photos").upload(mediumPath, mediumBytes, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: "31536000",
      });

      await supabaseAdmin.storage.from("user-photos").upload(thumbPath, thumbBytes, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: "31536000",
      });

      // Update DB to point to the medium webp (so fullscreen/compare never uses legacy originals)
      if (originalPath !== mediumPath) {
        await supabaseAdmin
          .from("user_photos")
          .update({ photo_url: mediumPath })
          .eq("id", row.id)
          .eq("user_id", user.id);
      }

      const [mediumSigned, thumbSigned] = await Promise.all([
        supabaseAdmin.storage.from("user-photos").createSignedUrl(mediumPath, 60 * 60 * 24 * 30),
        supabaseAdmin.storage.from("user-photos").createSignedUrl(thumbPath, 60 * 60 * 24 * 30),
      ]);

      results.push({
        id: row.id,
        mediumUrl: mediumSigned.data?.signedUrl || "",
        thumbnailUrl: thumbSigned.data?.signedUrl || "",
      });
    }

    log("Done", { results: results.length });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[PHOTO-DERIVATIVES] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
