'use server'

import { getActiveConfigForDeal } from '@/lib/supabase/configs'
import type { DealConfiguration } from '@/types'

export async function getActiveConfigAction(
  dealId: string,
): Promise<{ ok: boolean; data?: DealConfiguration; error?: string }> {
  if (!dealId) return { ok: true, data: undefined }
  try {
    const config = await getActiveConfigForDeal(dealId)
    return { ok: true, data: config ?? undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
