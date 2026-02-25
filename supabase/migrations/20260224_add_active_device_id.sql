-- Add device restriction for free-tier users.
-- Paid users keep this column NULL (no device restriction).
-- Free users get their device UUID written here on login.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS active_device_id TEXT DEFAULT NULL;
