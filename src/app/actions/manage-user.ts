'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'

async function assertAdmin() {
  const me = await requireAuth()
  if (me.role !== 'admin') throw new Error('No autorizado')
}

export async function deleteUserAction(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    const db = getSupabaseClient()
    // Delete auth user (profiles row will cascade if FK is set; also delete explicitly)
    const { error: authErr } = await db.auth.admin.deleteUser(userId)
    if (authErr) return { ok: false, error: authErr.message }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('profiles') as any).delete().eq('id', userId)
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error eliminando usuario' }
  }
}

export async function updateUserAction(
  userId: string,
  name: string,
  role: 'admin' | 'sales',
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    const db = getSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db.from('profiles') as any)
      .update({ full_name: name.trim() || null, role })
      .eq('id', userId)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error actualizando usuario' }
  }
}

export async function reinviteUserAction(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    const db = getSupabaseClient()
    const { error } = await db.auth.admin.inviteUserByEmail(email)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error reenviando invitación' }
  }
}
