-- Migration: Enable RLS on deal tables with admin-bypass SELECT policies
--
-- deal_configurations and deal_owners previously used service-role-only access.
-- This migration enables RLS and adds SELECT policies so that:
--   - A user with profiles.role = 'admin' can see all rows
--   - A regular user can see only rows tied to deals they own (via deal_owners)
--
-- profiles has RLS disabled, so the role lookup is always unfiltered.
-- INSERT / UPDATE / DELETE are intentionally left without policies
-- (those paths still require the service role key from the server).

-- ── deal_owners ────────────────────────────────────────────────────────────────

alter table deal_owners enable row level security;

create policy "deal_owners_select"
  on deal_owners
  for select
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
    or owner_id = auth.uid()
  );

-- ── deal_configurations ────────────────────────────────────────────────────────
-- Ownership is resolved through deal_owners; the subquery is safe because
-- deal_owners' own SELECT policy lets the authenticated user see their rows.

alter table deal_configurations enable row level security;

create policy "deal_configurations_select"
  on deal_configurations
  for select
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
    or exists (
      select 1
      from deal_owners
      where deal_owners.attio_deal_id = deal_configurations.attio_deal_id
        and deal_owners.owner_id = auth.uid()
    )
  );
