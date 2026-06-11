// GET /api/ofertas/generate-pdf?id={ofertaId}
// Renders an oferta PDF server-side and returns it as application/pdf.

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    // Auth guard
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { getPresupuesto } = await import('@/lib/supabase/presupuestos')
    const presupuesto = await getPresupuesto(id)
    if (!presupuesto) return NextResponse.json({ error: 'Oferta not found' }, { status: 404 })

    const { generateSalesDeckPdf } = await import('@/lib/pdf/sales-deck')
    const pdfBuffer = await generateSalesDeckPdf(presupuesto)

    const slug = presupuesto.number.replace(/[^A-Za-z0-9-]/g, '-').toLowerCase()
    const filename = `oferta-${slug}.pdf`

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('[ofertas/generate-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 }
    )
  }
}
