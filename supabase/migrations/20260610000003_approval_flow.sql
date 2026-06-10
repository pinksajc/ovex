-- ============================================================
-- Approval flow columns for presupuestos and invoices
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS approval_type   TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS approved_by     UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notes  TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS approval_type   TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS approved_by     UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notes  TEXT;

-- Non-draft documents are already in flight — mark them approved so they
-- don't flood the gestiones queue.
UPDATE presupuestos SET approval_status = 'approved' WHERE status <> 'draft';
UPDATE invoices      SET approval_status = 'approved' WHERE status <> 'draft';

-- Indexes for the gestiones queue query
CREATE INDEX IF NOT EXISTS presupuestos_approval_status_idx ON presupuestos (approval_status);
CREATE INDEX IF NOT EXISTS invoices_approval_status_idx     ON invoices     (approval_status);
