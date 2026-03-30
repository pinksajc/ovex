'use server'

import { revalidatePath } from 'next/cache'
import { logEvent } from '@/lib/supabase/events'

export async function markSentForSignatureAction(
  dealId: string,
  configId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { markProposalSentForSignature } = await import('@/lib/supabase/proposals')
    await markProposalSentForSignature(dealId, configId)
    void logEvent('proposal_sent_for_signature', dealId)
    revalidatePath(`/deals/${dealId}/propuesta`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
