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
      .select("id, user_id, photo_url, thumb_url, medium_url, original_url")
      .in("id", photoIds)
      .eq("user_id", user.id);

    if (rowsError) throw rowsError;

    const results: ResultItem[] = [];

    for (const row of rows ?? []) {
      try {
        // If already has all URLs, just sign and return
        if (row.thumb_url && row.medium_url) {
          const [thumbSigned, mediumSigned] = await Promise.all([
            supabaseAdmin.storage.from("user-photos").createSignedUrl(row.thumb_url, 60 * 60 * 24 * 30),
            supabaseAdmin.storage.from("user-photos").createSignedUrl(row.medium_url, 60 * 60 * 24 * 30),
          ]);

          results.push({
            id: row.id,
            thumbnailUrl: thumbSigned.data?.signedUrl || "",
            mediumUrl: mediumSigned.data?.signedUrl || "",
          });
          continue;
        }

        // Need to generate derivatives
        const sourcePath = row.original_url || row.photo_url;
        const baseFileName = sourcePath.replace(/(_thumb|_original)?\.[^.]+$/i, "");

        const thumbPath = `${baseFileName}_thumb.jpg`;
        const mediumPath = `${baseFileName}_medium.jpg`;
        const originalPath = row.original_url || `${baseFileName}_original.jpg`;

        // Download source
        const { data: downloaded, error: dlError } = await supabaseAdmin.storage
          .from("user-photos")
          .download(sourcePath);
        if (dlError) {
          log("Download failed", { id: row.id, path: sourcePath, err: dlError.message });
          continue;
        }

        const buf = new Uint8Array(await downloaded.arrayBuffer());
        const img = await Image.decode(buf);

        log("Processing image", { id: row.id, width: img.width, height: img.height });

        // Generate medium (1200px, quality 80)
        const medium = img.width > 1200 ? img.resize(1200, Image.RESIZE_AUTO) : img.clone();
        const mediumBytes = await medium.encodeJPEG(80);

        // Generate thumb (400px, quality 65 for <150KB target)
        const thumb = img.width > 400 ? img.resize(400, Image.RESIZE_AUTO) : img.clone();
        const thumbBytes = await thumb.encodeJPEG(65);

        log("Generated derivatives", {
          id: row.id,
          mediumSize: `${Math.round(mediumBytes.byteLength / 1024)}KB`,
          thumbSize: `${Math.round(thumbBytes.byteLength / 1024)}KB`,
        });

        // Upload all derivatives
        await Promise.all([
          supabaseAdmin.storage.from("user-photos").upload(thumbPath, thumbBytes, {
            upsert: true,
            contentType: "image/jpeg",
            cacheControl: "public, max-age=31536000, immutable",
          }),
          supabaseAdmin.storage.from("user-photos").upload(mediumPath, mediumBytes, {
            upsert: true,
            contentType: "image/jpeg",
            cacheControl: "public, max-age=31536000, immutable",
          }),
        ]);

        // If source was the original photo_url, keep it as original
        if (!row.original_url && sourcePath === row.photo_url) {
          // Move/copy original to _original path if needed
          const { error: copyError } = await supabaseAdmin.storage
            .from("user-photos")
            .copy(sourcePath, originalPath);
          
          if (copyError && !copyError.message.includes("already exists")) {
            log("Copy to original failed (may already exist)", { id: row.id, err: copyError.message });
          }
        }

        // Update database with explicit paths
        await supabaseAdmin
          .from("user_photos")
          .update({
            thumb_url: thumbPath,
            medium_url: mediumPath,
            original_url: row.original_url || originalPath,
            photo_url: mediumPath, // Keep legacy field pointing to medium
          })
          .eq("id", row.id)
          .eq("user_id", user.id);

        // Generate signed URLs
        const [thumbSigned, mediumSigned] = await Promise.all([
          supabaseAdmin.storage.from("user-photos").createSignedUrl(thumbPath, 60 * 60 * 24 * 30),
          supabaseAdmin.storage.from("user-photos").createSignedUrl(mediumPath, 60 * 60 * 24 * 30),
        ]);

        results.push({
          id: row.id,
          thumbnailUrl: thumbSigned.data?.signedUrl || "",
          mediumUrl: mediumSigned.data?.signedUrl || "",
        });
      } catch (photoError) {
        log("Error processing photo", { id: row.id, error: String(photoError) });
        continue;
      }
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
