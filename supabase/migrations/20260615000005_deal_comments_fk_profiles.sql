-- Re-point deal_comments.user_id FK from auth.users → profiles
-- so PostgREST can resolve the profiles(name) embed in queries.
ALTER TABLE deal_comments
  DROP CONSTRAINT IF EXISTS deal_comments_user_id_fkey;

ALTER TABLE deal_comments
  ADD CONSTRAINT deal_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
