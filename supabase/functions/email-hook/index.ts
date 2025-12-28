import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[EMAIL-HOOK] ========== Auth Email Hook Triggered ==========");
  console.log("[EMAIL-HOOK] Method:", req.method);
  console.log("[EMAIL-HOOK] RESEND_API_KEY configured:", !!Deno.env.get("RESEND_API_KEY"));
  console.log("[EMAIL-HOOK] SEND_EMAIL_HOOK_SECRET configured:", !!hookSecret);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.log("[EMAIL-HOOK] Rejected - not POST");
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  console.log("[EMAIL-HOOK] Payload length:", payload.length);

  let eventData: any;

  // Verify webhook signature if secret is configured
  if (hookSecret) {
    try {
      console.log("[EMAIL-HOOK] Verifying webhook signature...");
      const wh = new Webhook(hookSecret);
      eventData = wh.verify(payload, headers);
      console.log("[EMAIL-HOOK] Webhook signature verified successfully");
    } catch (error) {
      console.error("[EMAIL-HOOK] Webhook verification failed:", error);
      return new Response(
        JSON.stringify({ error: { http_code: 401, message: "Invalid signature" } }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } else {
    // If no secret configured, parse payload directly (development mode)
    console.log("[EMAIL-HOOK] No secret configured, parsing payload directly");
    try {
      eventData = JSON.parse(payload);
    } catch (error) {
      console.error("[EMAIL-HOOK] Failed to parse payload:", error);
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid payload" } }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }

  const { user, email_data } = eventData;
  const { token, token_hash, redirect_to, email_action_type } = email_data || {};

  console.log("[EMAIL-HOOK] Email action type:", email_action_type);
  console.log("[EMAIL-HOOK] Recipient:", user?.email);
  console.log("[EMAIL-HOOK] Redirect to:", redirect_to);

  if (!user?.email) {
    console.error("[EMAIL-HOOK] No user email provided in payload");
    return new Response(
      JSON.stringify({ error: { http_code: 400, message: "No user email" } }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    console.log("[EMAIL-HOOK] Supabase URL:", supabaseUrl);
    let subject = "";
    let htmlContent = "";

    // Determine email type
    if (email_action_type === "recovery" || email_action_type === "reset_password") {
      subject = "Reset Your TrackTSW Password";
      const resetLink = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #FDF8F4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDF8F4; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="padding: 40px 32px; text-align: center;">
                      <!-- Header -->
                      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #E07A5F;">
                        TrackTSW
                      </h1>
                      <p style="margin: 0 0 32px 0; font-size: 14px; color: #81B29A; font-weight: 500;">
                        Password Reset
                      </p>
                      
                      <!-- Content -->
                      <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3D405B;">
                        Reset your password
                      </p>
                      <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.6;">
                        Click the button below to reset your password. This link will expire in 24 hours.
                      </p>
                      
                      <!-- Button -->
                      <a href="${resetLink}" 
                         style="display: inline-block; padding: 14px 32px; background-color: #E07A5F; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 12px rgba(224,122,95,0.3);">
                        Reset Password
                      </a>
                      
                      <!-- Security note -->
                      <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
                        If you didn't request a password reset, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    } else if (email_action_type === "magiclink") {
      subject = "Sign in to TrackTSW";
      const magicLink = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #FDF8F4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDF8F4; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="padding: 40px 32px; text-align: center;">
                      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #E07A5F;">
                        TrackTSW
                      </h1>
                      <p style="margin: 0 0 32px 0; font-size: 14px; color: #81B29A; font-weight: 500;">
                        Magic Link Sign In
                      </p>
                      
                      <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.6;">
                        Click the button below to sign in to your account.
                      </p>
                      
                      <a href="${magicLink}" 
                         style="display: inline-block; padding: 14px 32px; background-color: #E07A5F; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 12px rgba(224,122,95,0.3);">
                        Sign In
                      </a>
                      
                      <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
                        If you didn't request this link, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    } else {
      // For other email types (like signup confirmation), use a generic template
      subject = `Confirm your TrackTSW account`;
      const confirmLink = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #FDF8F4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDF8F4; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="padding: 40px 32px; text-align: center;">
                      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #E07A5F;">
                        TrackTSW
                      </h1>
                      
                      <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.6;">
                        Click the button below to confirm your email.
                      </p>
                      
                      <a href="${confirmLink}" 
                         style="display: inline-block; padding: 14px 32px; background-color: #E07A5F; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 12px rgba(224,122,95,0.3);">
                        Confirm Email
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    }

    console.log("[EMAIL-HOOK] Sending email via Resend...");
    console.log("[EMAIL-HOOK] From: TrackTSW <no-reply@tracktsw.app>");
    console.log("[EMAIL-HOOK] To:", user.email);
    console.log("[EMAIL-HOOK] Subject:", subject);

    const emailResponse = await resend.emails.send({
      from: "TrackTSW <no-reply@tracktsw.app>",
      reply_to: "contact@tracktsw.app",
      to: [user.email],
      subject,
      html: htmlContent,
    });

    console.log("[EMAIL-HOOK] ✅ Email sent successfully via Resend:", JSON.stringify(emailResponse));

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[EMAIL-HOOK] ❌ Error sending email:", error.message);
    console.error("[EMAIL-HOOK] Full error:", JSON.stringify(error));
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: error.message } }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
