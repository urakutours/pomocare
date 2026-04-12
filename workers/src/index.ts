import type { Env } from './types';
import { handleCreateCheckoutSession } from './routes/create-checkout-session';
import { handleCreatePortalSession } from './routes/create-portal-session';
import { handleCancelSubscription } from './routes/cancel-subscription';
import { handleStripeWebhook } from './routes/stripe-webhook';
import { handleScheduleNotification } from './routes/schedule-notification';
import { handleSendPush } from './routes/send-push';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case '/create-checkout-session':
        return handleCreateCheckoutSession(request, env);
      case '/create-portal-session':
        return handleCreatePortalSession(request, env);
      case '/cancel-subscription':
        return handleCancelSubscription(request, env);
      case '/stripe-webhook':
        return handleStripeWebhook(request, env);
      case '/schedule-notification':
        return handleScheduleNotification(request, env);
      case '/send-push':
        // HTTP trigger requires secret header (validated inside handler)
        await handleSendPush(env, request);
        return Response.json({ ok: true });
      case '/health':
        return Response.json({ ok: true, ts: Date.now() });
      default:
        return new Response('Not Found', { status: 404 });
    }
  },

  // Cloudflare Cron Trigger — runs send-push every minute
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await handleSendPush(env);
  },
} satisfies ExportedHandler<Env>;
