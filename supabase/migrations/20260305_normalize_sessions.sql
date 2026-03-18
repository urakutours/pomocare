-- Normalize sessions from JSONB blob (user_sessions.items) to individual rows.
-- This eliminates the "last write wins" problem in cross-device sync.

-- 1. Create normalized sessions table
CREATE TABLE IF NOT EXISTS user_sessions_v2 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,            -- ISO 8601 datetime string (PomodoroSession.date)
  duration INTEGER NOT NULL,     -- seconds
  label TEXT,                    -- label ID (nullable)
  note TEXT,                     -- session note (nullable)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)          -- one session per exact timestamp per user
);

-- 2. RLS policies
ALTER TABLE user_sessions_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON user_sessions_v2 FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON user_sessions_v2 FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON user_sessions_v2 FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON user_sessions_v2 FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Index for efficient per-user queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_v2_user_date
  ON user_sessions_v2(user_id, date);

-- 4. Migrate existing JSONB data to normalized table
-- ON CONFLICT DO NOTHING ensures idempotent re-runs
INSERT INTO user_sessions_v2 (user_id, date, duration, label, note)
SELECT
  us.user_id,
  (s->>'date')::TEXT,
  COALESCE((s->>'duration')::INTEGER, 0),
  s->>'label',
  s->>'note'
FROM user_sessions us,
     jsonb_array_elements(us.items) AS s
WHERE us.items IS NOT NULL
  AND jsonb_array_length(us.items) > 0
ON CONFLICT (user_id, date) DO NOTHING;
