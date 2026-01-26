import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `You're a friendly companion helping someone track their skin healing journey.

You can see their check-in data: skin ratings, mood, sleep, symptoms, treatments, triggers, and food diary.

## Keep it simple
- Talk like a friend, not a doctor or robot.
- Short sentences. Plain words.
- If something's unclear in the data, just say so.

## What you do
- Spot patterns in their data.
- Point out what might be helping.
- Notice connections (like sleep affecting skin, or foods correlating with flares).
- Celebrate small wins.

## What you don't do
- Give medical advice.
- Tell them what treatments to use.
- Make promises about healing.
- Make up patterns that aren't there.

## Examples of how to talk
- "Your skin's been a bit better this week — nice to see."
- "Looks like you tend to feel worse after nights with poor sleep."
- "You've been using salt baths regularly. On those days, your skin ratings are slightly higher."
- "I noticed you logged dairy a few times before flare days — might be worth keeping an eye on."
- "Not enough data yet to spot a clear pattern, but worth watching."

## Food Diary
- Users track foods in a separate "Food Diary" section (not as triggers).
- When discussing foods, refer to them as "food diary" entries, not triggers.
- Look for correlations between foods logged and skin/symptom changes.

CRITICAL: When mentioning treatments, triggers, symptoms, or foods from the data, always convert them to normal readable English:
- "salt_bath" → "salt baths"
- "ice_pack" → "ice packs"  
- "dead_sea_salt" → "Dead Sea salt"
- "new_product" → "new product"
- "red_light_therapy" → "red light therapy"
- Food items from food diary: refer to them naturally (e.g., "dairy", "gluten", "eggs")
- "new_product:CeraVe" → "CeraVe (new product)"

Never show underscores or raw data formats to the user.`;

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

    // Build comprehensive context from user data
    let userContext = "\n\n--- USER DATA FOR ANALYSIS ---\n";
    
    if (userData) {
      // Data quality summary
      userContext += `\n## DATA QUALITY\n`;
      userContext += `- Total check-ins: ${userData.dataQuality?.totalCheckIns || 0}\n`;
      userContext += `- Unique days logged: ${userData.dataQuality?.uniqueDaysLogged || 0}\n`;
      userContext += `- Current streak: ${userData.dataQuality?.checkInStreak || 0} days\n`;
      userContext += `- Has enough data for analysis: ${userData.dataQuality?.hasEnoughData ? 'Yes' : 'No'}\n`;
      userContext += `- Assessment: ${userData.dataQuality?.dataMessage || 'No assessment'}\n`;
      
      if (userData.dataQuality?.missingDaysLast7?.length > 0) {
        userContext += `- Missing days (last 7): ${userData.dataQuality.missingDaysLast7.join(', ')}\n`;
      }

      // TSW duration
      if (userData.tswDuration) {
        userContext += `\n## TSW JOURNEY\n- Duration: ${userData.tswDuration}\n`;
      }

      // Last 7 days detailed
      userContext += `\n## LAST 7 DAYS ANALYSIS\n`;
      userContext += `- Check-ins: ${userData.last7Days?.checkIns?.length || 0}\n`;
      userContext += `- Average mood: ${userData.last7Days?.avgMood || 'N/A'}/5\n`;
      userContext += `- Average skin rating: ${userData.last7Days?.avgSkin || 'N/A'}/5\n`;
      userContext += `- Average sleep quality: ${userData.last7Days?.avgSleep !== null ? userData.last7Days.avgSleep + '/5' : 'No sleep data'}\n`;
      
      if (userData.last7Days?.symptomsSummary?.length > 0) {
        userContext += `\n### Symptoms (Last 7 Days):\n`;
        userData.last7Days.symptomsSummary.forEach((s: any) => {
          userContext += `- ${s.symptom}: logged ${s.daysLogged} days, avg severity ${s.avgSeverity}/3, trend: ${s.severityTrend}\n`;
        });
      } else {
        userContext += `\n### Symptoms: No symptoms logged in last 7 days\n`;
      }

      if (userData.last7Days?.treatmentsUsed?.length > 0) {
        userContext += `\n### Treatments (Last 7 Days):\n`;
        userData.last7Days.treatmentsUsed.forEach((t: any) => {
          userContext += `- ${t.treatment}: used ${t.count} times\n`;
        });
      }

      // Raw check-in data for detailed analysis
      if (userData.last7Days?.checkIns?.length > 0) {
        userContext += `\n### Daily Check-in Details:\n`;
        userData.last7Days.checkIns.forEach((c: any) => {
          const symptoms = c.symptoms?.length > 0 
            ? c.symptoms.map((s: any) => `${s.symptom}(sev:${s.severity})`).join(', ')
            : 'none';
          const sleepStr = c.sleepScore ? `, sleep ${c.sleepScore}/5` : '';
          userContext += `- ${c.date} ${c.timeOfDay}: mood ${c.mood}/5, skin ${c.skinFeeling}/5${sleepStr}, symptoms: ${symptoms}, treatments: ${c.treatments?.join(', ') || 'none'}${c.notes ? `, notes: "${c.notes}"` : ''}\n`;
        });
      }

      // Last 30 days summary
      userContext += `\n## LAST 30 DAYS SUMMARY\n`;
      userContext += `- Total check-ins: ${userData.last30Days?.checkInsCount || 0}\n`;
      userContext += `- Average mood: ${userData.last30Days?.avgMood || 'N/A'}/5\n`;
      userContext += `- Average skin rating: ${userData.last30Days?.avgSkin || 'N/A'}/5\n`;
      userContext += `- Average sleep quality: ${userData.last30Days?.avgSleep !== null ? userData.last30Days.avgSleep + '/5' : 'No sleep data'}\n`;
      
      // Sleep analysis
      if (userData.last30Days?.sleepAnalysis) {
        const sa = userData.last30Days.sleepAnalysis;
        userContext += `\n### Sleep Analysis:\n`;
        userContext += `- Sleep entries: ${sa.entriesCount}\n`;
        userContext += `- Average sleep score: ${sa.avgScore}/5\n`;
        userContext += `- Sleep trend: ${sa.trend}\n`;
        userContext += `- Poor sleep days (1-2): ${sa.lowSleepDays}\n`;
        userContext += `- Good sleep days (4-5): ${sa.goodSleepDays}\n`;
      }

      if (userData.last30Days?.symptomsSummary?.length > 0) {
        userContext += `\n### Symptoms (Last 30 Days):\n`;
        userData.last30Days.symptomsSummary.forEach((s: any) => {
          const treatmentCorr = s.correlatedTreatments?.length > 0 
            ? ` [often with: ${s.correlatedTreatments.map((t: any) => `${t.treatment}(${t.coOccurrence}x)`).join(', ')}]`
            : '';
          userContext += `- ${s.symptom}: ${s.daysLogged} days, avg severity ${s.avgSeverity}/3, trend: ${s.severityTrend}${treatmentCorr}\n`;
        });
      }

      if (userData.last30Days?.treatmentsUsed?.length > 0) {
        userContext += `\n### Treatments (Last 30 Days):\n`;
        userData.last30Days.treatmentsUsed.forEach((t: any) => {
          userContext += `- ${t.treatment}: ${t.count} uses, avg skin when used: ${t.avgSkinWhenUsed}/5\n`;
        });
      }

      // Trends and patterns
      userContext += `\n## IDENTIFIED PATTERNS\n`;
      userContext += `- Mood trend: ${userData.trends?.moodTrend || 'unknown'}\n`;
      userContext += `- Skin trend: ${userData.trends?.skinTrend || 'unknown'}\n`;
      userContext += `- Sleep trend: ${userData.trends?.sleepTrend || 'insufficient data'}\n`;

      if (userData.trends?.sleepObservations?.length > 0) {
        userContext += `\n### Sleep Observations:\n`;
        userData.trends.sleepObservations.forEach((obs: string) => {
          userContext += `- ${obs}\n`;
        });
      }

      if (userData.trends?.symptomPatterns?.length > 0) {
        userContext += `\n### Symptom Patterns:\n`;
        userData.trends.symptomPatterns.forEach((p: any) => {
          userContext += `- ${p.pattern}\n`;
        });
      }

      if (userData.trends?.treatmentCorrelations?.length > 0) {
        userContext += `\n### Treatment Observations:\n`;
        userData.trends.treatmentCorrelations.forEach((c: any) => {
          userContext += `- ${c.observation}\n`;
        });
      }

      // Additional context
      userContext += `\n## ADDITIONAL CONTEXT\n`;
      userContext += `- Photos uploaded: ${userData.photoCount || 0}\n`;
      userContext += `- Journal entries: ${userData.journalCount || 0}\n`;
    } else {
      userContext += "No user data available. Ask the user to log some check-ins first.\n";
    }

    userContext += "\n--- END USER DATA ---\n";

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
