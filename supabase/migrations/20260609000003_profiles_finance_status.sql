-- Migration: extend profiles table for finance role + status column
-- Run this in the Supabase Dashboard → SQL Editor
--
-- IMPORTANT: The original CREATE TABLE had an inline (unnamed) CHECK on role.
-- PostgreSQL auto-names it 'profiles_role_check'. We drop it and replace it
-- with an updated version that includes 'owner' and 'finance'.
-- Running this migration twice is safe (IF EXISTS guards throughout).

-- 1. Drop ALL existing role check constraints (named and auto-named variants)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Find and drop any check constraint on the profiles.role column
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname  = 'profiles'
      AND con.contype  = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- 2. Add updated role constraint with all four roles
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'sales', 'finance'));

-- 3. Add status column if it doesn't already exist
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'pending', 'inactive'));

-- 4. Index for status lookups
CREATE INDEX IF NOT EXISTS profiles_status_idx ON profiles (status);

-- Done.
