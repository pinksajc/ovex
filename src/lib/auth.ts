// =========================================
// AUTH HELPERS — server-only
// Always call from server components / actions.
// Never import in client components.
// =========================================

import { cookies } from 'next/headers'
import { createAuthServerClient } from '@/lib/supabase/auth'
import { getSupabaseClient } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'sales'

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
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
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
  const isAdminByEnv = adminEmails.length > 0 && adminEmails.includes(email.toLowerCase())

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
    console.log('[getCurrentUser] role-only fallback:', { userId: authUser.id, row: minProfile, status: s2 })
    if (minProfile) profile = minProfile
  }

  console.log('[getCurrentUser] resolved profile:', {
    userId: authUser.id,
    email,
    raw_role: profile?.role ?? null,
    raw_full_name: profile?.full_name ?? null,
    raw_must_change_password: profile?.must_change_password ?? null,
    profile_is_null: profile === null,
    primaryHttpStatus: s1,
  })

  if (!profile) {
    // Row genuinely missing — auto-create.
    // ON CONFLICT DO NOTHING so a row with a manually-set role is never overwritten.
    console.error('[getCurrentUser] profile row not found — auto-creating.', { userId: authUser.id, email })

    const autoRole = isAdminByEnv ? 'admin' : 'sales'
    try {
      const db = getSupabaseClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (db.from('profiles') as any).upsert(
        { id: authUser.id, email, full_name: derivedName, role: autoRole },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      console.log('[getCurrentUser] auto-create result:', { autoRole, upsertError: upsertError ?? null })
    } catch (err) {
      console.error('[getCurrentUser] auto-create threw:', err)
    }

    return {
      id: authUser.id,
      email,
      name: derivedName,
      role: isAdminByEnv ? 'admin' : autoRole,
      mustChangePassword: false,
    }
  }

  return {
    id: authUser.id,
    email,
    name: profile.full_name ?? derivedName,
    // ADMIN_EMAIL always wins over whatever is stored in the DB
    role: isAdminByEnv ? 'admin' : ((profile.role as UserRole) ?? 'sales'),
    mustChangePassword: profile.must_change_password === true,
  }
}

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
}

/**
 * Fetch all workspace members with email + login status (uses auth.admin API).
 * Admin-only.
 */
export async function getWorkspaceMembersAdmin(): Promise<WorkspaceMember[]> {
  try {
    const db = getSupabaseClient()

    const [{ data: authData }, profilesRes] = await Promise.all([
      db.auth.admin.listUsers({ perPage: 1000 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db.from('profiles').select('id, full_name, role') as any) as Promise<{
        data: Array<{ id: string; full_name: string | null; role: string }> | null
        error: unknown
      }>,
    ])

    const authMap = new Map(
      (authData?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email ?? '',
        lastSignIn: u.last_sign_in_at ?? null,
      })).map((u) => [u.id, u])
    )

    return (profilesRes.data ?? []).map((p) => {
      const auth = authMap.get(p.id)
      return {
        id: p.id,
        email: auth?.email ?? '',
        name: p.full_name,
        role: p.role as UserRole,
        hasLoggedIn: !!auth?.lastSignIn,
      }
    })
  } catch {
    return []
  }
}
