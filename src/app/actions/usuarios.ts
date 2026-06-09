'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/auth'

async function assertAdminOrOwner() {
  const me = await requireAuth()
  if (me.role !== 'admin' && me.role !== 'owner') throw new Error('No autorizado')
  return me
}

// ── Invite ────────────────────────────────────────────────────────────────────

export async function inviteUserAction(
  name: string,
  email: string,
  role: UserRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminOrOwner()

    const db = getSupabaseClient()
    const appUrl =
      process.env.APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const { data, error: inviteError } = await db.auth.admin.inviteUserByEmail(email.trim(), {
      data: { full_name: name.trim() || email.split('@')[0] },
      redirectTo: appUrl,
    })

    if (inviteError || !data.user) {
      return { ok: false, error: inviteError?.message ?? 'Error enviando invitación' }
    }

    // Upsert profile with role and status='pending' (will flip to 'active' on first login)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (db.from('profiles') as any).upsert({
      id: data.user.id,
      email: email.trim(),
      full_name: name.trim() || email.split('@')[0],
      role,
      status: 'pending',
    })

    if (profileError) return { ok: false, error: profileError.message }

    revalidatePath('/usuarios')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

// ── Update role ───────────────────────────────────────────────────────────────

export async function updateUserRoleAction(
  targetId: string,
  newRole: UserRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const me = await assertAdminOrOwner()

    // Nobody can change an owner's role
    const db = getSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: target } = await (db.from('profiles') as any)
      .select('role')
      .eq('id', targetId)
      .single()

    if (target?.role === 'owner') {
      return { ok: false, error: 'El rol owner no se puede modificar' }
    }
    // Only owner can assign the 'owner' role (edge case — blocked for now)
    if (newRole === 'owner' && me.role !== 'owner') {
      return { ok: false, error: 'Solo el owner puede asignar el rol owner' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db.from('profiles') as any)
      .update({ role: newRole })
      .eq('id', targetId)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/usuarios')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error actualizando rol' }
  }
}

// ── Update status (activate / deactivate) ─────────────────────────────────────

export async function updateUserStatusAction(
  targetId: string,
  status: 'active' | 'inactive',
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const me = await assertAdminOrOwner()

    const db = getSupabaseClient()
    // Can't deactivate an owner
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: target } = await (db.from('profiles') as any)
      .select('role')
      .eq('id', targetId)
      .single()

    if (target?.role === 'owner') {
      return { ok: false, error: 'No se puede desactivar al owner' }
    }
    // Admin can't deactivate another admin (only owner can)
    if (me.role === 'admin' && target?.role === 'admin') {
      return { ok: false, error: 'Solo el owner puede desactivar a un admin' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db.from('profiles') as any)
      .update({ status })
      .eq('id', targetId)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/usuarios')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error actualizando estado' }
  }
}

// ── Delete user ───────────────────────────────────────────────────────────────

export async function deleteUsuarioAction(
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const me = await assertAdminOrOwner()

    // Only owner can delete anyone; admin can't delete
    if (me.role !== 'owner') {
      return { ok: false, error: 'Solo el owner puede eliminar usuarios' }
    }
    if (me.id === targetId) {
      return { ok: false, error: 'No puedes eliminarte a ti mismo' }
    }

    const db = getSupabaseClient()

    // Verify target is not owner
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: target } = await (db.from('profiles') as any)
      .select('role')
      .eq('id', targetId)
      .single()
    if (target?.role === 'owner') {
      return { ok: false, error: 'No se puede eliminar al owner' }
    }

    await db.auth.admin.signOut(targetId, 'global').catch(() => undefined)
    const { error } = await db.auth.admin.deleteUser(targetId)
    if (error) return { ok: false, error: error.message }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('profiles') as any).delete().eq('id', targetId)

    revalidatePath('/usuarios')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error eliminando usuario' }
  }
}

// ── Reinvite ──────────────────────────────────────────────────────────────────

export async function reinviteAction(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminOrOwner()

    const db = getSupabaseClient()
    const appUrl =
      process.env.APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const { error } = await db.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: appUrl },
    })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error reenviando invitación' }
  }
}
