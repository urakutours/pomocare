import type { Env } from './types';
import { handleCreateCheckoutSession } from './routes/create-checkout-session';
import { handleCreatePortalSession } from './routes/create-portal-session';
import { handleCancelSubscription } from './routes/cancel-subscription';
import { handleDeleteAccount } from './routes/delete-account';
import { handleStripeWebhook } from './routes/stripe-webhook';
import { handleNeonAuthWebhook } from './routes/neon-auth-webhook';
import { handleEmailSmokeCanary } from './routes/email-smoke-canary';

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
      case '/delete-account':
        return handleDeleteAccount(request, env);
      case '/stripe-webhook':
        return handleStripeWebhook(request, env);
      case '/neon-auth-webhook':
        return handleNeonAuthWebhook(request, env);
      case '/internal/email-smoke-canary':
        return handleEmailSmokeCanary(request, env);
      case '/health':
        return Response.json({ ok: true, ts: Date.now() });
      default:
        return new Response('Not Found', { status: 404 });
    }
  },
} satisfies ExportedHandler<Env>;
