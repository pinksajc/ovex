-- =========================================
-- PLATOMICO SALES — Supabase Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =========================================

-- Configuraciones de deals
-- Vinculadas por attio_deal_id (record_id de Attio)

create table if not exists deal_configurations (
  id                          text primary key default gen_random_uuid()::text,
  attio_deal_id               text not null,
  version                     integer not null,
  label                       text,

  -- Inputs del simulador
  daily_orders_per_location   integer not null,
  locations                   integer not null,
  average_ticket              numeric(10, 2) not null,
  estimated_growth_percent    numeric(5, 2) not null default 0,

  -- Plan
  plan                        text not null check (plan in ('starter', 'growth', 'pro')),
  plan_overridden             boolean not null default false,

  -- Add-ons y hardware (arrays/JSON)
  active_addons               text[] not null default '{}',
  hardware                    jsonb not null default '[]',

  -- Snapshot de economics al guardar
  economics                   jsonb not null,

  -- Control
  is_active                   boolean not null default false,
  created_at                  timestamptz not null default now(),

  -- Un único número de versión por deal
  unique (attio_deal_id, version)
);

-- Índices para queries frecuentes
create index if not exists deal_configurations_attio_deal_id_idx
  on deal_configurations (attio_deal_id);

create index if not exists deal_configurations_active_idx
  on deal_configurations (attio_deal_id, is_active)
  where is_active = true;

-- RLS: desactivado (acceso solo con service role desde servidor)
alter table deal_configurations disable row level security;
