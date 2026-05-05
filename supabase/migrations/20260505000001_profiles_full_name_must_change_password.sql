-- Migration: align profiles table with application expectations
--
-- The app code uses:
--   profiles.full_name          — display name (schema.sql had 'name')
--   profiles.must_change_password — force password reset for new users
--
-- Without these columns getCurrentUser() query fails silently, profile is
-- treated as missing, and the auto-create path overwrites any existing role
-- with the default 'sales' — breaking admin users on every sign-in.
--
-- Safe to run multiple times (IF NOT EXISTS / idempotent DO block).

-- ── full_name ──────────────────────────────────────────────────────────────────
-- Rename the legacy 'name' column if full_name does not yet exist.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'full_name'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'profiles'
        and column_name  = 'name'
    ) then
      alter table profiles rename column name to full_name;
    else
      alter table profiles add column full_name text;
    end if;
  end if;
end $$;

-- ── must_change_password ───────────────────────────────────────────────────────
alter table profiles
  add column if not exists must_change_password boolean not null default false;

-- ── handle_new_user trigger — use full_name ────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
