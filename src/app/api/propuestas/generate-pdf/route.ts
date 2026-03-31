// POST /api/propuestas/generate-pdf
// Renders a proposal PDF server-side and returns it as application/pdf.
// Useful for "Download PDF" buttons that want the raw file.
//
// Body: { dealId: string, configId: string }

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { dealId, configId } = (await req.json()) as {
      dealId: string
      configId: string
    }

    if (!dealId || !configId) {
      return NextResponse.json({ error: 'dealId and configId required' }, { status: 400 })
    }

    const { getDeal, getActiveConfig, getProposal } = await import('@/lib/deals')
    const deal = await getDeal(dealId)
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const cfg = getActiveConfig(deal)
    if (!cfg) return NextResponse.json({ error: 'No active config' }, { status: 404 })

    const saved = await getProposal(dealId, configId)
    if (!saved) return NextResponse.json({ error: 'No saved proposal' }, { status: 404 })

    const { generateProposalPdf } = await import('@/lib/pdf/generate')
    const pdfBuffer = await generateProposalPdf(deal, cfg, saved.sections)

    const companySlug = deal.company.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const filename = `propuesta-${companySlug}-v${cfg.version}.pdf`

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('[generate-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 }
    )
  }
}
