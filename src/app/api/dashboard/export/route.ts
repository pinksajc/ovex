// GET /api/dashboard/export
// Returns a CSV with deal data separated by service type (ROS / REN / Whispr / Otros)

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

const STAGE_LABELS: Record<string, string> = {
  prospecting:   'Prospecting',
  qualified:     'Qualified',
  proposal_sent: 'Propuesta enviada',
  negotiation:   'Negociación',
  closed_won:    'Cerrado ganado',
  closed_lost:   'Cerrado perdido',
  rejected:      'Rechazado',
}

function detectServiceType(lineItems: Array<{ serviceId?: string; type?: string }>): string {
  const ids = lineItems.filter((l) => l.type === 'line').map((l) => l.serviceId ?? '')
  const hasRos    = ids.some((id) => id.startsWith('ros'))
  const hasRen    = ids.some((id) => id === 'ren')
  const hasWhispr = ids.some((id) => id.startsWith('whispr'))
  const types: string[] = []
  if (hasRos)    types.push('ROS')
  if (hasRen)    types.push('REN')
  if (hasWhispr) types.push('Whispr')
  return types.length > 0 ? types.join(' + ') : 'Otros'
}

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields
    .map((f) => {
      const s = f == null ? '' : String(f)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    })
    .join(',')
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { getDeals } = await import('@/lib/deals')
  const { getLocationCountsByDeal } = await import('@/lib/supabase/company-locations')
  const { getPresupuestos } = await import('@/lib/supabase/presupuestos')

  const [deals, allPresupuestos, locationMap] = await Promise.all([
    getDeals(user),
    getPresupuestos(),
    getLocationCountsByDeal((await getDeals(user)).map((d) => d.id)).catch(() => new Map<string, number>()),
  ])

  // Build a map: dealId → all presupuestos
  const pByDeal = new Map<string, typeof allPresupuestos>()
  for (const p of allPresupuestos) {
    if (!p.dealId) continue
    const arr = pByDeal.get(p.dealId) ?? []
    arr.push(p)
    pByDeal.set(p.dealId, arr)
  }

  const STATUS_PRIORITY: Record<string, number> = { accepted: 0, sent: 1, draft: 2 }

  // Build rows — one row per independent offer chain per deal
  const rows: string[] = []

  // Header
  rows.push(csvRow([
    'Tipo servicio', 'Empresa', 'Marca', 'Ciudad', 'Localizaciones',
    'Estado deal', 'Comercial',
    'Nº oferta', 'Estado oferta',
    'Importe total (IVA)', 'Fijo/mes (IVA)', '¿Variable?',
    'Fecha oferta',
  ]))

  for (const deal of deals) {
    const locs = locationMap.get(deal.id) ?? 0
    const presupuestos = pByDeal.get(deal.id) ?? []

    // Group by version chain and pick best per chain
    const chains = new Map<string, typeof allPresupuestos[0]>()
    for (const p of presupuestos) {
      const root = p.parentId ?? p.id
      const existing = chains.get(root)
      const pPri = STATUS_PRIORITY[p.status] ?? 99
      const exPri = existing ? (STATUS_PRIORITY[existing.status] ?? 99) : 99
      if (!existing || pPri < exPri) chains.set(root, p)
    }

    if (chains.size === 0) {
      // Deal with no offers — still include it
      rows.push(csvRow([
        '', deal.company.name, deal.company.brandName ?? '', deal.company.city ?? '', locs,
        STAGE_LABELS[deal.stage] ?? deal.stage, deal.owner,
        '', '', '', '', '', '',
      ]))
      continue
    }

    for (const p of chains.values()) {
      const serviceType = detectServiceType(p.lineItems as Array<{ serviceId?: string; type?: string }>)
      const vatMult = 1 + 21 / 100
      const fixedMonthly = p.lineItems
        .filter((l) => l.type === 'line' && !['ros_starter_variable','ros_growth_variable','ros_pro_variable','ren','addon_delivery_adic_start','addon_delivery_adic_go','addon_delivery_adic_pro','datafono'].includes((l as {serviceId?: string}).serviceId ?? ''))
        .reduce((s, l) => s + ((l as {amount?: number}).amount ?? 0), 0) * vatMult
      const hasVariable = p.lineItems.some((l) =>
        l.type === 'line' && ['ros_starter_variable','ros_growth_variable','ros_pro_variable','ren','addon_delivery_adic_start','addon_delivery_adic_go','addon_delivery_adic_pro','datafono'].includes((l as {serviceId?: string}).serviceId ?? '')
      )

      rows.push(csvRow([
        serviceType,
        deal.company.name,
        deal.company.brandName ?? '',
        deal.company.city ?? '',
        locs,
        STAGE_LABELS[deal.stage] ?? deal.stage,
        deal.owner,
        p.number,
        p.status,
        p.amountTotal.toFixed(2),
        fixedMonthly.toFixed(2),
        hasVariable ? 'Sí' : 'No',
        p.createdAt ? p.createdAt.slice(0, 10) : '',
      ]))
    }
  }

  const csv = rows.join('\n')
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dashboard-${date}.csv"`,
    },
  })
}
