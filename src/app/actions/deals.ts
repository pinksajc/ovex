'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { deleteDeals, updateDealCloseProbability, updateDealStage } from '@/lib/supabase/deals'
import type { DealStage } from '@/types'

function assertOwner(role: string) {
  if (role !== 'owner' && role !== 'admin') throw new Error('No autorizado')
}

export async function updateStageAction(dealId: string, stage: DealStage): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAuth()
    await updateDealStage(dealId, stage)
    revalidatePath('/pipeline')
    revalidatePath('/deals')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateCloseProbabilityAction(dealId: string, value: number): Promise<void> {
  await requireAuth()
  if (![0, 25, 50, 75, 100].includes(value)) throw new Error('Invalid probability value')
  await updateDealCloseProbability(dealId, value)
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
