'use server'

import { revalidatePath } from 'next/cache'
import { logEvent } from '@/lib/supabase/events'

export interface SendForSignatureResult {
  ok: boolean
  /** DocuSeal submission ID — present when DocuSeal is configured */
  submissionId?: string
  /** Direct signing URL returned by DocuSeal */
  signerUrl?: string
  error?: string
}

/**
 * Sends the proposal for signature.
 *
 * When DOCUSEAL_TOKEN + DOCUSEAL_TEMPLATE_ID are set:
 *   → Creates a DocuSeal submission, saves submission_id, sets status = 'pending'.
 *   → DocuSeal sends the signing email to contact.email automatically.
 *
 * Otherwise (mock / no DocuSeal):
 *   → Falls back to marking sent_for_signature_at only.
 */
export async function markSentForSignatureAction(
  dealId: string,
  configId: string,
  signerName: string,
  signerEmail: string
): Promise<SendForSignatureResult> {
  try {
    const { isDocuSealConfigured, createDocuSealSubmission } = await import(
      '@/lib/docuseal/client'
    )

    if (isDocuSealConfigured()) {
      const { submissionId, signerUrl } = await createDocuSealSubmission({
        signerName,
        signerEmail,
        metadata: { deal_id: dealId, config_id: configId },
      })
      const { markProposalSentWithDocuSeal } = await import('@/lib/supabase/proposals')
      await markProposalSentWithDocuSeal(dealId, configId, submissionId)
      void logEvent('proposal_sent_for_signature', dealId)
      revalidatePath(`/deals/${dealId}/propuesta`)
      revalidatePath('/deals')
      return { ok: true, submissionId, signerUrl }
    }

    // Fallback: no DocuSeal configured
    const { markProposalSentForSignature } = await import('@/lib/supabase/proposals')
    await markProposalSentForSignature(dealId, configId)
    void logEvent('proposal_sent_for_signature', dealId)
    revalidatePath(`/deals/${dealId}/propuesta`)
    revalidatePath('/deals')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
