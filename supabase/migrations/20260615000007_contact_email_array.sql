-- Add multi-email support to contact_overrides.
-- The first element mirrors the existing single `email` column for backwards compat.
ALTER TABLE contact_overrides ADD COLUMN IF NOT EXISTS emails TEXT[];
