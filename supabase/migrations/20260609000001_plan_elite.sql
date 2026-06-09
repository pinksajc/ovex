-- Add 'elite' tier to deal_configurations.plan CHECK constraint
-- and cashflow_transactions category list.
--
-- Run manually in Supabase Dashboard → SQL Editor.

-- 1. Drop the existing plan constraint and recreate with 'elite' included
ALTER TABLE deal_configurations
  DROP CONSTRAINT IF EXISTS deal_configurations_plan_check;

ALTER TABLE deal_configurations
  ADD CONSTRAINT deal_configurations_plan_check
    CHECK (plan IN ('starter', 'growth', 'pro', 'elite'));
