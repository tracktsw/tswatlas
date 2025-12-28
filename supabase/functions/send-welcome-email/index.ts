import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: WelcomeEmailRequest = await req.json();

    if (!email) {
      console.error("[WELCOME-EMAIL] No email provided");
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[WELCOME-EMAIL] Sending welcome email to:", email);

    const emailResponse = await resend.emails.send({
      from: "TrackTSW <no-reply@tracktsw.app>",
      reply_to: "contact@tracktsw.app",
      to: [email],
      subject: "Welcome to TrackTSW",
      html: `
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
                        Your TSW Recovery Companion
                      </p>
                      
                      <!-- Content -->
                      <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3D405B;">
                        Your TrackTSW account has been created.
                      </p>
                      <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.6;">
                        You can now start tracking your skin journey with check-ins and photos.
                      </p>
                      
                      <!-- Button -->
                      <a href="https://tracktsw.app" 
                         style="display: inline-block; padding: 14px 32px; background-color: #E07A5F; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 12px rgba(224,122,95,0.3);">
                        Open TrackTSW
                      </a>
                      
                      <!-- Footer -->
                      <p style="margin: 40px 0 0 0; font-size: 12px; color: #9CA3AF;">
                        Wishing you healing and progress on your journey.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("[WELCOME-EMAIL] Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    // Log error but return success to not block signup
    console.error("[WELCOME-EMAIL] Error sending email:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, // Return 200 to not cause issues in the frontend
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
