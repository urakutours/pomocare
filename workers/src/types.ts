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
}
