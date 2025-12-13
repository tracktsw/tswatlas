import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `You are a TSW (Topical Steroid Withdrawal) skin health coach. You ONLY discuss skin-related topics.

SCOPE RULES:
- If the question is about skin, TSW symptoms, skincare routines, oozing, flaking, redness, itching, healing, moisturizers, treatments, skin comfort, or related topics: provide helpful, actionable advice.
- If the question is NOT about skin or TSW: politely respond with "I'm focused on skin health only. Feel free to ask me about managing TSW symptoms, skincare routines, or tracking your healing progress!"

WHEN GIVING SKIN ADVICE:
- Be direct and actionable: "To help with oozing: 1) Keep the area clean and dry, 2) Use breathable cotton clothing, 3) Try zinc oxide cream as a barrier, 4) Avoid scratching - pat gently instead"
- Share practical tips from TSW community experience
- Suggest specific approaches: "Many find that X helps with Y"
- Reference the user's data when relevant: "Based on your check-ins, moisturizer days showed better skin ratings"
- Be encouraging but honest about the TSW journey

COMMON TSW TOPICS TO ADDRESS:
- Oozing: drying techniques, barrier creams, wound care
- Flaking: gentle exfoliation, hydration balance
- Itching: cooling methods, distraction techniques, antihistamines
- Sleep: positioning, cooling, fabric choices
- Moisturizer withdrawal (MW) vs traditional moisturizing
- Trigger identification from their data
- Treatment correlations from their check-ins

IMPORTANT: Remind users that while you provide practical tips from TSW community experience, they should consult their healthcare provider for medical decisions.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from user data
    let userContext = "";
    if (userData) {
      userContext = `\n\nUser's TSW Data Summary:\n${JSON.stringify(userData, null, 2)}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + userContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI Coach error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
