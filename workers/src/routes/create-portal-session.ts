import Stripe from 'stripe';
import type { Env } from '../types';
import { verifyJWT } from '../lib/auth';
import { getSQL } from '../lib/db';
import { handleCors, jsonResponse } from '../lib/cors';

export async function handleCreatePortalSession(
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
      SELECT stripe_customer_id FROM user_profiles WHERE user_id = ${user.id} LIMIT 1
    `;
    const customerId = (profiles[0] as { stripe_customer_id?: string } | undefined)?.stripe_customer_id;

    if (!customerId) {
      return jsonResponse({ error: 'No Stripe customer found. Please contact support.' }, 400, origin);
    }

    let language = 'en';
    try {
      const body = (await request.json()) as { language?: string };
      if (body.language) language = body.language;
    } catch {
      // default to en
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://app.pomocare.com/',
      locale: language as Stripe.BillingPortal.SessionCreateParams.Locale,
      ...(env.STRIPE_PORTAL_CONFIG_ID ? { configuration: env.STRIPE_PORTAL_CONFIG_ID } : {}),
    });

    return jsonResponse({ url: portalSession.url }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[create-portal-session]', message);
    return jsonResponse({ error: message }, 500, origin);
  }
}
