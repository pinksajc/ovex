'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { updateDealOwner } from '@/lib/supabase/deals'

export async function updateOwnerAction(
  dealId: string,
  ownerId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dealId) return { ok: false, error: 'dealId requerido' }
  try {
    await requireAuth()
    await updateDealOwner(dealId, ownerId)
    revalidateTag('attio-deals', 'max')
    revalidatePath(`/deals/${dealId}`)
    revalidatePath('/deals')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error actualizando owner',
    }
  }
}
