import type { Env } from '../types';
import { getSQL } from '../lib/db';
import { sendNotification } from '../lib/webpush';

/**
 * send-push: Called by Cloudflare Cron Trigger every minute.
 * Also callable via HTTP POST with a secret header for testing.
 * Finds due scheduled_notifications and sends Web Push to each user's devices.
 */
export async function handleSendPush(
  env: Env,
  request?: Request,
): Promise<void> {
  // If called via HTTP (not cron), require secret header
  if (request) {
    const secret = request.headers.get('X-Cron-Secret');
    if (secret !== env.BETTER_AUTH_SECRET) {
      // Silently reject unauthorized HTTP calls
      return;
    }
  }

  const sql = getSQL(env);
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  const now = new Date().toISOString();

  // Find all due pending notifications
  const due = await sql`
    SELECT id, user_id, title, body FROM scheduled_notifications
    WHERE status = 'pending' AND fire_at <= ${now}
    LIMIT 100
  `;

  if (!due || due.length === 0) {
    console.log('[send-push] No due notifications');
    return;
  }

  // Mark as sent immediately to prevent duplicate sends from concurrent triggers
  const ids = due.map((n: Record<string, unknown>) => n.id as string);
  await sql`
    UPDATE scheduled_notifications SET status = 'sent' WHERE id = ANY(${ids})
  `;

  // Group by user_id (latest notification wins)
  const byUser = new Map<string, { title: string; body: string }>();
  for (const n of due) {
    byUser.set(n.user_id as string, { title: n.title as string, body: n.body as string });
  }

  let sent = 0;
  for (const [userId, payload] of byUser) {
    const subs = await sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
    `;

    for (const sub of subs) {
      try {
        const result = await sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
          },
          JSON.stringify(payload),
          vapid,
        );
        if (result.statusCode >= 200 && result.statusCode < 300) {
          sent++;
        } else if (result.statusCode === 410 || result.statusCode === 404) {
          // Subscription expired, clean up
          await sql`
            DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint as string}
          `;
        }
        console.log(`[send-push] ${sub.endpoint}: ${result.statusCode}`);
      } catch (err) {
        console.error(`[send-push] Failed for ${sub.endpoint}:`, (err as Error).message);
      }
    }
  }

  console.log(`[send-push] Processed: ${due.length}, Sent: ${sent}`);
}
