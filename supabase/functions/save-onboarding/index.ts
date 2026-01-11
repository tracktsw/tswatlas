import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingData {
  tswDuration: string | null;
  goal: string | null;
  initialSeverity: number | null;
  firstLog: {
    skin: number;
    sleep: number;
    pain: number;
    mood: number;
    triggers: string;
  } | null;
}

interface RequestBody {
  onboardingData: OnboardingData;
  onboardingVersion?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[save-onboarding] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { onboardingData, onboardingVersion = '1.0' } = body;

    if (!onboardingData) {
      return new Response(
        JSON.stringify({ error: 'Missing onboarding data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[save-onboarding] Saving for user:', user.id, 'version:', onboardingVersion);

    // Upsert onboarding response (idempotent - one per user per version)
    const { data, error } = await supabase
      .from('onboarding_responses')
      .upsert(
        {
          user_id: user.id,
          onboarding_version: onboardingVersion,
          tsw_duration: onboardingData.tswDuration,
          goal: onboardingData.goal,
          initial_severity: onboardingData.initialSeverity,
          first_log: onboardingData.firstLog,
        },
        {
          onConflict: 'user_id,onboarding_version',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[save-onboarding] Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save onboarding responses', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[save-onboarding] Successfully saved onboarding response:', data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Onboarding responses saved successfully',
        id: data.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[save-onboarding] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});