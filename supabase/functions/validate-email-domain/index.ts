import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Blocked domains - localhost, test, disposable email services
const blockedDomains = [
  'localhost', 'local', 'test', 'example', 'invalid', 'localdomain',
  // Common disposable email domains
  'tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com',
  'temp-mail.org', '10minutemail.com', 'fakeinbox.com', 'trashmail.com',
  'maildrop.cc', 'yopmail.com', 'tempail.com', 'getnada.com', 'mohmal.com',
  'dispostable.com', 'mailnesia.com', 'mintemail.com', 'tempr.email',
  'discard.email', 'spamgourmet.com', 'mytrashmail.com', 'mailcatch.com'
];

// Blocked TLDs - test TLDs and known bad ones
const blockedTLDs = ['test', 'local', 'localhost', 'invalid', 'example', 'lan', 'internal'];

async function checkDNS(domain: string): Promise<boolean> {
  try {
    // Use Cloudflare DNS over HTTPS to check MX records
    const mxResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { 'Accept': 'application/dns-json' },
      }
    );
    
    if (mxResponse.ok) {
      const mxData = await mxResponse.json();
      // Status 0 = NOERROR, check if we have answers
      if (mxData.Status === 0 && mxData.Answer && mxData.Answer.length > 0) {
        return true;
      }
    }
    
    // Fallback: check A records if no MX
    const aResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      {
        headers: { 'Accept': 'application/dns-json' },
      }
    );
    
    if (aResponse.ok) {
      const aData = await aResponse.json();
      if (aData.Status === 0 && aData.Answer && aData.Answer.length > 0) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[DNS] Error checking domain:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmed = email.trim().toLowerCase();
    const atIndex = trimmed.indexOf('@');
    
    if (atIndex === -1) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domain = trimmed.slice(atIndex + 1);
    
    // Check for blocked domains
    if (blockedDomains.some(blocked => domain === blocked || domain.endsWith('.' + blocked))) {
      console.log('[VALIDATE] Blocked domain:', domain);
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for blocked TLDs
    const lastDot = domain.lastIndexOf('.');
    if (lastDot !== -1) {
      const tld = domain.slice(lastDot + 1);
      if (blockedTLDs.includes(tld)) {
        console.log('[VALIDATE] Blocked TLD:', tld);
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check for single-character domain parts (likely fake)
    const domainParts = domain.split('.');
    if (domainParts.some(part => part.length === 1 && part !== 'i')) {
      console.log('[VALIDATE] Single-char domain part:', domain);
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform DNS lookup
    const hasDNS = await checkDNS(domain);
    
    if (!hasDNS) {
      console.log('[VALIDATE] No DNS records for:', domain);
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[VALIDATE] Valid domain:', domain);
    return new Response(
      JSON.stringify({ valid: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[VALIDATE] Error:', error);
    return new Response(
      JSON.stringify({ valid: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});