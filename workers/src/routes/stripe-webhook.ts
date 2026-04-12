import Stripe from 'stripe';
import type { Env } from '../types';
import { getSQL } from '../lib/db';

export async function handleStripeWebhook(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return new Response('Missing signature', { status: 400 });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe-webhook] Signature verification failed:', msg);
    return Response.json({ error: msg }, { status: 400 });
  }

  const sql = getSQL(env);
  console.log(`[stripe-webhook] ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // ---- Checkout completed ----
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        if (!userId || !plan) break;

        if (plan === 'pro') {
          await sql`
            UPDATE user_profiles SET
              tier = 'pro',
              stripe_customer_id = ${session.customer as string},
              stripe_subscription_id = NULL,
              subscription_status = NULL,
              subscription_current_period_end = NULL,
              tier_updated_at = NOW()
            WHERE user_id = ${userId}
          `;

          // Cancel old Standard subscription if upgrading
          const pi = session.payment_intent;
          let cancelSubId: string | undefined;
          if (typeof pi === 'string') {
            const intent = await stripe.paymentIntents.retrieve(pi);
            cancelSubId = intent.metadata?.cancel_subscription_id;
          } else if (pi && typeof pi === 'object' && 'metadata' in pi) {
            cancelSubId = (pi as Stripe.PaymentIntent).metadata?.cancel_subscription_id;
          }
          if (cancelSubId) {
            try {
              await stripe.subscriptions.cancel(cancelSubId);
            } catch (e) {
              console.warn('[stripe-webhook] Failed to cancel old subscription:', e);
            }
          }
        } else if (plan === 'standard') {
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as Stripe.Subscription | null)?.id ?? null;

          let subStatus = 'active';
          let periodEnd: string | null = null;
          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              subStatus = sub.status;
              periodEnd = new Date(sub.current_period_end * 1000).toISOString();
            } catch {
              // use defaults
            }
          }

          await sql`
            UPDATE user_profiles SET
              tier = 'standard',
              stripe_customer_id = ${session.customer as string},
              stripe_subscription_id = ${subscriptionId},
              subscription_status = ${subStatus},
              subscription_current_period_end = ${periodEnd},
              subscription_start_date = NOW(),
              tier_updated_at = NOW()
            WHERE user_id = ${userId}
          `;
        }
        break;
      }

      // ---- Subscription updated ----
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const users = await sql`
          SELECT user_id, tier FROM user_profiles WHERE stripe_customer_id = ${customerId} LIMIT 1
        `;
        if (!users[0]) break;
        const { user_id: userId, tier } = users[0] as { user_id: string; tier: string };

        // Don't downgrade Pro users
        if (tier === 'pro') break;

        const newTier = sub.status === 'active' || sub.status === 'trialing' ? 'standard' : 'free';
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

        await sql`
          UPDATE user_profiles SET
            tier = ${newTier},
            stripe_subscription_id = ${sub.id},
            subscription_status = ${sub.status},
            subscription_current_period_end = ${periodEnd},
            tier_updated_at = NOW()
          WHERE user_id = ${userId}
        `;
        break;
      }

      // ---- Subscription deleted ----
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const users = await sql`
          SELECT user_id, tier FROM user_profiles WHERE stripe_customer_id = ${customerId} LIMIT 1
        `;
        if (!users[0]) break;
        const { user_id: userId, tier } = users[0] as { user_id: string; tier: string };

        if (tier === 'pro') break;

        await sql`
          UPDATE user_profiles SET
            tier = 'free',
            stripe_subscription_id = NULL,
            subscription_status = 'canceled',
            subscription_current_period_end = NULL,
            tier_updated_at = NOW()
          WHERE user_id = ${userId}
        `;
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(`[stripe-webhook] Payment failed: customer=${invoice.customer}, invoice=${invoice.id}`);
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe-webhook] Processing error:', message);
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ received: true });
}
