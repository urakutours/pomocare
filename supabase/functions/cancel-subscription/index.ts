import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

// ---------- CORS ----------
const ALLOWED_ORIGINS = [
  "https://app.pomocare.com",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:5174",
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
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  const headers = corsHeaders(origin);

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
      .select("tier, stripe_subscription_id, subscription_status")
      .eq("user_id", user.id)
      .single();

    // ---- ガードチェック ----
    if (!profile?.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: "No active subscription found." }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    if (profile.tier === "pro") {
      return new Response(
        JSON.stringify({ error: "Pro plan cannot be cancelled (one-time purchase)." }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    if (profile.subscription_status === "canceled") {
      return new Response(
        JSON.stringify({ error: "Subscription is already cancelled." }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ---- Stripe サブスクリプション即時キャンセル ----
    console.log(`[cancel-subscription] Cancelling subscription ${profile.stripe_subscription_id} for user ${user.id}`);
    await stripe.subscriptions.cancel(profile.stripe_subscription_id);

    // ---- DB即時更新（webhook遅延のバックアップ、冪等） ----
    await supabaseAdmin
      .from("user_profiles")
      .update({
        tier: "free",
        stripe_subscription_id: null,
        subscription_status: "canceled",
        subscription_current_period_end: null,
        tier_updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    console.log(`[cancel-subscription] Successfully cancelled for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[cancel-subscription] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
