import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

// ---------- CORS ----------
const ALLOWED_ORIGINS = [
  "https://app.pomocare.com",
  "http://localhost:5173",
  "http://localhost:4173",
];

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ---------- Stripe ----------
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

// ---------- Main handler ----------
serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  const headers = corsHeaders(origin);

  // CORSプリフライト
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers });
  }

  try {
    // ---- JWT検証 ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ---- SERVICE_ROLEでuser_profilesを参照 ----
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe customer found. Please contact support." }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ---- Stripe Customer Portal Session作成 ----
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: "https://app.pomocare.com/",
    });

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[create-portal-session] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
