// GET /api/debug/db-state
// Owner-only. Returns live state of profiles schema and trigger
// so you can verify migrations have been applied correctly.

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'

export async function GET() {
  // Owner-only guard
  try {
    const me = await requireAuth()
    if (me.role !== 'owner') {
      return NextResponse.json({ error: 'owner only' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = getSupabaseClient()

  // ── 1. Columns (via information_schema — available to service role) ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colsRes = await (db as any)
    .from('information_schema.columns')
    .select('column_name, data_type, column_default, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'profiles')
    .order('ordinal_position')

  // ── 2. Profiles sample (direct table query, always works) ──────────────────
  const profilesRes = await db
    .from('profiles')
    .select('id, role, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  // ── 3. Probe which columns exist by trying a select ───────────────────────
  const probeRes = await db.from('profiles').select('id, role').limit(1)
  const hasStatusProbe = await db
    .from('profiles')
    .select('id, status')
    .limit(1)

  // ── 4. Auth users count ────────────────────────────────────────────────────
  const { data: authData } = await db.auth.admin.listUsers({ perPage: 10 })

  return NextResponse.json({
    env: {
      SUPABASE_URL:  process.env.SUPABASE_URL
        ? process.env.SUPABASE_URL.slice(0, 45) + '…'
        : '❌ MISSING',
      SERVICE_KEY_SET: !!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY),
    },
    profiles_table: {
      columns_from_information_schema: colsRes?.data ?? `error: ${JSON.stringify(colsRes?.error)}`,
      status_column_exists: !hasStatusProbe.error,
      status_probe_error:   hasStatusProbe.error?.message ?? null,
      recent_rows:          profilesRes.data ?? [],
      recent_rows_error:    profilesRes.error?.message ?? null,
    },
    auth_users: {
      total: authData?.users?.length ?? 'error',
      sample: (authData?.users ?? []).slice(0, 3).map((u) => ({
        id: u.id,
        email: u.email,
        last_sign_in: u.last_sign_in_at,
      })),
    },
  })
}
