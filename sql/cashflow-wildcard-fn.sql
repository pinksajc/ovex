-- =============================================================================
-- apply_cashflow_wildcards()
-- Applies wildcard ILIKE rules to cashflow_transactions rows that are still
-- categorised as 'Sin categoría'.  Returns total rows updated.
-- Run in Supabase SQL editor before using the recategorize button.
--
-- Re-running is safe: every UPDATE is filtered by category = 'Sin categoría'
-- so already-categorised rows are never touched.
-- =============================================================================

CREATE OR REPLACE FUNCTION apply_cashflow_wildcards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total integer := 0;
  n     integer := 0;
BEGIN

  -- ── Nómina ──────────────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Nómina'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%casanova%'          OR
    description ILIKE '%camila%carbonell%'  OR
    description ILIKE '%camila%betania%'    OR
    description ILIKE '%diego%prada%'       OR
    description ILIKE '%daniel%sanchez%'    OR
    description ILIKE '%daniel%s_nchez%'    OR  -- handles ñ → _ variants
    description ILIKE '%daniel%marin%'      OR
    description ILIKE '%daniel%mar_n%'      OR
    description ILIKE '%daniel%'            OR  -- broad catch for "To Daniel …"
    description ILIKE '%david%mella%'       OR
    description ILIKE '%federico%maza%'     OR
    description ILIKE '%carlos%bautista%'   OR
    description ILIKE '%sergio%cerro%'      OR
    description ILIKE '%yolgelis%'          OR
    description ILIKE '%luijavier%'         OR
    description ILIKE '%luniel%'            OR
    description ILIKE '%romulo%'            OR
    description ILIKE '%michael%arismendi%' OR
    description ILIKE '%marco%davis%'       OR
    description ILIKE '%luis%lucena%'       OR
    description ILIKE '%bruno%passarelli%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Hardware ─────────────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Hardware'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%humberto%fernandez%'  OR
    description ILIKE '%grover%'              OR
    description ILIKE '%stripe%'              OR
    description ILIKE '%pccomponentes%'       OR
    description ILIKE '%pc box%'              OR
    description ILIKE '%refurbed%'            OR
    description ILIKE '%unibox%'              OR
    description ILIKE '%3d-informatik%'       OR
    description ILIKE '%alibaba%'             OR
    description ILIKE '%movilsupport%'        OR
    description ILIKE '%reparacion%express%'  OR
    description ILIKE '%sq%square%shop%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Préstamos ────────────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Préstamos'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%smashburger%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Administrativo ───────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Administrativo'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%inversiones%toribio%' OR
    description ILIKE '%gacimartin%'          OR
    description ILIKE '%soler%lluch%'         OR
    description ILIKE '%slack%'               OR
    description ILIKE '%revolut%fee%'         OR
    description ILIKE '%linkedin%'            OR
    description ILIKE '%gm integra%'          OR
    description ILIKE '%merlin properties%'   OR
    description ILIKE '%cash at banco%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Impuestos ────────────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Impuestos'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%tesoreria%general%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Oficina ──────────────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Oficina'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%inmobiliaria%lares%'  OR
    description ILIKE '%wallapop%'            OR
    description ILIKE '%mallorca%'            OR
    description ILIKE '%rodilla%'             OR
    description ILIKE '%pastel%crema%'        OR
    description ILIKE '%pinks%madrid%'        OR
    description ILIKE '%sq%blend%'            OR
    description ILIKE '%sq%luna%'             OR
    description ILIKE '%super bazar%'         OR
    description ILIKE '%mp*%'                    -- Revolut "Mp**dia…" / "Mp*wallapop…"
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Viajes ───────────────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Viajes'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%licencia%'        OR
    description ILIKE '%taxi%'            OR
    description ILIKE '%metro barcelona%' OR
    description ILIKE '%parking pita%'    OR
    description ILIKE '%sq%deleito%'      OR
    description ILIKE '%sq%kevabro%'      OR
    description ILIKE '%sq%mr.dawalter%'  OR
    description ILIKE '%sq%maash%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Ingreso cliente ──────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Ingreso cliente'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%red ops%'   OR
    description ILIKE '%micanopy%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Traspaso interno ─────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Traspaso interno'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%platomico%'   OR
    description ILIKE '%savings%eur%' OR
    description ILIKE '%main%eur%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Herramientas IA ──────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Herramientas IA'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%openai%'      OR
    description ILIKE '%outscraper%'  OR
    description ILIKE '%lovable%'     OR
    description ILIKE '%elevenlabs%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Comunicaciones ───────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Comunicaciones'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%telefonica%' OR
    description ILIKE '%twilio%'     OR
    description ILIKE '%rinkel%'     OR
    description ILIKE '%resend%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Base de datos (compound pattern before broad vercel) ─────────────────────
  UPDATE cashflow_transactions SET category = 'Base de datos'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%vercel%supabase%' OR
    description ILIKE '%supabase%'        OR
    description ILIKE '%redis%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Servidores/Hosting ───────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Servidores/Hosting'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%vercel%'  OR
    description ILIKE '%aws%'     OR
    description ILIKE '%railway%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Refunds ──────────────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Refunds'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%refund%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  -- ── Otros ────────────────────────────────────────────────────────────────────
  UPDATE cashflow_transactions SET category = 'Otros'
  WHERE category = 'Sin categoría' AND (
    description ILIKE '%amazon%'         OR
    description ILIKE '%rugvista%'       OR
    description ILIKE '%obm alcobendas%' OR
    description ILIKE '%lm nuevos%'
  );
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  RETURN total;
END;
$$;
