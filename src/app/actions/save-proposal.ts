'use server'

import { saveProposal } from '@/lib/deals'
import { revalidatePath } from 'next/cache'
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
  try {
    const { proposal, persisted } = await saveProposal(attioDealId, configId, sections)
    revalidatePath(`/deals/${attioDealId}/propuesta`)
    return { ok: true, persisted, updatedAt: proposal.updatedAt }
  } catch (err) {
    return {
      ok: false,
      persisted: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}
