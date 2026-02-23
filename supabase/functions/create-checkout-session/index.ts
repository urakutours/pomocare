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

// ---------- Currency helpers ----------
// 多通貨Price（JPY/USD/EUR が1つのprice_idに統合されている）を使用するため、
// price_id は plan ごとに1つ。言語に応じた通貨を checkout session に指定する。
type Currency = "jpy" | "usd" | "eur";

function getCurrency(language: string): Currency {
  if (language === "ja") return "jpy";
  if (["de", "fr", "it"].includes(language)) return "eur";
  return "usd";
}

function getPriceId(plan: "standard" | "pro"): string {
  // STRIPE_PRICE_STANDARD / STRIPE_PRICE_PRO の2つだけ用意すればOK
  const key = `STRIPE_PRICE_${plan.toUpperCase()}`;
  const id = Deno.env.get(key);
  if (!id) throw new Error(`Missing env var: ${key}`);
  return id;
}

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
    // ---- JWT検証: AuthorizationヘッダーからSupabaseユーザーを取得 ----
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

    // ---- リクエストボディのパース ----
    const body = await req.json() as { plan?: string; language?: string };
    const plan = body.plan as "standard" | "pro" | undefined;
    const language = body.language ?? "en";

    if (!plan || !["standard", "pro"].includes(plan)) {
      return new Response(
        JSON.stringify({ error: "Invalid plan. Must be 'standard' or 'pro'." }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ---- SERVICE_ROLEでuser_profilesを参照（RLSバイパス） ----
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("tier, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    // 既にProユーザーがPro購入しようとしたらブロック
    if (profile?.tier === "pro" && plan === "pro") {
      return new Response(
        JSON.stringify({ error: "You are already on the Pro plan." }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ---- Stripe Customer: 既存IDを使うか新規作成 ----
    let customerId: string;
    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // stripe_customer_idをDBに保存（Webhookで後から特定できるよう）
      await supabaseAdmin
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    // ---- 通貨・Price ID決定 ----
    // 多通貨Priceを使用: price_id は1つ、currency で通貨を指定
    const currency = getCurrency(language);
    const priceId = getPriceId(plan);

    // ---- Stripe Checkout Session作成 ----
    const isSubscription = plan === "standard";
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isSubscription ? "subscription" : "payment",
      // 多通貨Priceに設定された通貨のうち、言語に対応する通貨を指定
      currency,
      success_url: `https://app.pomocare.com/?payment=success&plan=${plan}`,
      cancel_url: "https://app.pomocare.com/?payment=cancelled",
      metadata: {
        supabase_user_id: user.id,
        plan,
      },
      // StandardからProへのアップグレード時: 既存サブスクを後でキャンセルできるようメタデータに記録
      ...(plan === "pro" && profile?.stripe_subscription_id
        ? {
            payment_intent_data: {
              metadata: {
                cancel_subscription_id: profile.stripe_subscription_id,
              },
            },
          }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[create-checkout-session] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
