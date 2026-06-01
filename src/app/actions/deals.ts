'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { deleteDeals } from '@/lib/supabase/deals'

function assertOwner(role: string) {
  if (role !== 'owner' && role !== 'admin') throw new Error('No autorizado')
}

export interface BulkDeleteDealsResult {
  ok: boolean
  deleted?: number
  error?: string
}

export async function bulkDeleteDealsAction(
  ids: string[],
): Promise<BulkDeleteDealsResult> {
  if (ids.length === 0) return { ok: true, deleted: 0 }
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await deleteDeals(ids)
    revalidatePath('/deals')
    return { ok: true, deleted: ids.length }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}
