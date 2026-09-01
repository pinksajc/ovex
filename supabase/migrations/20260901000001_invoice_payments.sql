-- ============================================================
-- invoice_payments: tracks partial (or full) payments on invoices
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_payments (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID         NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at      DATE         NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_by   UUID         REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_id_idx
  ON invoice_payments(invoice_id);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_invoice_payments"
  ON invoice_payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
