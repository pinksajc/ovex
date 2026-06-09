-- Migration: create contratos table
-- Run this in the Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS contratos (
  id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id           UUID         REFERENCES deals(id) ON DELETE SET NULL,
  presupuesto_id    UUID         NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  duracion_meses    INTEGER      NOT NULL DEFAULT 12,
  permanencia_meses INTEGER      NOT NULL DEFAULT 12,
  forma_pago        TEXT         NOT NULL DEFAULT 'Transferencia bancaria',
  fecha_inicio      DATE         NOT NULL,
  notas             TEXT
);

-- Index for common query pattern
CREATE INDEX IF NOT EXISTS contratos_presupuesto_id_idx ON contratos (presupuesto_id);
CREATE INDEX IF NOT EXISTS contratos_deal_id_idx        ON contratos (deal_id);

-- RLS: match existing tables (service role bypasses; authenticated users can read their own)
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by server-side code)
CREATE POLICY "Service role full access" ON contratos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
