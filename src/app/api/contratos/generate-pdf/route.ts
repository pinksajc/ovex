// GET /api/contratos/generate-pdf
//   ?id={presupuestoId}
//   &duracion=12            (meses)
//   &permanencia=12         (meses)
//   &pago=Transferencia%20bancaria
//   &inicio=2026-06-09      (YYYY-MM-DD)
//   &notas=...              (optional, URL-encoded)
//   &inline=1               (optional — Content-Disposition: inline instead of attachment)

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    // Auth guard
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id          = searchParams.get('id')
    const duracion    = Number(searchParams.get('duracion') ?? '12')
    const permanencia = Number(searchParams.get('permanencia') ?? '12')
    const pago        = searchParams.get('pago') ?? 'Transferencia bancaria'
    const inicio      = searchParams.get('inicio') ?? new Date().toISOString().split('T')[0]
    const notas       = searchParams.get('notas') ?? null
    const inline      = searchParams.get('inline') === '1'

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { getPresupuesto } = await import('@/lib/supabase/presupuestos')
    const presupuesto = await getPresupuesto(id)
    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto not found' }, { status: 404 })
    }

    // Load deal contact data if linked
    let contactName: string | null = null
    let contactEmail: string | null = null
    if (presupuesto.dealId) {
      const { getDealById } = await import('@/lib/supabase/deals')
      const deal = await getDealById(presupuesto.dealId).catch(() => null)
      if (deal) {
        contactName  = deal.contact.name  || null
        contactEmail = deal.contact.email || null
      }
    }

    const { generateContractPdf } = await import('@/lib/pdf/contract')
    const pdfBuffer = await generateContractPdf(presupuesto, {
      duracionMeses: isNaN(duracion) ? 12 : duracion,
      permanenciaMeses: isNaN(permanencia) ? 12 : permanencia,
      formaPago: pago,
      fechaInicio: inicio,
      notas,
      contactName,
      contactEmail,
    })

    const slug = presupuesto.number.replace(/[^A-Za-z0-9-]/g, '-')
    const filename = `Contrato-${slug}.pdf`

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('[contratos/generate-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 },
    )
  }
}
