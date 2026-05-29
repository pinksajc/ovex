-- =============================================================================
-- Migration: add reference column + update apply_cashflow_wildcards()
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Add reference column (stores the Revolut "Reference" CSV field)
ALTER TABLE cashflow_transactions
  ADD COLUMN IF NOT EXISTS reference text;

-- 2. Add new devolución/reembolso rules (idempotent)
INSERT INTO cashflow_category_rules (description_pattern, category) VALUES
  ('%reembolso%prestamo%', 'Préstamos dados'),
  ('%reembolso sergio%',   'Préstamos dados')
ON CONFLICT (description_pattern) DO NOTHING;

-- 3. Recreate apply_cashflow_wildcards() to also match on reference
-- (full function body — safe to re-run)
CREATE OR REPLACE FUNCTION apply_cashflow_wildcards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total integer := 0;
  n     integer := 0;
BEGIN

  UPDATE cashflow_transactions SET category = 'Nómina'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%casanova%'          OR reference ILIKE '%casanova%'          OR
    description ILIKE '%camila%carbonell%'  OR reference ILIKE '%camila%carbonell%'  OR
    description ILIKE '%camila%betania%'    OR reference ILIKE '%camila%betania%'    OR
    description ILIKE '%diego%prada%'       OR reference ILIKE '%diego%prada%'       OR
    description ILIKE '%daniel%sanchez%'    OR reference ILIKE '%daniel%sanchez%'    OR
    description ILIKE '%daniel%s_nchez%'    OR reference ILIKE '%daniel%s_nchez%'    OR
    description ILIKE '%daniel%marin%'      OR reference ILIKE '%daniel%marin%'      OR
    description ILIKE '%daniel%mar_n%'      OR reference ILIKE '%daniel%mar_n%'      OR
    description ILIKE '%daniel%'            OR reference ILIKE '%daniel%'            OR
    description ILIKE '%david%mella%'       OR reference ILIKE '%david%mella%'       OR
    description ILIKE '%federico%maza%'     OR reference ILIKE '%federico%maza%'     OR
    description ILIKE '%carlos%bautista%'   OR reference ILIKE '%carlos%bautista%'   OR
    description ILIKE '%sergio%cerro%'      OR reference ILIKE '%sergio%cerro%'      OR
    description ILIKE '%yolgelis%'          OR reference ILIKE '%yolgelis%'          OR
    description ILIKE '%luijavier%'         OR reference ILIKE '%luijavier%'         OR
    description ILIKE '%luniel%'            OR reference ILIKE '%luniel%'            OR
    description ILIKE '%romulo%'            OR reference ILIKE '%romulo%'            OR
    description ILIKE '%michael%arismendi%' OR reference ILIKE '%michael%arismendi%' OR
    description ILIKE '%marco%davis%'       OR reference ILIKE '%marco%davis%'       OR
    description ILIKE '%luis%lucena%'       OR reference ILIKE '%luis%lucena%'       OR
    description ILIKE '%bruno%passarelli%'  OR reference ILIKE '%bruno%passarelli%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Hardware'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%humberto%fernandez%'  OR reference ILIKE '%humberto%fernandez%'  OR
    description ILIKE '%grover%'              OR reference ILIKE '%grover%'              OR
    description ILIKE '%stripe%'              OR reference ILIKE '%stripe%'              OR
    description ILIKE '%pccomponentes%'       OR reference ILIKE '%pccomponentes%'       OR
    description ILIKE '%pc box%'              OR reference ILIKE '%pc box%'              OR
    description ILIKE '%refurbed%'            OR reference ILIKE '%refurbed%'            OR
    description ILIKE '%unibox%'              OR reference ILIKE '%unibox%'              OR
    description ILIKE '%3d-informatik%'       OR reference ILIKE '%3d-informatik%'       OR
    description ILIKE '%alibaba%'             OR reference ILIKE '%alibaba%'             OR
    description ILIKE '%movilsupport%'        OR reference ILIKE '%movilsupport%'        OR
    description ILIKE '%reparacion%express%'  OR reference ILIKE '%reparacion%express%'  OR
    description ILIKE '%sq%square%shop%'      OR reference ILIKE '%sq%square%shop%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Préstamos dados'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%smashburger%'         OR reference ILIKE '%smashburger%'         OR
    description ILIKE '%devolución préstamo%' OR reference ILIKE '%devolución préstamo%' OR
    description ILIKE '%devolucion prestamo%' OR reference ILIKE '%devolucion prestamo%' OR
    description ILIKE '%reembolso%prestamo%'  OR reference ILIKE '%reembolso%prestamo%'  OR
    description ILIKE '%reembolso sergio%'    OR reference ILIKE '%reembolso sergio%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Administrativo'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%inversiones%toribio%' OR reference ILIKE '%inversiones%toribio%' OR
    description ILIKE '%gacimartin%'          OR reference ILIKE '%gacimartin%'          OR
    description ILIKE '%soler%lluch%'         OR reference ILIKE '%soler%lluch%'         OR
    description ILIKE '%slack%'               OR reference ILIKE '%slack%'               OR
    description ILIKE '%revolut%fee%'         OR reference ILIKE '%revolut%fee%'         OR
    description ILIKE '%linkedin%'            OR reference ILIKE '%linkedin%'            OR
    description ILIKE '%gm integra%'          OR reference ILIKE '%gm integra%'          OR
    description ILIKE '%merlin properties%'   OR reference ILIKE '%merlin properties%'   OR
    description ILIKE '%cash at banco%'       OR reference ILIKE '%cash at banco%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Impuestos'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%tesoreria%general%' OR reference ILIKE '%tesoreria%general%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Oficina'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%inmobiliaria%lares%'  OR reference ILIKE '%inmobiliaria%lares%'  OR
    description ILIKE '%wallapop%'            OR reference ILIKE '%wallapop%'            OR
    description ILIKE '%mallorca%'            OR reference ILIKE '%mallorca%'            OR
    description ILIKE '%rodilla%'             OR reference ILIKE '%rodilla%'             OR
    description ILIKE '%pastel%crema%'        OR reference ILIKE '%pastel%crema%'        OR
    description ILIKE '%pinks%madrid%'        OR reference ILIKE '%pinks%madrid%'        OR
    description ILIKE '%sq%blend%'            OR reference ILIKE '%sq%blend%'            OR
    description ILIKE '%sq%luna%'             OR reference ILIKE '%sq%luna%'             OR
    description ILIKE '%super bazar%'         OR reference ILIKE '%super bazar%'         OR
    description ILIKE '%mp*%'                 OR reference ILIKE '%mp*%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Viajes'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%licencia%'        OR reference ILIKE '%licencia%'        OR
    description ILIKE '%taxi%'            OR reference ILIKE '%taxi%'            OR
    description ILIKE '%metro barcelona%' OR reference ILIKE '%metro barcelona%' OR
    description ILIKE '%parking pita%'    OR reference ILIKE '%parking pita%'    OR
    description ILIKE '%sq%deleito%'      OR reference ILIKE '%sq%deleito%'      OR
    description ILIKE '%sq%kevabro%'      OR reference ILIKE '%sq%kevabro%'      OR
    description ILIKE '%sq%mr.dawalter%'  OR reference ILIKE '%sq%mr.dawalter%'  OR
    description ILIKE '%sq%maash%'        OR reference ILIKE '%sq%maash%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Ingreso cliente'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%red ops%'   OR reference ILIKE '%red ops%'   OR
    description ILIKE '%micanopy%'  OR reference ILIKE '%micanopy%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Traspaso interno'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%platomico%'   OR reference ILIKE '%platomico%'   OR
    description ILIKE '%savings%eur%' OR reference ILIKE '%savings%eur%' OR
    description ILIKE '%main%eur%'    OR reference ILIKE '%main%eur%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Herramientas IA'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%openai%'      OR reference ILIKE '%openai%'      OR
    description ILIKE '%outscraper%'  OR reference ILIKE '%outscraper%'  OR
    description ILIKE '%lovable%'     OR reference ILIKE '%lovable%'     OR
    description ILIKE '%elevenlabs%'  OR reference ILIKE '%elevenlabs%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Comunicaciones'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%telefonica%' OR reference ILIKE '%telefonica%' OR
    description ILIKE '%twilio%'     OR reference ILIKE '%twilio%'     OR
    description ILIKE '%rinkel%'     OR reference ILIKE '%rinkel%'     OR
    description ILIKE '%resend%'     OR reference ILIKE '%resend%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Base de datos'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%vercel%supabase%' OR reference ILIKE '%vercel%supabase%' OR
    description ILIKE '%supabase%'        OR reference ILIKE '%supabase%'        OR
    description ILIKE '%redis%'           OR reference ILIKE '%redis%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Servidores/Hosting'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%vercel%'  OR reference ILIKE '%vercel%'  OR
    description ILIKE '%aws%'     OR reference ILIKE '%aws%'     OR
    description ILIKE '%railway%' OR reference ILIKE '%railway%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Refunds'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%refund%' OR reference ILIKE '%refund%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE cashflow_transactions SET category = 'Otros'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%amazon%'         OR reference ILIKE '%amazon%'         OR
    description ILIKE '%rugvista%'       OR reference ILIKE '%rugvista%'       OR
    description ILIKE '%obm alcobendas%' OR reference ILIKE '%obm alcobendas%' OR
    description ILIKE '%lm nuevos%'      OR reference ILIKE '%lm nuevos%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  RETURN total;
END;
$$;
