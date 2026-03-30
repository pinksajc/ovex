// POST /api/docuseal/send
// Programmatic endpoint to trigger a DocuSeal submission.
// The UI calls the server action directly; this route is for external integrations.

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { dealId, configId, signerName, signerEmail } = (await req.json()) as {
      dealId: string
      configId: string
      signerName: string
      signerEmail: string
    }

    if (!dealId || !configId || !signerName || !signerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { markSentForSignatureAction } = await import('@/app/actions/mark-sent')
    const result = await markSentForSignatureAction(dealId, configId, signerName, signerEmail)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
