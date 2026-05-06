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

  try {
    const db = getSupabaseClient()

    type FullRow = { role: string; full_name: string | null; must_change_password: boolean | null }
    type MinRow  = { role: string }

    // ── Primary query — all columns we use ────────────────────────────────────
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('role, full_name, must_change_password')
      .eq('id', authUser.id)
      .maybeSingle() as { data: FullRow | null; error: { message: string; code?: string } | null }

    console.log('[getCurrentUser] raw profile query result:', {
      userId: authUser.id,
      email,
      raw_role: profile?.role ?? null,
      raw_full_name: profile?.full_name ?? null,
      raw_must_change_password: profile?.must_change_password ?? null,
      profile_is_null: profile === null,
      error: profileError ?? null,
    })

    // ── Fallback query — if full query failed (e.g. column missing in production)
    // retry with just `role` so schema drift never hides an admin's role ────────
    let resolvedProfile: FullRow | null = profile
    if (profileError && !profile) {
      console.warn('[getCurrentUser] full query failed, retrying with role-only query:', profileError.message)
      const { data: minProfile, error: minError } = await db
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .maybeSingle() as { data: MinRow | null; error: { message: string } | null }

      console.log('[getCurrentUser] role-only fallback result:', {
        userId: authUser.id,
        data: minProfile,
        error: minError ?? null,
      })

      if (!minError && minProfile) {
        resolvedProfile = { role: minProfile.role, full_name: null, must_change_password: null }
      }
    }

    if (!resolvedProfile) {
      // Row genuinely missing — auto-create with role='sales' as default.
      // ON CONFLICT DO NOTHING ensures we never overwrite an existing role.
      console.error('[getCurrentUser] profile row not found — auto-creating.', {
        userId: authUser.id,
        email,
        primaryError: profileError ?? null,
      })

      const autoRole = isAdminByEnv ? 'admin' : 'sales'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (db.from('profiles') as any).upsert(
        { id: authUser.id, email, full_name: derivedName, role: autoRole },
        { onConflict: 'id', ignoreDuplicates: true }
      )

      console.log('[getCurrentUser] auto-create upsert result:', { autoRole, upsertError: upsertError ?? null })

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
      name: resolvedProfile.full_name ?? derivedName,
      // ADMIN_EMAIL always wins over whatever is stored in the DB
      role: isAdminByEnv ? 'admin' : ((resolvedProfile.role as UserRole) ?? 'sales'),
      mustChangePassword: resolvedProfile.must_change_password === true,
    }
  } catch (err) {
    // Unexpected error (e.g. network, profiles table missing entirely) — still
    // return a usable session rather than crashing, but log it for diagnosis.
    console.error('[getCurrentUser] caught unexpected error fetching profile:', err)
    return {
      id: authUser.id,
      email,
      name: derivedName,
      role: isAdminByEnv ? 'admin' : 'sales',
      mustChangePassword: false,
    }
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
