// =========================================
// AUTH HELPERS — server-only
// Always call from server components / actions.
// Never import in client components.
// =========================================

import { cache } from 'react'
import { cookies } from 'next/headers'
import { createAuthServerClient } from '@/lib/supabase/auth'
import { getSupabaseClient } from '@/lib/supabase/client'

export type UserRole = 'owner' | 'admin' | 'growth_manager' | 'sales' | 'finance'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  /** true when the user must change their password before using the app */
  mustChangePassword: boolean
}

/**
 * Returns the current authenticated user with their role.
 * Returns null ONLY when the user is genuinely not authenticated.
 * Never returns null due to DB / profile errors — falls back to role='sales'.
 *
 * Wrapped with React.cache so multiple RSC calls within the same render tree
 * (e.g. layout + page both calling getCurrentUser) share one result.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<AuthUser | null> {
  // ── Env guard ──────────────────────────────────────────────────────────────
  try {
    const { getAuthEnv } = await import('@/lib/supabase/auth-env')
    if (!getAuthEnv().ok) return null
  } catch {
    return null
  }

  // ── Session check — only null if genuinely not logged in ──────────────────
  let authUser: { id: string; email: string | undefined; user_metadata: Record<string, unknown> } | null = null
  try {
    const cookieStore = await cookies()
    const supabase = createAuthServerClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null   // ← only legitimate null: no session
    authUser = { id: user.id, email: user.email, user_metadata: user.user_metadata ?? {} }
  } catch {
    return null  // auth client itself failed — treat as not authenticated
  }

  // ── Profile lookup — fallback gracefully if DB not ready ──────────────────
  const email = authUser.email ?? ''
  const derivedName = (authUser.user_metadata?.name as string | undefined) ?? email.split('@')[0]

  // ADMIN_EMAIL env var: comma-separated list of emails that are always admin.
  // Useful to bootstrap the first admin without touching the DB directly.
  // Example: ADMIN_EMAIL=antonio@platomico.com
  const adminEmails = (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  // OWNER_EMAIL env var: highest-privilege role — can access /cashflow and all admin areas.
  // Falls back to ADMIN_EMAIL when unset, so existing admin users automatically become owners.
  // Example: OWNER_EMAIL=antonio@platomico.com
  const ownerEmails = (process.env.OWNER_EMAIL ?? process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  const isOwnerByEnv = ownerEmails.length > 0 && ownerEmails.includes(email.toLowerCase())
  // Admin check only for users that are in ADMIN_EMAIL but NOT in ownerEmails
  const isAdminByEnv = !isOwnerByEnv && adminEmails.length > 0 && adminEmails.includes(email.toLowerCase())

  // ── OWNER_EMAIL bypass — skip DB entirely ─────────────────────────────────
  if (isOwnerByEnv) {
    return {
      id: authUser.id,
      email,
      name: (authUser.user_metadata?.full_name as string | undefined) ?? derivedName,
      role: 'owner',
      mustChangePassword: false,
    }
  }

  // ── ADMIN_EMAIL bypass — skip DB entirely ─────────────────────────────────
  if (isAdminByEnv) {
    return {
      id: authUser.id,
      email,
      name: (authUser.user_metadata?.full_name as string | undefined) ?? derivedName,
      role: 'admin',
      mustChangePassword: false,
    }
  }

  // ── Profile lookup via raw PostgREST fetch (cache: 'no-store') ───────────────
  // Using fetch directly instead of the Supabase SDK so that Next.js's fetch
  // cache is explicitly bypassed. The SDK goes through the same global fetch,
  // and without cache:'no-store' a cached 'sales' response can persist even
  // after the DB row is updated to 'admin'.
  //
  // Two-step: try full columns first; if 4xx (column missing in prod), retry
  // with role-only so schema drift never hides an admin's role.
  const supabaseUrl  = process.env.SUPABASE_URL
  const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  type ProfileRow = { role: string; full_name?: string | null; must_change_password?: boolean | null }

  async function fetchProfile(select: string): Promise<{ row: ProfileRow | null; status: number }> {
    if (!supabaseUrl || !supabaseKey) return { row: null, status: 0 }
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${authUser!.id}&select=${select}&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      )
      if (!res.ok) return { row: null, status: res.status }
      const rows = (await res.json()) as ProfileRow[]
      return { row: rows[0] ?? null, status: res.status }
    } catch (e) {
      console.error('[getCurrentUser] fetch error:', e)
      return { row: null, status: -1 }
    }
  }

  // Primary: all columns
  let { row: profile, status: s1 } = await fetchProfile('role,full_name,must_change_password')

  // Fallback: role only (if primary errored — e.g. column doesn't exist yet in production)
  if (!profile && s1 !== 200) {
    const { row: minProfile, status: s2 } = await fetchProfile('role')
    if (minProfile) profile = minProfile
  }

  if (!profile) {
    // Row genuinely missing — auto-create.
    // ON CONFLICT DO NOTHING so a row with a manually-set role is never overwritten.
    console.error('[getCurrentUser] profile row not found — auto-creating.', { userId: authUser.id, email })

    const autoRole = isOwnerByEnv ? 'owner' : isAdminByEnv ? 'admin' : 'sales'
    try {
      const db = getSupabaseClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (db.from('profiles') as any).upsert(
        { id: authUser.id, email, full_name: derivedName, role: autoRole },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    } catch (err) {
      console.error('[getCurrentUser] auto-create threw:', err)
    }

    return {
      id: authUser.id,
      email,
      name: derivedName,
      role: isOwnerByEnv ? 'owner' : isAdminByEnv ? 'admin' : autoRole,
      mustChangePassword: false,
    }
  }

  return {
    id: authUser.id,
    email,
    name: profile.full_name ?? derivedName,
    // Env-var overrides always win over whatever is stored in the DB
    role: isOwnerByEnv ? 'owner' : isAdminByEnv ? 'admin' : ((profile.role as UserRole) ?? 'sales'),
    mustChangePassword: profile.must_change_password === true,
  }
})

/**
 * Returns current user or throws. Use in protected server actions.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('No autorizado')
  return user
}

/**
 * Fetch all workspace members (for owner-assign UI — lightweight, no auth.admin).
 */
export async function getWorkspaceMembers(): Promise<AuthUser[]> {
  try {
    const db = getSupabaseClient()
    const { data } = await db
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name') as { data: Array<{ id: string; full_name: string | null; role: string }> | null; error: unknown }
    return (data ?? []).map((r) => ({
      id: r.id,
      email: '',
      name: r.full_name,
      role: r.role as UserRole,
      mustChangePassword: false,
    }))
  } catch {
    return []
  }
}

export interface WorkspaceMember {
  id: string
  email: string
  name: string | null
  role: UserRole
  /** true if the user has completed their first sign-in */
  hasLoggedIn: boolean
  /** active | pending (invited, not yet signed in) | inactive (manually disabled) */
  status: 'active' | 'pending' | 'inactive'
  createdAt: string | null
}

/**
 * Fetch all workspace members with email + login status (uses auth.admin API).
 * Iterates over Auth users as the source of truth, so users without a profiles
 * row are also returned (and their row is auto-created).
 * Admin-only.
 */
export async function getWorkspaceMembersAdmin(): Promise<WorkspaceMember[]> {
  try {
    const db = getSupabaseClient()

    // ── Env-var role overrides (same logic as getCurrentUser) ─────────────────
    const ownerEmails = (process.env.OWNER_EMAIL ?? process.env.ADMIN_EMAIL ?? '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    const adminEmails = (process.env.ADMIN_EMAIL ?? '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    function envRole(email: string): UserRole | null {
      const e = email.toLowerCase()
      if (ownerEmails.includes(e)) return 'owner'
      if (adminEmails.includes(e)) return 'admin'
      return null
    }

    const [{ data: authData }, profilesRes] = await Promise.all([
      db.auth.admin.listUsers({ perPage: 1000 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db.from('profiles').select('id, full_name, role, status, created_at') as any) as Promise<{
        data: Array<{ id: string; full_name: string | null; role: string; status?: string | null; created_at?: string | null }> | null
        error: unknown
      }>,
    ])

    const authUsers = authData?.users ?? []
    const profileMap = new Map(
      (profilesRes.data ?? []).map((p) => [p.id, p])
    )

    // Auto-upsert profiles for any Auth user that has no row yet
    const missing = authUsers.filter((u) => !profileMap.has(u.id))
    if (missing.length > 0) {
      const rows = missing.map((u) => {
        const email = u.email ?? ''
        const role: UserRole = envRole(email) ?? 'sales'
        const name = (u.user_metadata?.full_name as string | undefined)
          ?? (u.user_metadata?.name as string | undefined)
          ?? email.split('@')[0]
        return { id: u.id, email, full_name: name, role, status: 'active' }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted } = await (db.from('profiles') as any)
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
        .select('id, full_name, role, status, created_at') as {
          data: Array<{ id: string; full_name: string | null; role: string; status?: string | null; created_at?: string | null }> | null
        }
      for (const p of inserted ?? []) {
        profileMap.set(p.id, p)
      }
      // Fallback: if upsert didn't return data, insert synthetic rows from `rows`
      for (const r of rows) {
        if (!profileMap.has(r.id)) {
          profileMap.set(r.id, { id: r.id, full_name: r.full_name, role: r.role, status: r.status, created_at: null })
        }
      }
    }

    // Build result list from Auth users (source of truth for membership)
    return authUsers.map((u) => {
      const email = u.email ?? ''
      const profile = profileMap.get(u.id)
      const hasLoggedIn = !!u.last_sign_in_at

      // Env-var role always wins
      const role: UserRole = envRole(email) ?? ((profile?.role as UserRole) ?? 'sales')

      // status: 'pending' if never logged in; else DB value; fallback 'active'
      const dbStatus = (profile?.status ?? 'active') as string
      const status: WorkspaceMember['status'] = !hasLoggedIn
        ? 'pending'
        : dbStatus === 'inactive'
        ? 'inactive'
        : 'active'

      const name = profile?.full_name
        ?? (u.user_metadata?.full_name as string | undefined)
        ?? (u.user_metadata?.name as string | undefined)
        ?? null

      return {
        id: u.id,
        email,
        name,
        role,
        hasLoggedIn,
        status,
        createdAt: profile?.created_at ?? u.created_at ?? null,
      }
    })
  } catch (err) {
    console.error('[getWorkspaceMembersAdmin]', err)
    return []
  }
}
