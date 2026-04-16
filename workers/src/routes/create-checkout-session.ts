import Stripe from 'stripe';
import type { Env } from '../types';
import { verifySession } from '../lib/auth';
import { getSQL } from '../lib/db';
import { handleCors, jsonResponse } from '../lib/cors';

// ---------- Currency helpers ----------
type Currency = 'jpy' | 'usd' | 'eur';

function getCurrency(language: string): Currency {
  if (language === 'ja') return 'jpy';
  if (['de', 'fr', 'it'].includes(language)) return 'eur';
  return 'usd';
}

// ---------- Discount helpers (Standard → Pro) ----------
const MAX_DISCOUNT_MONTHS = 6;
const MONTHLY_AMOUNT: Record<Currency, number> = {
  jpy: 250,
  usd: 249,
  eur: 249,
};

async function createUpgradeDiscount(
  stripe: Stripe,
  subscriptionStartDate: string | null,
  currency: Currency,
): Promise<string | null> {
  if (!subscriptionStartDate) return null;

  const start = new Date(subscriptionStartDate);
  const now = new Date();
  const months = Math.floor((now.getTime() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
  const discountMonths = Math.min(Math.max(months, 0), MAX_DISCOUNT_MONTHS);
  if (discountMonths === 0) return null;

  const discountAmount = discountMonths * MONTHLY_AMOUNT[currency];
  const coupon = await stripe.coupons.create({
    amount_off: discountAmount,
    currency,
    duration: 'once',
    name: `Standard ${discountMonths}mo upgrade discount`,
    max_redemptions: 1,
  });
  return coupon.id;
}

// ---------- Handler ----------
export async function handleCreateCheckoutSession(
  request: Request,
  env: Env,
): Promise<Response> {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const origin = request.headers.get('Origin') ?? '';

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405, origin);
  }

  try {
    const user = await verifySession(request, env);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, origin);

    let body: { plan?: string; language?: string };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, origin);
    }
    const plan = body.plan as 'standard' | 'pro' | undefined;
    const language = body.language ?? 'en';

    if (!plan || !['standard', 'pro'].includes(plan)) {
      return jsonResponse({ error: "Invalid plan. Must be 'standard' or 'pro'." }, 400, origin);
    }

    const sql = getSQL(env);
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });

    // Fetch user profile
    const profiles = await sql`
      SELECT tier, stripe_customer_id, stripe_subscription_id, subscription_start_date
      FROM user_profiles WHERE user_id = ${user.id} LIMIT 1
    `;
    const profile = profiles[0] as {
      tier?: string;
      stripe_customer_id?: string;
      stripe_subscription_id?: string;
      subscription_start_date?: string;
    } | undefined;

    if (profile?.tier === 'pro' && plan === 'pro') {
      return jsonResponse({ error: 'You are already on the Pro plan.' }, 400, origin);
    }

    // Stripe Customer
    let customerId: string;
    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await sql`
        UPDATE user_profiles SET stripe_customer_id = ${customerId} WHERE user_id = ${user.id}
      `;
    }

    // Currency (respect existing customer currency)
    let currency = getCurrency(language);
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, limit: 1 });
      if (subs.data.length > 0 && subs.data[0].currency) {
        currency = subs.data[0].currency as Currency;
      } else {
        const invoices = await stripe.invoices.list({ customer: customerId, limit: 1 });
        if (invoices.data.length > 0 && invoices.data[0].currency) {
          currency = invoices.data[0].currency as Currency;
        }
      }
    } catch {
      // Use language-based currency
    }

    const priceId = plan === 'standard' ? env.STRIPE_PRICE_STANDARD : env.STRIPE_PRICE_PRO;

    // Standard → Pro upgrade discount
    let couponId: string | null = null;
    if (plan === 'pro' && profile?.tier === 'standard') {
      couponId = await createUpgradeDiscount(stripe, profile.subscription_start_date ?? null, currency);
    }

    const isSubscription = plan === 'standard';
    const isNewSubscription = isSubscription && (!profile?.tier || profile.tier === 'free');

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isSubscription ? 'subscription' : 'payment',
      currency,
      locale: language as Stripe.Checkout.SessionCreateParams.Locale,
      success_url: `https://app.pomocare.com/?payment=success&plan=${plan}`,
      cancel_url: 'https://app.pomocare.com/?payment=cancelled',
      metadata: { user_id: user.id, plan },
      ...(isNewSubscription ? { subscription_data: { trial_period_days: 60 } } : {}),
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      ...(plan === 'pro' && profile?.stripe_subscription_id
        ? { payment_intent_data: { metadata: { cancel_subscription_id: profile.stripe_subscription_id } } }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    return jsonResponse({ url: session.url }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[create-checkout-session]', message);
    return jsonResponse({ error: message }, 500, origin);
  }
}
