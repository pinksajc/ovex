-- ⚠️ Run manually in Supabase SQL Editor
-- Creates cashflow_categories table and seeds existing categories

CREATE TABLE IF NOT EXISTS cashflow_categories (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text        UNIQUE NOT NULL,
  color      text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cashflow_categories DISABLE ROW LEVEL SECURITY;

-- Seed with existing categories (matches cashflow-categories.ts + Préstamos split)
INSERT INTO cashflow_categories (name, color) VALUES
  ('Sin categoría',      '#94a3b8'),
  ('Ingreso cliente',    '#22c55e'),
  ('Nómina',             '#ef4444'),
  ('Hardware',           '#f97316'),
  ('Administrativo',     '#6366f1'),
  ('Impuestos',          '#eab308'),
  ('Préstamos recibidos','#3b82f6'),
  ('Préstamos dados',    '#f43f5e'),
  ('Oficina',            '#8b5cf6'),
  ('Viajes',             '#06b6d4'),
  ('Servidores/Hosting', '#14b8a6'),
  ('Base de datos',      '#0ea5e9'),
  ('Herramientas IA',    '#a855f7'),
  ('Comunicaciones',     '#ec4899'),
  ('Marketing',          '#f59e0b'),
  ('Otras herramientas', '#64748b'),
  ('Traspaso interno',   '#94a3b8'),
  ('Refunds',            '#10b981'),
  ('Otros',              '#6b7280')
ON CONFLICT (name) DO NOTHING;
