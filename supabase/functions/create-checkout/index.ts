import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  logStep("========== CREATE-CHECKOUT FUNCTION TRIGGERED ==========");
  logStep("Method", { method: req.method });
  logStep("Origin", { origin: req.headers.get("origin") });

  if (req.method === "OPTIONS") {
    logStep("Handling CORS preflight");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR - STRIPE_SECRET_KEY is not set");
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    logStep("Stripe key verified", { keyLength: stripeKey.length });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    logStep("Supabase config", { 
      hasUrl: !!supabaseUrl, 
      hasAnonKey: !!supabaseAnonKey 
    });

    const supabaseClient = createClient(
      supabaseUrl ?? "",
      supabaseAnonKey ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR - No authorization header provided");
      throw new Error("No authorization header provided");
    }
    logStep("Authorization header found", { headerLength: authHeader.length });

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token...");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("ERROR - Authentication failed", { error: userError.message });
      throw new Error(`Authentication error: ${userError.message}`);
    }
    
    const user = userData.user;
    if (!user?.email) {
      logStep("ERROR - User not authenticated or email not available");
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated successfully", { userId: user.id, email: user.email });

    logStep("Initializing Stripe client...");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check for existing Stripe customer
    logStep("Searching for existing Stripe customer by email...");
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    } else {
      logStep("No existing customer found - will create new during checkout");
    }

    // TSW Atlas Premium - £5.99/month (active product: prod_Tb4N9ELb7DATG9)
    const PRICE_ID = "price_1SdsESP0aIdhyRtPA0atJ80k";
    logStep("Using price", { priceId: PRICE_ID });

    const origin = req.headers.get("origin") || "https://tracktsw.app";
    const successUrl = `${origin}/settings?subscription=success`;
    const cancelUrl = `${origin}/settings?subscription=cancelled`;
    
    logStep("Creating Stripe checkout session...", {
      mode: "subscription",
      hasExistingCustomer: !!customerId,
      successUrl,
      cancelUrl
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
      },
      client_reference_id: user.id,
    });

    logStep("✅ Checkout session created successfully", { 
      sessionId: session.id,
      hasUrl: !!session.url
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("❌ ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
