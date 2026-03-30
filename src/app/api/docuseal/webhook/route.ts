// POST /api/docuseal/webhook
// Receives DocuSeal event notifications.
//
// Setup in DocuSeal:
//   Settings → Webhooks → Add webhook
//   URL: https://your-domain.com/api/docuseal/webhook
//   Events: submission.completed (minimum)
//   Secret: set DOCUSEAL_WEBHOOK_SECRET env var to the same value
//
// Env vars:
//   DOCUSEAL_WEBHOOK_SECRET — used for HMAC-SHA256 signature verification
//                             (optional but strongly recommended in production)

import { NextResponse } from 'next/server'
import type { DocuSealWebhookPayload } from '@/lib/docuseal/client'
import { logEvent } from '@/lib/supabase/events'

export async function POST(req: Request) {
  const body = await req.text()

  // Verify signature when secret is configured
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET
  if (secret) {
    const sig = req.headers.get('x-docuseal-signature') ?? ''
    const { verifyDocuSealWebhook } = await import('@/lib/docuseal/client')
    const valid = await verifyDocuSealWebhook(secret, body, sig).catch(() => false)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: DocuSealWebhookPayload
  try {
    payload = JSON.parse(body) as DocuSealWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event_type, data } = payload

  if (event_type === 'submission.completed') {
    const submissionId = String(data.id)

    try {
      const { markProposalSignedByDocuSeal } = await import('@/lib/supabase/proposals')
      await markProposalSignedByDocuSeal(submissionId)
    } catch (err) {
      console.error('[webhook] markProposalSignedByDocuSeal failed:', err)
      // Don't return 500 — DocuSeal will retry, causing duplicate events
    }

    // Find deal_id from submitter metadata to log event
    try {
      const dealId = data.submitters?.[0]?.metadata?.deal_id
      if (dealId) void logEvent('proposal_signed', dealId as string)
    } catch {
      // non-critical
    }
  }

  return NextResponse.json({ received: true })
}
