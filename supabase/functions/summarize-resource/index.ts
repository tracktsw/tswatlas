import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { resourceId, url } = await req.json();
    console.log("Summarizing resource:", { resourceId, url });

    if (!resourceId || !url) {
      return new Response(
        JSON.stringify({ error: "resourceId and url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the webpage content using Firecrawl-like approach or simple fetch
    let pageContent = "";
    let pageTitle = "";
    
    try {
      console.log("Fetching page content from:", url);
      const pageResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TSWAtlas/1.0; Educational Resource Summarizer)",
        },
      });
      
      if (!pageResponse.ok) {
        throw new Error(`Failed to fetch page: ${pageResponse.status}`);
      }
      
      const html = await pageResponse.text();
      
      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      pageTitle = titleMatch ? titleMatch[1].trim() : "";
      
      // Remove scripts, styles, and extract text content
      const cleanedHtml = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      
      // Take first ~8000 chars for context
      pageContent = cleanedHtml.slice(0, 8000);
      console.log("Extracted content length:", pageContent.length);
      
    } catch (fetchError) {
      console.error("Failed to fetch page content:", fetchError);
      // Update resource with unavailable status
      await supabase
        .from("resources")
        .update({ 
          summary_status: "unavailable",
          ai_summary: null 
        })
        .eq("id", resourceId);
      
      return new Response(
        JSON.stringify({ success: true, status: "unavailable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if content seems paywalled or restricted
    const restrictedIndicators = [
      "subscribe to continue",
      "sign in to read",
      "members only",
      "premium content",
      "paywall",
      "access denied",
      "403 forbidden",
      "login required"
    ];
    
    const lowerContent = pageContent.toLowerCase();
    const isRestricted = restrictedIndicators.some(indicator => 
      lowerContent.includes(indicator)
    );
    
    if (isRestricted || pageContent.length < 200) {
      console.log("Content appears restricted or too short");
      await supabase
        .from("resources")
        .update({ 
          summary_status: "unavailable",
          ai_summary: null,
          custom_title: pageTitle || null
        })
        .eq("id", resourceId);
      
      return new Response(
        JSON.stringify({ success: true, status: "unavailable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate AI summary using Lovable AI
    console.log("Generating AI summary...");
    const systemPrompt = `You are a medical content summarizer for a Topical Steroid Withdrawal (TSW) information app.

Create a factual, scannable summary of the webpage content.

FORMAT (choose ONE):
- 2-3 short paragraphs, OR
- 4-6 bullet points starting with •

CONTENT REQUIREMENTS:
1. What the resource is about (1-2 sentences max)
2. Key concepts or topics covered
3. Scope or limitations mentioned (if any)

STRICT RULES:
- NO filler phrases ("this article provides", "the author explains", "this resource offers")
- NO medical advice, treatment recommendations, dosing, or instructions
- NO certainty language ("will cure", "guarantees", "proven to")
- Plain, direct language only
- If content is unclear or unsuitable, respond with exactly: "SUMMARY_UNAVAILABLE"

EXAMPLE OUTPUT (bullet format):
• Defines TSW as a condition occurring after discontinuing topical corticosteroids.
• Covers common symptoms including skin redness, burning, and flaking.
• Discusses typical timeline patterns reported by those experiencing withdrawal.
• Notes that research on this condition is still emerging.

EXAMPLE OUTPUT (paragraph format):
TSW refers to a set of symptoms some people experience after stopping topical steroid use. Common signs include widespread skin redness, intense itching, and temperature sensitivity.

The resource outlines various phases that may occur during withdrawal and notes individual experiences vary significantly. Limited clinical research exists on this topic.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please summarize this webpage about TSW:\n\nTitle: ${pageTitle}\n\nContent:\n${pageContent}` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const summary = aiData.choices?.[0]?.message?.content?.trim();
    console.log("AI summary generated:", summary?.slice(0, 100));

    // Check if AI couldn't summarize
    if (!summary || summary === "SUMMARY_UNAVAILABLE" || summary.includes("SUMMARY_UNAVAILABLE")) {
      await supabase
        .from("resources")
        .update({ 
          summary_status: "unavailable",
          ai_summary: null,
          custom_title: pageTitle || null
        })
        .eq("id", resourceId);
      
      return new Response(
        JSON.stringify({ success: true, status: "unavailable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update resource with summary
    await supabase
      .from("resources")
      .update({ 
        ai_summary: summary,
        summary_status: "completed",
        custom_title: pageTitle || null
      })
      .eq("id", resourceId);

    console.log("Resource updated successfully");
    return new Response(
      JSON.stringify({ success: true, status: "completed", summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in summarize-resource:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
