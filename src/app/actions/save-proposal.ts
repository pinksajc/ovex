'use server'

import { saveProposal } from '@/lib/deals'
import { revalidatePath, revalidateTag } from 'next/cache'
import { logEvent } from '@/lib/supabase/events'
import type { ProposalSections } from '@/types'

export interface SaveProposalResult {
  ok: boolean
  persisted: boolean
  updatedAt?: string
  error?: string
}

export async function saveProposalAction(
  attioDealId: string,
  configId: string,
  sections: ProposalSections
): Promise<SaveProposalResult> {
  console.log('[saveProposalAction] start', { attioDealId, configId })
  try {
    const { proposal, persisted } = await saveProposal(attioDealId, configId, sections)
    console.log('[saveProposalAction] ok', { persisted, updatedAt: proposal.updatedAt })
    revalidatePath(`/deals/${attioDealId}/propuesta`)
    revalidateTag('attio-deals', 'max')
    void logEvent('proposal_saved', attioDealId)
    return { ok: true, persisted, updatedAt: proposal.updatedAt }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[saveProposalAction] ERROR', {
      message,
      stack: err instanceof Error ? err.stack : undefined,
      attioDealId,
      configId,
      SUPABASE_URL: process.env.SUPABASE_URL ?? 'MISSING',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'set' : 'MISSING',
    })
    return {
      ok: false,
      persisted: false,
      error: message,
    }
  }
}
