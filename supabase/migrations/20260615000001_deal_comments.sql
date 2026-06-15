CREATE TABLE IF NOT EXISTS deal_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('call', 'email', 'meeting', 'whatsapp', 'other')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deal_comments_deal_id_idx ON deal_comments(deal_id);
ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON deal_comments FOR ALL TO service_role USING (true) WITH CHECK (true);
