-- =========================================
-- Migración: corregir constraint proposals
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =========================================
--
-- Problema: la tabla proposals tenía UNIQUE(attio_deal_id) en lugar de
-- UNIQUE(attio_deal_id, config_id), lo que impedía guardar propuestas
-- cuando un deal tenía más de una versión de configuración.
--
-- Síntoma: "duplicate key value violates unique constraint proposals_attio_deal_id_key"
-- al intentar guardar una propuesta para cualquier versión distinta a la v1.

-- 1. Eliminar la constraint incorrecta
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_attio_deal_id_key;

-- 2. Añadir la constraint compuesta correcta (si no existe ya)
ALTER TABLE proposals
  ADD CONSTRAINT proposals_attio_deal_id_config_id_key
  UNIQUE (attio_deal_id, config_id);
