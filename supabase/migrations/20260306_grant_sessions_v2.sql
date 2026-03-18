-- Fix: user_sessions_v2 was created without GRANT to authenticated/anon roles.
-- Without these grants, the Supabase Data API cannot access the table
-- (shows "API DISABLED" in dashboard).
GRANT ALL ON user_sessions_v2 TO authenticated;
GRANT ALL ON user_sessions_v2 TO anon;
