-- =============================================================
-- PomoCare: Supabase → Neon 移行用 SQL
-- Neon SQL Editor で実行してください
-- =============================================================

-- 1. セッションテーブル（正規化済み、1行=1セッション）
CREATE TABLE IF NOT EXISTS public.user_sessions_v2 (
  user_id   TEXT        NOT NULL,
  date      TEXT        NOT NULL,
  duration  INTEGER     NOT NULL DEFAULT 0,
  label     TEXT,
  note      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

-- 2. 設定テーブル（JSONB で全設定を保存）
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id    TEXT        NOT NULL PRIMARY KEY,
  data       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ユーザープロファイルテーブル（tier / subscription 管理）
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id                          TEXT        NOT NULL PRIMARY KEY,
  tier                             TEXT        NOT NULL DEFAULT 'free',
  subscription_start_date          TIMESTAMPTZ,
  subscription_status              TEXT,
  subscription_current_period_end  TIMESTAMPTZ,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- Row-Level Security (RLS)
-- Data API が JWT の auth.user_id() を使って RLS を適用する
-- =============================================================

-- Sessions
ALTER TABLE public.user_sessions_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions" ON public.user_sessions_v2
  FOR ALL
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

-- Settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings" ON public.user_settings
  FOR ALL
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

-- Profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT
  USING (user_id = auth.user_id());

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.user_id());

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

-- =============================================================
-- インデックス
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_sessions_v2_user_date
  ON public.user_sessions_v2 (user_id, date);

CREATE INDEX IF NOT EXISTS idx_sessions_v2_user_updated
  ON public.user_sessions_v2 (user_id, updated_at);
