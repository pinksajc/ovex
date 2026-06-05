-- ⚠️ Run manually in Supabase SQL Editor
-- Adds versioning columns to presupuestos table for offer version chains

ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES presupuestos(id);
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS version int DEFAULT 1;
