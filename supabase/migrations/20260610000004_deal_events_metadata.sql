-- Add metadata JSONB column to deal_events for approval event details
-- (actor name, document number, notes)

ALTER TABLE deal_events
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
