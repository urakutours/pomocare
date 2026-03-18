-- Push subscription storage (one per device per user)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_subs" ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Scheduled notifications (timer-end push)
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fire_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL DEFAULT 'Timer Complete',
  body TEXT NOT NULL DEFAULT 'PomoCare',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_notifs" ON scheduled_notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_sched_pending
  ON scheduled_notifications(fire_at)
  WHERE status = 'pending';
