'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { setActiveConfig } from '@/lib/deals'

export async function activateVersionAction(
  dealId: string,
  configId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await setActiveConfig(dealId, configId)
    revalidatePath(`/deals/${dealId}/configurador`)
    revalidateTag('attio-deals', 'max')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}
