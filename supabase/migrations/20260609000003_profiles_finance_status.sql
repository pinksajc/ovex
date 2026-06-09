-- Migration: extend profiles table for finance role + status column
-- Run this in the Supabase Dashboard → SQL Editor

-- 1. Drop the old role constraint (if it exists) and recreate with all four roles
DO $$
BEGIN
  -- Drop existing check constraint on role (name may vary; try common names)
  BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_fkey;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Re-add role column with updated constraint
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'sales', 'finance'));

-- 2. Add status column if it doesn't already exist
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'pending', 'inactive'));

-- 3. Index for status lookups
CREATE INDEX IF NOT EXISTS profiles_status_idx ON profiles (status);

-- Done.
-- Note: existing rows with role='sales' remain unchanged.
-- Users with no matching role will fail the new constraint — review before running if needed.
