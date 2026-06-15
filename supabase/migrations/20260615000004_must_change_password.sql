-- Ensure must_change_password column exists (idempotent — already added in
-- 20260505000001_profiles_full_name_must_change_password.sql)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;
