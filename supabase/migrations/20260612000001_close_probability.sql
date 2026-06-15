ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS close_probability INTEGER DEFAULT 25
  CHECK (close_probability IN (0, 25, 50, 75, 100));
