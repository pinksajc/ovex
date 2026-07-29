-- ⚠️ Run manually in Supabase SQL Editor
-- Adds individual loan tracking: a `cashflow_loans` table and a `loan_id`
-- column on `cashflow_transactions` so each Préstamos movement can be grouped
-- under a named loan with its own outstanding balance.

CREATE TABLE IF NOT EXISTS cashflow_loans (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text        NOT NULL,
  counterparty text        NOT NULL,
  -- 'lent'     = Platomico lent to the counterparty (they owe us)
  -- 'borrowed' = the counterparty lent to Platomico (we owe them)
  direction    text        NOT NULL DEFAULT 'lent' CHECK (direction IN ('lent','borrowed')),
  notes        text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE cashflow_loans DISABLE ROW LEVEL SECURITY;

ALTER TABLE cashflow_transactions
  ADD COLUMN IF NOT EXISTS loan_id uuid REFERENCES cashflow_loans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_loan_id
  ON cashflow_transactions(loan_id);
