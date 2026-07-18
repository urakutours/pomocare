export interface Env {
  NEON_DATABASE_URL: string;
  NEON_AUTH_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_STANDARD: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PORTAL_CONFIG_ID?: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  // Resend/FreeResend fallback layer (see src/lib/email.ts)
  EMAIL_PRIMARY?: string;
  EMAIL_FALLBACK?: string;
  RESEND_BASE_URL?: string;
  FREERESEND_API_KEY?: string;
  SLACK_ALERT_WEBHOOK_URL?: string;
  // Pre-cutover smoke canary (see src/routes/email-smoke-canary.ts)
  SMOKE_CANARY_SECRET?: string;
  SMOKE_CANARY_ENABLED?: string;
  SMOKE_CANARY_MAILBOX?: string;
}
