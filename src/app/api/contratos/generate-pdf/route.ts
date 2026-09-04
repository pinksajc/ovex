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
    const equipmentRaw = searchParams.get('equipment')
    const equipment = equipmentRaw ? JSON.parse(decodeURIComponent(equipmentRaw)) : undefined
    // Optional explicit service-block override: ?services=ros,whispr,ren
    const servicesRaw = searchParams.get('services')
    const services = servicesRaw !== null
      ? (() => {
          const on = new Set(servicesRaw.split(',').map((s) => s.trim()).filter(Boolean))
          const keys = ['ros', 'posKiosk', 'whispr', 'analitica', 'equipos', 'ren'] as const
          return Object.fromEntries(keys.map((k) => [k, on.has(k)])) as Record<(typeof keys)[number], boolean>
        })()
      : undefined

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { getPresupuesto } = await import('@/lib/supabase/presupuestos')
    const presupuesto = await getPresupuesto(id)
    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto not found' }, { status: 404 })
    }

    // Load deal data — overrides presupuesto's client fields with latest deal info
    let contactName: string | null = null
    let contactEmail: string | null = null
    if (presupuesto.dealId) {
      const { getDealById } = await import('@/lib/supabase/deals')
      const { getContactOverridesForDeals } = await import('@/lib/supabase/contact-overrides')
      const [deal, overridesMap] = await Promise.all([
        getDealById(presupuesto.dealId).catch(() => null),
        getContactOverridesForDeals([presupuesto.dealId]).catch(() => new Map()),
      ])
      if (deal) {
        contactName  = deal.contact.name  || null
        contactEmail = deal.contact.email || null
        // Override presupuesto client fields with latest deal company data
        if (deal.company.name)    presupuesto.clientName    = deal.company.name
        if (deal.company.cif)     presupuesto.clientCif     = deal.company.cif
        if (deal.company.address) presupuesto.clientAddress = deal.company.address
      }
      // contact_overrides table takes precedence over deal row (user edits saved there)
      const override = overridesMap.get(presupuesto.dealId)
      if (override) {
        const overrideName = `${override.firstName} ${override.lastName}`.trim()
        if (overrideName) contactName = overrideName
        if (override.email) contactEmail = override.email
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
      equipment,
      services,
    })

    const slug = presupuesto.number.replace(/[^A-Za-z0-9-]/g, '-')
    const filename = `Contrato-${slug}.pdf`

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        // El contrato se regenera siempre con la plantilla vigente: nunca cachear (navegador ni CDN)
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
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
