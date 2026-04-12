import Stripe from 'stripe';
import type { Env } from '../types';
import { verifyJWT } from '../lib/auth';
import { getSQL } from '../lib/db';
import { handleCors, jsonResponse } from '../lib/cors';

export async function handleCancelSubscription(
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
    const user = await verifyJWT(request, env);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, origin);

    const sql = getSQL(env);
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });

    const profiles = await sql`
      SELECT tier, stripe_subscription_id, subscription_status
      FROM user_profiles WHERE user_id = ${user.id} LIMIT 1
    `;
    const profile = profiles[0] as {
      tier?: string;
      stripe_subscription_id?: string;
      subscription_status?: string;
    } | undefined;

    if (!profile?.stripe_subscription_id) {
      return jsonResponse({ error: 'No active subscription found.' }, 400, origin);
    }
    if (profile.tier === 'pro') {
      return jsonResponse({ error: 'Pro plan cannot be cancelled (one-time purchase).' }, 400, origin);
    }
    if (profile.subscription_status === 'canceled') {
      return jsonResponse({ error: 'Subscription is already cancelled.' }, 400, origin);
    }

    await stripe.subscriptions.cancel(profile.stripe_subscription_id);

    await sql`
      UPDATE user_profiles SET
        tier = 'free',
        stripe_subscription_id = NULL,
        subscription_status = 'canceled',
        subscription_current_period_end = NULL,
        tier_updated_at = NOW()
      WHERE user_id = ${user.id}
    `;

    return jsonResponse({ success: true }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[cancel-subscription]', message);
    return jsonResponse({ error: message }, 500, origin);
  }
}
