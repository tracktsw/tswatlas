import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Safe helper to convert Stripe Unix timestamp (seconds) to ISO string
const toIsoFromStripeSeconds = (value: unknown): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  try {
    return new Date(value * 1000).toISOString();
  } catch {
    return null;
  }
};

// Check RevenueCat subscription status
const checkRevenueCat = async (userId: string): Promise<{ subscribed: boolean; subscription_end: string | null }> => {
  const rcSecretKey = Deno.env.get("REVENUECAT_SECRET_KEY");
  
  if (!rcSecretKey) {
    logStep("RevenueCat secret key not configured, skipping");
    return { subscribed: false, subscription_end: null };
  }

  try {
    logStep("Checking RevenueCat subscription", { userId });
    
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${rcSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      logStep("RevenueCat API error", { status: response.status });
      return { subscribed: false, subscription_end: null };
    }

    const data = await response.json();
    logStep("RevenueCat response received", { 
      hasSubscriber: !!data.subscriber,
      entitlements: Object.keys(data.subscriber?.entitlements || {})
    });

    // Check for "premium" entitlement
    const premiumEntitlement = data.subscriber?.entitlements?.premium;
    
    if (premiumEntitlement?.is_active) {
      logStep("RevenueCat premium entitlement active", { 
        expires_date: premiumEntitlement.expires_date 
      });
      return {
        subscribed: true,
        subscription_end: premiumEntitlement.expires_date || null,
      };
    }

    logStep("No active RevenueCat premium entitlement");
    return { subscribed: false, subscription_end: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("RevenueCat check error", { error: errorMessage });
    return { subscribed: false, subscription_end: null };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is admin first (admin = automatic premium)
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleData) {
      logStep("User is admin, granting premium access");
      return new Response(JSON.stringify({
        subscribed: true,
        isAdmin: true,
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check RevenueCat subscription first (for iOS IAP users)
    const revenueCatResult = await checkRevenueCat(user.id);
    if (revenueCatResult.subscribed) {
      logStep("User has active RevenueCat subscription");
      return new Response(JSON.stringify({
        subscribed: true,
        isAdmin: false,
        subscription_end: revenueCatResult.subscription_end,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check Stripe subscription (for web users)
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        isAdmin: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active OR trialing subscriptions (trialing = free trial period)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });
    
    // Filter for active or trialing status
    const validSubscriptions = subscriptions.data.filter(
      (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
    );

    const hasActiveSub = validSubscriptions.length > 0;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = validSubscriptions[0];
      
      // Log raw values for debugging
      logStep("Raw subscription data", { 
        current_period_end: subscription.current_period_end,
        current_period_end_type: typeof subscription.current_period_end,
        item_period_end: subscription.items?.data?.[0]?.current_period_end,
      });
      
      // Try primary field first, fallback to item-level period end
      subscriptionEnd = toIsoFromStripeSeconds(subscription.current_period_end) 
        ?? toIsoFromStripeSeconds(subscription.items?.data?.[0]?.current_period_end);
      
      logStep("Active Stripe subscription found", { 
        subscriptionId: subscription.id, 
        endDate: subscriptionEnd 
      });
    } else {
      logStep("No active Stripe subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      isAdmin: false,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
