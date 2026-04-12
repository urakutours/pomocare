-- Push notification tables for Neon
-- Run this in the Neon SQL Editor

-- Push subscriptions (one per device per user)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

-- Scheduled notifications
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fire_at    TIMESTAMPTZ NOT NULL,
  title      TEXT NOT NULL DEFAULT 'Timer Complete',
  body       TEXT NOT NULL DEFAULT 'PomoCare',
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cron job: find due pending notifications
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending
  ON scheduled_notifications (fire_at)
  WHERE status = 'pending';

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
-- (Workers use direct connection with full access, so RLS applies to Data API only)
CREATE POLICY push_subscriptions_user ON push_subscriptions
  FOR ALL USING (user_id = auth.user_id());

CREATE POLICY scheduled_notifications_user ON scheduled_notifications
  FOR ALL USING (user_id = auth.user_id());
