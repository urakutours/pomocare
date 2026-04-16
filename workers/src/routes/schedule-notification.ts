import type { Env } from '../types';
import { verifySession } from '../lib/auth';
import { getSQL } from '../lib/db';
import { handleCors, jsonResponse } from '../lib/cors';

export async function handleScheduleNotification(
  request: Request,
  env: Env,
): Promise<Response> {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const origin = request.headers.get('Origin') ?? '';

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405, origin);
  }

  const user = await verifySession(request, env);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, origin);

  const sql = getSQL(env);
  let body: {
    action: string;
    endpoint?: string;
    p256dh?: string;
    auth?: string;
    fire_at?: string;
    title?: string;
    body?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }

  const { action } = body;

  // --- Subscribe: save push subscription ---
  if (action === 'subscribe') {
    const { endpoint, p256dh, auth } = body;
    if (!endpoint || !p256dh || !auth) {
      return jsonResponse({ error: 'Missing push subscription fields' }, 400, origin);
    }
    await sql`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (${user.id}, ${endpoint}, ${p256dh}, ${auth})
      ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = ${p256dh}, auth = ${auth}
    `;
    return jsonResponse({ ok: true }, 200, origin);
  }

  // --- Schedule: create a pending notification ---
  if (action === 'schedule') {
    // Cancel existing pending
    await sql`
      UPDATE scheduled_notifications SET status = 'cancelled'
      WHERE user_id = ${user.id} AND status = 'pending'
    `;
    const fireAt = body.fire_at;
    const title = body.title || 'Timer Complete';
    const notifBody = body.body || 'PomoCare';
    await sql`
      INSERT INTO scheduled_notifications (user_id, fire_at, title, body)
      VALUES (${user.id}, ${fireAt}, ${title}, ${notifBody})
    `;
    return jsonResponse({ ok: true }, 200, origin);
  }

  // --- Cancel: mark all pending as cancelled ---
  if (action === 'cancel') {
    await sql`
      UPDATE scheduled_notifications SET status = 'cancelled'
      WHERE user_id = ${user.id} AND status = 'pending'
    `;
    return jsonResponse({ ok: true }, 200, origin);
  }

  // --- Unsubscribe: remove a push subscription ---
  if (action === 'unsubscribe') {
    const { endpoint } = body;
    if (endpoint) {
      await sql`
        DELETE FROM push_subscriptions WHERE user_id = ${user.id} AND endpoint = ${endpoint}
      `;
    }
    return jsonResponse({ ok: true }, 200, origin);
  }

  return jsonResponse({ error: 'Unknown action' }, 400, origin);
}
