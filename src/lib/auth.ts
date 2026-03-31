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

  try {
    const db = getSupabaseClient()
    let { data: profile } = await db
      .from('profiles')
      .select('role, name')
      .eq('id', authUser.id)
      .maybeSingle() as { data: { role: string; name: string | null } | null; error: unknown }

    if (!profile) {
      // Auto-create profile (user created via Supabase dashboard, trigger may not exist)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.from('profiles') as any).upsert({
        id: authUser.id,
        email,
        name: derivedName,
        role: 'sales',
      })
      profile = { role: 'sales', name: derivedName }
    }

    return {
      id: authUser.id,
      email,
      name: profile.name ?? derivedName,
      role: (profile.role as UserRole) ?? 'sales',
    }
  } catch {
    // profiles table not migrated yet or other DB error — return user with defaults
    // so the app is still usable
    return {
      id: authUser.id,
      email,
      name: derivedName,
      role: 'sales',
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
 * Fetch all workspace members (for admin assign UI).
 */
export async function getWorkspaceMembers(): Promise<AuthUser[]> {
  try {
    const db = getSupabaseClient()
    const { data } = await db
      .from('profiles')
      .select('id, email, name, role')
      .order('name') as { data: Array<{ id: string; email: string; name: string | null; role: string }> | null; error: unknown }
    return (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role as UserRole,
    }))
  } catch {
    return []
  }
}
