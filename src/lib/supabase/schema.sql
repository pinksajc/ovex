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

-- =========================================
-- AUTH — profiles + deal_owners
-- Ejecutar después de activar Supabase Auth
-- =========================================

-- Profiles: extiende auth.users con role y nombre
create table if not exists profiles (
  id     uuid primary key references auth.users(id) on delete cascade,
  email  text not null,
  name   text,
  role   text not null default 'sales' check (role in ('admin', 'sales')),
  created_at timestamptz not null default now()
);

-- Auto-crear perfil al registrar usuario
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Deal ownership: attio_deal_id → owner (usuario de Supabase)
create table if not exists deal_owners (
  attio_deal_id text primary key,
  owner_id      uuid references profiles(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  assigned_by   uuid references profiles(id) on delete set null
);

create index if not exists deal_owners_owner_id_idx on deal_owners (owner_id);

-- RLS desactivado — acceso vía service role
alter table profiles    disable row level security;
alter table deal_owners disable row level security;

-- =========================================
-- PROPOSALS — propuestas comerciales
-- Una por (deal, config). Cada versión de
-- config tiene su propio borrador.
-- =========================================

create table if not exists proposals (
  id                      text primary key default gen_random_uuid()::text,
  attio_deal_id           text not null,
  config_id               text not null,
  sections                jsonb not null default '{}',
  sent_for_signature_at   timestamptz,
  docuseal_submission_id  text,
  docuseal_status         text,
  signed_at               timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (attio_deal_id, config_id)
);

create index if not exists proposals_attio_deal_id_idx
  on proposals (attio_deal_id);

create index if not exists proposals_config_id_idx
  on proposals (config_id);

create index if not exists proposals_docuseal_submission_id_idx
  on proposals (docuseal_submission_id)
  where docuseal_submission_id is not null;

-- RLS desactivado — acceso vía service role
alter table proposals disable row level security;

-- Si la tabla ya existía sin la constraint, añadirla:
-- ALTER TABLE proposals ADD CONSTRAINT proposals_attio_deal_id_config_id_key UNIQUE (attio_deal_id, config_id);
