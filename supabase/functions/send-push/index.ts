/**
 * send-push: Called by pg_cron every minute.
 * Finds due scheduled_notifications and sends Web Push to each user's devices.
 */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (_req: Request) => {
  const now = new Date().toISOString();

  // Find all due pending notifications
  const { data: due, error } = await supabaseAdmin
    .from("scheduled_notifications")
    .select("id, user_id, title, body")
    .eq("status", "pending")
    .lte("fire_at", now)
    .limit(100);

  if (error || !due || due.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Mark as sent immediately to prevent duplicate sends
  const ids = due.map((n: { id: string }) => n.id);
  await supabaseAdmin
    .from("scheduled_notifications")
    .update({ status: "sent" })
    .in("id", ids);

  // Group by user_id
  const byUser = new Map<string, { title: string; body: string }>();
  for (const n of due) {
    byUser.set(n.user_id, { title: n.title, body: n.body });
  }

  let sent = 0;
  for (const [userId, payload] of byUser) {
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs) continue;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 410 Gone or 404 = subscription expired, clean up
        if (statusCode === 410 || statusCode === 404) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        }
        console.error(
          `[send-push] Failed for ${sub.endpoint}:`,
          (err as Error).message,
        );
      }
    }
  }

  return new Response(JSON.stringify({ processed: due.length, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
