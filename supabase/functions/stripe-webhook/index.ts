import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

// SERVICE_ROLEキーでSupabaseに接続（RLSバイパス）
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ---------- ユーザー検索ヘルパー ----------
async function findUserByCustomerId(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data?.user_id ?? null;
}

async function updateUserProfile(
  userId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update({ ...updates, tier_updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) {
    console.error(`[stripe-webhook] Failed to update user_profiles for ${userId}:`, error.message);
    throw error;
  }
}

// ---------- Main handler ----------
serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!sig || !webhookSecret) {
    console.error("[stripe-webhook] Missing stripe-signature or STRIPE_WEBHOOK_SECRET");
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    // StripeのWebhook署名を検証（改ざん・リプレイ攻撃防止）
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe-webhook] Signature verification failed:", msg);
    return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${msg}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[stripe-webhook] Processing event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {

      // ================================================================
      // 決済完了: Pro一括購入 の確定
      // Standard初回決済はここでは処理しない（subscription.updatedで処理）
      // ================================================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan;

        if (!userId || !plan) {
          console.error("[stripe-webhook] Missing metadata in checkout.session.completed:", session.id);
          break;
        }

        if (plan === "pro") {
          // Pro買い切り: tierをproに即時更新
          await updateUserProfile(userId, {
            tier: "pro",
            stripe_customer_id: session.customer as string,
            // 一括購入なのでsubscription IDはなし
            stripe_subscription_id: null,
            subscription_status: null,
            subscription_current_period_end: null,
          });
          console.log(`[stripe-webhook] User ${userId} upgraded to Pro (one-time)`);

          // StandardサブスクリプションをProアップグレード時にキャンセル
          const cancelSubId = (session.payment_intent as Stripe.PaymentIntent)
            ?.metadata?.cancel_subscription_id;
          if (cancelSubId) {
            try {
              await stripe.subscriptions.cancel(cancelSubId);
              console.log(`[stripe-webhook] Cancelled old subscription: ${cancelSubId}`);
            } catch (cancelErr) {
              // キャンセル失敗は警告のみ（tierはすでにproに更新済み）
              console.warn("[stripe-webhook] Failed to cancel old subscription:", cancelErr);
            }
          }
        }
        // Standard の場合は customer.subscription.updated で処理するため、ここでは何もしない
        break;
      }

      // ================================================================
      // サブスクリプション更新: Standard 毎月の更新、状態変化
      // ================================================================
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const userId = await findUserByCustomerId(customerId);
        if (!userId) {
          console.error("[stripe-webhook] No user found for customer:", customerId);
          break;
        }

        const status = sub.status;
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

        // active または trialing のみ standard に昇格、それ以外は free に降格
        const newTier = status === "active" || status === "trialing" ? "standard" : "free";

        // 既にProユーザーの場合はtierを変更しない（Pro買い切り後にsub更新が来ても上書きしない）
        const { data: current } = await supabaseAdmin
          .from("user_profiles")
          .select("tier")
          .eq("user_id", userId)
          .single();

        if (current?.tier === "pro") {
          console.log(`[stripe-webhook] Skipping subscription.updated for Pro user: ${userId}`);
          break;
        }

        await updateUserProfile(userId, {
          tier: newTier,
          stripe_subscription_id: sub.id,
          subscription_status: status,
          subscription_current_period_end: periodEnd,
        });
        console.log(`[stripe-webhook] User ${userId} subscription updated: tier=${newTier}, status=${status}`);
        break;
      }

      // ================================================================
      // サブスクリプション削除: 解約または支払い失敗後の自動キャンセル
      // ================================================================
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const userId = await findUserByCustomerId(customerId);
        if (!userId) {
          console.error("[stripe-webhook] No user found for customer:", customerId);
          break;
        }

        // Proユーザーのsubが削除されても無視（Proは買い切りなので通常来ないが念のため）
        const { data: current } = await supabaseAdmin
          .from("user_profiles")
          .select("tier")
          .eq("user_id", userId)
          .single();

        if (current?.tier === "pro") {
          console.log(`[stripe-webhook] Skipping subscription.deleted for Pro user: ${userId}`);
          break;
        }

        await updateUserProfile(userId, {
          tier: "free",
          stripe_subscription_id: null,
          subscription_status: "canceled",
          subscription_current_period_end: null,
        });
        console.log(`[stripe-webhook] User ${userId} downgraded to Free (subscription deleted)`);
        break;
      }

      // ================================================================
      // 支払い失敗: ログのみ（subscription.updatedでpast_due状態として処理される）
      // ================================================================
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(
          `[stripe-webhook] Payment failed for customer: ${invoice.customer}, invoice: ${invoice.id}`
        );
        // Stripeは自動リトライ後、最終的にsubscription.deletedを送信する
        // → そのイベントでfreeへのダウングレードを処理
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe-webhook] Processing error:", message);
    // 500を返すとStripeが再送するため、冪等性のある処理が重要
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 200を返してStripeに受信完了を通知
  return new Response(
    JSON.stringify({ received: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
