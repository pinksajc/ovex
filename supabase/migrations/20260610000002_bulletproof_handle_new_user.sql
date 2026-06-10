-- ============================================================
-- COMPREHENSIVE FIX — run this in Supabase SQL Editor
-- Safe to run multiple times (idempotent).
-- Supersedes 20260609000003 + 20260610000001 if those failed.
-- ============================================================

-- ── 1. Fix role CHECK constraint ─────────────────────────────────────────────
-- Drop any existing CHECK constraints on profiles.role (named or unnamed).
-- PostgreSQL auto-names inline constraints as '<table>_<col>_check'.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM   pg_constraint con
    JOIN   pg_class      rel ON rel.oid = con.conrelid
    JOIN   pg_namespace  nsp ON nsp.oid = rel.relnamespace
    WHERE  nsp.nspname = 'public'
      AND  rel.relname = 'profiles'
      AND  con.contype = 'c'
      AND  pg_get_constraintdef(con.oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped role constraint: %', r.conname;
  END LOOP;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'sales', 'finance'));

-- ── 2. Add status column (safe if already exists) ────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Drop any existing status CHECK so we can recreate cleanly
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM   pg_constraint con
    JOIN   pg_class      rel ON rel.oid = con.conrelid
    JOIN   pg_namespace  nsp ON nsp.oid = rel.relnamespace
    WHERE  nsp.nspname = 'public'
      AND  rel.relname = 'profiles'
      AND  con.contype = 'c'
      AND  pg_get_constraintdef(con.oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped status constraint: %', r.conname;
  END LOOP;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'pending', 'inactive'));

CREATE INDEX IF NOT EXISTS profiles_status_idx ON profiles (status);

-- ── 3. Bulletproof trigger ────────────────────────────────────────────────────
-- KEY DESIGN DECISIONS:
--   a) EXCEPTION WHEN OTHERS THEN RETURN new  →  trigger NEVER blocks createUser
--   b) ON CONFLICT (id) DO NOTHING            →  safe re-runs, no constraint violations
--   c) role defaults to 'sales' (safest value that satisfies any role constraint)
--   d) status defaults to 'active'
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(COALESCE(new.email, ''), '@', 1)
    ),
    COALESCE(new.raw_user_meta_data->>'role', 'sales'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;

EXCEPTION WHEN OTHERS THEN
  -- Log the error but NEVER block auth.users insertion.
  -- The profile row will be reconciled by the app on next load.
  RAISE WARNING '[handle_new_user] non-fatal error — % : %', SQLSTATE, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger (DROP + CREATE is idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Done ─────────────────────────────────────────────────────────────────────
-- Verify with:
--   SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'profiles' ORDER BY ordinal_position;
