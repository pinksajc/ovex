-- Add gmail_message_id for cron deduplication
ALTER TABLE deal_comments ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS deal_comments_gmail_message_id_idx
  ON deal_comments(gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;
