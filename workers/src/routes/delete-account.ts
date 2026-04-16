import Stripe from 'stripe';
import type { Env } from '../types';
import { verifySession } from '../lib/auth';
import { getSQL } from '../lib/db';
import { handleCors, jsonResponse } from '../lib/cors';

/**
 * Delete a user's account and all associated data.
 *
 * Flow:
 *   1. Verify session (ensure user is authenticated)
 *   2. Cancel active Stripe subscription (if any)
 *   3. Delete user_profiles row
 *   4. Delete user_sessions row (pomodoro history stored in JSONB)
 *   5. Delete user_settings row
 *   6. Delete push_subscriptions rows
 *   7. Delete scheduled_notifications rows
 *   8. Call Neon Auth /delete-user endpoint to delete the auth user itself
 *   9. Return success
 *
 * Partial failures are logged but do not abort the entire flow, so the user's
 * data gets cleaned up as much as possible even if one step fails.
 */
export async function handleDeleteAccount(
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

    const sql = getSQL(env);
    const errors: string[] = [];

    // 1. Cancel Stripe subscription (if any)
    try {
      const profiles = await sql`
        SELECT stripe_customer_id, stripe_subscription_id
        FROM user_profiles WHERE user_id = ${user.id} LIMIT 1
      `;
      const profile = profiles[0] as {
        stripe_customer_id?: string;
        stripe_subscription_id?: string;
      } | undefined;

      if (profile?.stripe_subscription_id) {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
        try {
          await stripe.subscriptions.cancel(profile.stripe_subscription_id);
        } catch (err) {
          // Subscription may already be cancelled; log but don't fail
          errors.push(`stripe_cancel: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    } catch (err) {
      errors.push(`stripe_lookup: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // 2-6. Delete from Neon DB tables
    const tables = [
      'user_profiles',
      'user_sessions',
      'user_settings',
      'push_subscriptions',
      'scheduled_notifications',
    ];
    for (const table of tables) {
      try {
        await sql(
          `DELETE FROM ${table} WHERE user_id = $1`,
          [user.id],
        );
      } catch (err) {
        // Table may not exist or have user_id column; log and continue
        errors.push(`${table}: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    // 7. Call Neon Auth /delete-user endpoint
    //    Session cookie from the incoming request is forwarded so Better Auth
    //    can authorize the delete.
    try {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const authRes = await fetch(`${env.NEON_AUTH_URL}/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `better-auth.session_token=${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!authRes.ok) {
        const text = await authRes.text().catch(() => '');
        errors.push(`neon_auth_delete: status=${authRes.status} body=${text.slice(0, 200)}`);
      }
    } catch (err) {
      errors.push(`neon_auth_delete: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    if (errors.length > 0) {
      console.warn('[delete-account] partial errors for user', user.id, errors);
    }

    return jsonResponse({
      success: true,
      userId: user.id,
      partialErrors: errors.length > 0 ? errors : undefined,
    }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[delete-account]', message);
    return jsonResponse({ error: message }, 500, origin);
  }
}
