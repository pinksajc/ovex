-- ✅ Ejecutado directamente vía REST API (2026-06-04)
-- Recategoriza las transacciones de Smashburger de 'Préstamos' → 'Préstamos dados'
-- (quedaron mal tras el split Préstamos→Préstamos recibidos/dados porque la función
--  apply_cashflow_wildcards() solo actúa sobre 'Sin categoría')
-- 4 filas afectadas: "To Smashburger SL — Pago Parcial Prestamo de Platomico a Smashburger"

UPDATE cashflow_transactions
SET category = 'Préstamos dados'
WHERE category = 'Préstamos'
  AND description ILIKE '%smashburger%';
