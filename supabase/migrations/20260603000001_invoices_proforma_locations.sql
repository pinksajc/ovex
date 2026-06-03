-- ⚠️ Run manually in Supabase SQL Editor
-- Adds proforma support (company_locations, location_id, due_date_enabled, converted_from_id)

-- 1 — Company locations table
CREATE TABLE IF NOT EXISTS company_locations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id     uuid        REFERENCES deals(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  address     text,
  cost_center text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE company_locations DISABLE ROW LEVEL SECURITY;

-- 2 — New columns on invoices
-- NOTE: 'type' column already exists (ordinary/rectificativa). New value 'proforma' works as-is.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS location_id      uuid        REFERENCES company_locations(id),
  ADD COLUMN IF NOT EXISTS due_date_enabled boolean     DEFAULT true,
  ADD COLUMN IF NOT EXISTS converted_from_id uuid       REFERENCES invoices(id);

-- 3 — New status value 'converted' works as-is (text column, no enum constraint).
-- 4 — No enum to update; type and status are plain text columns.
