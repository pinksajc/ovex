// GET /api/presupuestos/generate-pdf?id={ofertaId}
// Renders the standard oferta PDF (not the Sales Deck) and returns it as application/pdf.

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { getPresupuesto } = await import('@/lib/supabase/presupuestos')
    const presupuesto = await getPresupuesto(id)
    if (!presupuesto) return NextResponse.json({ error: 'Oferta not found' }, { status: 404 })

    // Fetch deal contact name for the signature block pre-fill
    let contactName: string | undefined
    if (presupuesto.dealId) {
      try {
        const { getDeal } = await import('@/lib/deals')
        const deal = await getDeal(presupuesto.dealId)
        contactName = deal?.contact?.name ?? undefined
      } catch { /* non-fatal — signature block will leave Nombre blank */ }
    }

    const { generatePresupuestoPdf } = await import('@/lib/pdf/presupuesto')
    const pdfBuffer = await generatePresupuestoPdf(presupuesto, { contactName })

    const slug = presupuesto.clientName.replace(/[^A-Za-z0-9-]/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')
    const filename = `oferta-${slug || 'cliente'}.pdf`

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('[presupuestos/generate-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 }
    )
  }
}
