export interface Env {
  NEON_DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_STANDARD: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PORTAL_CONFIG_ID?: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}
