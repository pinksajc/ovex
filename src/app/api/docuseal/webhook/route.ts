// POST /api/docuseal/webhook
// Receives DocuSeal event notifications and updates Supabase accordingly.
//
// Setup in DocuSeal:
//   Settings → Webhooks → Add webhook
//   URL: https://your-domain.com/api/docuseal/webhook
//   Events: submission.completed, submission.declined, submission.expired
//   Secret: copy value → set as DOCUSEAL_WEBHOOK_SECRET env var
//
// Env vars:
//   DOCUSEAL_WEBHOOK_SECRET — HMAC-SHA256 secret (optional, strongly recommended)

import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { DocuSealWebhookPayload } from '@/lib/docuseal/client'
import { logEvent } from '@/lib/supabase/events'

export async function POST(req: Request) {
  const body = await req.text()

  // ── Signature verification ──────────────────────────────────────────────
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('[docuseal-webhook] DOCUSEAL_WEBHOOK_SECRET not set — rejecting request')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }
  if (secret) {
    const sig = req.headers.get('x-docuseal-signature') ?? ''
    const { verifyDocuSealWebhook } = await import('@/lib/docuseal/client')
    const valid = await verifyDocuSealWebhook(secret, body, sig).catch(() => false)
    if (!valid) {
      console.warn('[docuseal-webhook] invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  // ── Parse ───────────────────────────────────────────────────────────────
  let payload: DocuSealWebhookPayload
  try {
    payload = JSON.parse(body) as DocuSealWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event_type, data } = payload
  const submissionId = String(data.id)
  const dealId = data.submitters?.[0]?.metadata?.deal_id as string | undefined

  console.log(`[docuseal-webhook] event=${event_type} submission=${submissionId} deal=${dealId ?? '?'}`)

  const {
    markProposalSignedByDocuSeal,
    updateProposalDocuSealStatus,
  } = await import('@/lib/supabase/proposals')

  // ── Route by event type ─────────────────────────────────────────────────
  switch (event_type) {

    case 'submission.completed': {
      const result = await markProposalSignedByDocuSeal(submissionId).catch((err: unknown) => {
        console.error('[docuseal-webhook] markProposalSignedByDocuSeal failed:', err)
        return { updated: false }
      })
      if (result.updated) {
        console.log(`[docuseal-webhook] signed → submission=${submissionId}`)
        if (dealId) {
          void logEvent('proposal_signed', dealId)
          revalidatePath(`/deals/${dealId}`)
          revalidatePath(`/deals/${dealId}/propuesta`)
          revalidatePath('/deals')
          revalidateTag('attio-deals', 'max')
        }
      } else {
        console.log(`[docuseal-webhook] submission=${submissionId} not found or already completed — no-op`)
      }
      break
    }

    case 'submission.declined': {
      // Extract decline reason — DocuSeal may send it at top-level or inside the submitter
      const declineReason: string | null =
        data.decline_message
        ?? data.submitters?.find(s => s.decline_message)?.decline_message
        ?? null

      const result = await updateProposalDocuSealStatus(submissionId, 'declined', declineReason).catch((err: unknown) => {
        console.error('[docuseal-webhook] updateStatus(declined) failed:', err)
        return { updated: false }
      })
      console.log(`[docuseal-webhook] declined → submission=${submissionId} reason="${declineReason ?? 'none'}" updated=${result.updated}`)

      // Update deal stage to 'rejected'
      if (dealId) {
        try {
          const { updateDealStage } = await import('@/lib/supabase/deals')
          await updateDealStage(dealId, 'rejected')
          console.log(`[docuseal-webhook] deal=${dealId} stage → rejected`)
          void logEvent('proposal_declined', dealId)
          revalidatePath(`/deals/${dealId}`)
          revalidatePath(`/deals/${dealId}/propuesta`)
          revalidatePath('/deals')
          revalidateTag('attio-deals', 'max')
        } catch (err) {
          console.error('[docuseal-webhook] updateDealStage(rejected) failed:', err)
        }
      }
      break
    }

    case 'submission.expired': {
      const result = await updateProposalDocuSealStatus(submissionId, 'expired').catch((err: unknown) => {
        console.error('[docuseal-webhook] updateStatus(expired) failed:', err)
        return { updated: false }
      })
      console.log(`[docuseal-webhook] expired → submission=${submissionId} updated=${result.updated}`)
      break
    }

    case 'submission.created': {
      // DocuSeal fires this when we POST /submissions — status is already 'pending' in DB.
      // Refresh to 'pending' in case the row was somehow out of sync.
      await updateProposalDocuSealStatus(submissionId, 'pending').catch(() => null)
      console.log(`[docuseal-webhook] created (pending) → submission=${submissionId}`)
      break
    }

    default:
      console.log(`[docuseal-webhook] unhandled event_type=${event_type} — ignored`)
  }

  // Always return 200 so DocuSeal does not retry unnecessarily
  return NextResponse.json({ received: true })
}
