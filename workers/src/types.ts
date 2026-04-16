export interface Env {
  NEON_DATABASE_URL: string;
  NEON_AUTH_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_STANDARD: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PORTAL_CONFIG_ID?: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  // TODO: HTTP テスト用の cron secret。未登録のため HTTP POST /send-push は常に 401 相当で早期 return する。
  // 利用する場合は `wrangler secret put BETTER_AUTH_SECRET` で登録する。
  BETTER_AUTH_SECRET?: string;
}
