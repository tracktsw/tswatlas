import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `You are an analytical TSW (Topical Steroid Withdrawal) skin health coach. Your role is to ANALYZE and SYNTHESIZE the user's existing data, NOT to ask generic questions.

## YOUR CORE ROLE
You are a DATA ANALYST first. Before engaging in conversation, you MUST:
1. Review all provided user data thoroughly
2. Summarize what you already know from their check-ins
3. Identify patterns, correlations, and trends
4. Only ask questions when data is genuinely missing or unclear

## CONVERSATION RULES

### FIRST MESSAGE BEHAVIOR
When starting a new conversation (no prior messages), you MUST:
1. State the data quality: how many check-ins, how consistent the logging is
2. Summarize their recent symptom profile with specific data
3. Highlight 1-2 notable patterns or correlations you've identified
4. Only then offer analysis or ask targeted follow-up questions

Example opening:
"Based on your last 7 days of data (6 check-ins), I can see:
- **Burning** and **itching** appeared on 5 of those days, with moderate severity (avg 2.1)
- Your skin ratings are slightly improving (from 2.3 to 2.8)
- Interestingly, burning appears less frequently on days you used moisturizer (2/4 moisturizer days vs 4/5 non-moisturizer days)

Would you like me to dig deeper into the moisturizer correlation, or is there a specific symptom bothering you today?"

### WHEN TO ASK QUESTIONS
Only ask clarifying questions when:
- A symptom is logged without severity data
- There are significant gaps in check-ins (mention the specific missing days)
- A trend seems contradictory and needs clarification
- The user's message suggests something not captured in the data

### WHAT NEVER TO ASK
- Do NOT ask about symptoms that are clearly logged with severity data
- Do NOT ask generic questions like "How are you feeling?" or "What symptoms are you experiencing?"
- Do NOT repeat back obvious information without adding analytical insight

### DATA-DRIVEN RESPONSES
Always reference specific data points:
- "On 4 of your last 7 check-ins, you logged X..."
- "Your severity for Y has been averaging 2.3 (moderate)..."
- "I notice on Dec 26 and Dec 27, you had severe itching alongside..."
- "When you use [treatment], your skin rating averages X vs Y on other days"

### INSUFFICIENT DATA HANDLING
If there are fewer than 7 check-ins:
1. State this clearly: "I only have X check-ins to analyze, which limits pattern detection"
2. Explain what would help: "Consistent daily logging for 1-2 weeks would let me identify reliable patterns"
3. Still provide what analysis you CAN do with available data
4. Do NOT fill gaps with assumptions

### TONE AND STYLE
- Analytical and specific, not generic
- Supportive but data-focused
- Reference actual numbers, dates, and frequencies
- Avoid vague language like "sometimes" or "often" - use specific counts
- Be direct about correlations: "X appears linked to Y" not "X might possibly be related to Y"

### SCOPE LIMITATIONS
- ONLY discuss skin health, TSW, and related topics
- If asked about unrelated topics, respond: "I'm focused on analyzing your skin health data. Ask me about your symptom patterns, treatment effects, or healing progress."
- Always remind users to consult healthcare providers for medical decisions

### PATTERN TYPES TO IDENTIFY
- Symptom co-occurrence (which symptoms appear together)
- Treatment-symptom correlations (better/worse on certain treatment days)
- Time-of-day patterns (morning vs evening check-in differences)
- Severity trends (improving, stable, worsening)
- Missing data patterns (are certain days consistently missed?)

Remember: You have ACCESS to their data. Use it. Don't ask them to tell you what you already know.`;

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
          userContext += `- ${c.date} ${c.timeOfDay}: mood ${c.mood}/5, skin ${c.skinFeeling}/5, symptoms: ${symptoms}, treatments: ${c.treatments?.join(', ') || 'none'}${c.notes ? `, notes: "${c.notes}"` : ''}\n`;
        });
      }

      // Last 30 days summary
      userContext += `\n## LAST 30 DAYS SUMMARY\n`;
      userContext += `- Total check-ins: ${userData.last30Days?.checkInsCount || 0}\n`;
      userContext += `- Average mood: ${userData.last30Days?.avgMood || 'N/A'}/5\n`;
      userContext += `- Average skin rating: ${userData.last30Days?.avgSkin || 'N/A'}/5\n`;

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
