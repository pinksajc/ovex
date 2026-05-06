-- =========================================
-- ORVEX — Complete schema (safe to run on a fresh OR existing Supabase project)
-- Every statement uses IF NOT EXISTS / idempotent patterns.
-- Run this in: Supabase Dashboard → SQL Editor
-- =========================================

-- ── profiles ──────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null default '',
  full_name            text,
  role                 text not null default 'sales' check (role in ('admin', 'sales')),
  must_change_password boolean not null default false,
  created_at           timestamptz not null default now()
);

alter table profiles add column if not exists email                text not null default '';
alter table profiles add column if not exists full_name            text;
alter table profiles add column if not exists must_change_password boolean not null default false;

alter table profiles disable row level security;

-- ── handle_new_user trigger ────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── deals ─────────────────────────────────────────────────────────────────────
create table if not exists deals (
  id                  uuid primary key default gen_random_uuid(),
  company_name        text not null,
  brand_name          text,
  company_cif         text,
  company_address     text,
  company_city        text,
  contact_first_name  text,
  contact_last_name   text,
  contact_email       text,
  contact_phone       text,
  stage               text not null default 'prospecting',
  owner_id            uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table deals add column if not exists brand_name    text;
alter table deals add column if not exists company_cif   text;
alter table deals add column if not exists company_address text;
alter table deals add column if not exists company_city  text;

create index if not exists deals_owner_id_idx    on deals (owner_id);
create index if not exists deals_stage_idx       on deals (stage);
create index if not exists deals_created_at_idx  on deals (created_at desc);

alter table deals disable row level security;

-- ── deal_owners (legacy Attio-era mapping; kept for fallback) ─────────────────
create table if not exists deal_owners (
  attio_deal_id text primary key,
  owner_id      uuid references profiles(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  assigned_by   uuid references profiles(id) on delete set null
);

create index if not exists deal_owners_owner_id_idx on deal_owners (owner_id);

alter table deal_owners disable row level security;

-- ── deal_configurations ───────────────────────────────────────────────────────
create table if not exists deal_configurations (
  id                          text primary key default gen_random_uuid()::text,
  attio_deal_id               text not null,
  version                     integer not null,
  label                       text,
  daily_orders_per_location   integer not null,
  locations                   integer not null,
  average_ticket              numeric(10, 2) not null,
  estimated_growth_percent    numeric(5, 2) not null default 0,
  plan                        text not null check (plan in ('starter', 'growth', 'pro')),
  plan_overridden             boolean not null default false,
  active_addons               text[] not null default '{}',
  hardware                    jsonb not null default '[]',
  economics                   jsonb not null,
  is_active                   boolean not null default false,
  created_at                  timestamptz not null default now(),
  unique (attio_deal_id, version)
);

create index if not exists deal_configurations_attio_deal_id_idx
  on deal_configurations (attio_deal_id);

create index if not exists deal_configurations_active_idx
  on deal_configurations (attio_deal_id, is_active)
  where is_active = true;

alter table deal_configurations disable row level security;

-- ── proposals ─────────────────────────────────────────────────────────────────
create table if not exists proposals (
  id                      text primary key default gen_random_uuid()::text,
  attio_deal_id           text not null,
  config_id               text not null,
  sections                jsonb not null default '{}',
  sent_for_signature_at   timestamptz,
  docuseal_submission_id  text,
  docuseal_status         text,
  signed_at               timestamptz,
  decline_reason          text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (attio_deal_id, config_id)
);

-- Add decline_reason if missing (added after initial release)
alter table proposals add column if not exists decline_reason text;

create index if not exists proposals_attio_deal_id_idx      on proposals (attio_deal_id);
create index if not exists proposals_config_id_idx          on proposals (config_id);
create index if not exists proposals_docuseal_submission_id_idx
  on proposals (docuseal_submission_id)
  where docuseal_submission_id is not null;

alter table proposals disable row level security;

-- ── deal_events ───────────────────────────────────────────────────────────────
create table if not exists deal_events (
  id         uuid primary key default gen_random_uuid(),
  deal_id    text not null,
  event_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists deal_events_deal_id_idx    on deal_events (deal_id);
create index if not exists deal_events_event_type_idx on deal_events (event_type);
create index if not exists deal_events_created_at_idx on deal_events (created_at desc);

alter table deal_events disable row level security;

-- ── contact_overrides ─────────────────────────────────────────────────────────
create table if not exists contact_overrides (
  attio_deal_id text primary key,
  first_name    text,
  last_name     text,
  email         text,
  updated_at    timestamptz not null default now()
);

alter table contact_overrides disable row level security;

-- ── invoices ──────────────────────────────────────────────────────────────────
create table if not exists invoices (
  id             uuid primary key default gen_random_uuid(),
  number         text not null unique,
  type           text not null default 'ordinary',  -- 'ordinary' | 'rectificativa'
  deal_id        text,                              -- references deals.id (text for compatibility)
  client_name    text not null,
  client_cif     text,
  client_address text,
  concept        text not null default '',
  line_items     jsonb not null default '[]',
  amount_net     numeric(12, 2) not null default 0,
  vat_rate       numeric(5, 2) not null default 21,
  amount_total   numeric(12, 2) not null default 0,
  status         text not null default 'draft',    -- 'draft' | 'issued' | 'paid' | 'overdue'
  issued_at      timestamptz,
  due_at         timestamptz,
  rectifies_id   uuid references invoices(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists invoices_deal_id_idx    on invoices (deal_id);
create index if not exists invoices_status_idx     on invoices (status);
create index if not exists invoices_created_at_idx on invoices (created_at desc);

alter table invoices disable row level security;

-- ── presupuestos ──────────────────────────────────────────────────────────────
create table if not exists presupuestos (
  id           uuid primary key default gen_random_uuid(),
  number       text not null unique,
  deal_id      text,
  client_name  text not null,
  client_cif   text,
  client_address text,
  line_items   jsonb not null default '[]',
  amount_net   numeric(12, 2) not null default 0,
  vat_rate     numeric(5, 2) not null default 21,
  amount_total numeric(12, 2) not null default 0,
  status       text not null default 'draft',      -- 'draft' | 'sent' | 'accepted' | 'rejected'
  valid_until  date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists presupuestos_deal_id_idx    on presupuestos (deal_id);
create index if not exists presupuestos_status_idx     on presupuestos (status);
create index if not exists presupuestos_created_at_idx on presupuestos (created_at desc);

alter table presupuestos disable row level security;
