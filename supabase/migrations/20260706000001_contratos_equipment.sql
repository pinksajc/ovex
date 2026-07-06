-- Add equipment JSONB column to contratos table
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS equipment jsonb;
