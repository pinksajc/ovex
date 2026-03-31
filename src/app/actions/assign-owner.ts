'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'

export async function assignDealOwnerAction(
  attioDealId: string,
  newOwnerId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    if (user.role !== 'admin') return { ok: false, error: 'Sin permisos' }

    const { setDealOwner } = await import('@/lib/supabase/deal-owners')
    await setDealOwner(attioDealId, newOwnerId, user.id)
    revalidatePath('/deals')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}
