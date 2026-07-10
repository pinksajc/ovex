// GET /api/reports/forecast
// Printable HTML forecast report: closed clients + pipeline 75%+ next 3 months

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { getDeals } = await import('@/lib/deals')
  const { getInvoices } = await import('@/lib/supabase/invoices')
  const { getPresupuestos } = await import('@/lib/supabase/presupuestos')
  const { getLocationCountsByDeal } = await import('@/lib/supabase/company-locations')

  const [deals, invoices, presupuestos] = await Promise.all([
    getDeals(user),
    getInvoices(),
    getPresupuestos(),
  ])

  const locationCountMap = await getLocationCountsByDeal(deals.map((d) => d.id)).catch(() => new Map<string, number>())

  const now = new Date()
  const todayStr = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── Closed clients ────────────────────────────────────────────────────────
  const closedDeals = deals.filter((d) => d.stage === 'closed_won')

  // Latest invoice per closed deal
  const latestInvByDeal = new Map<string, { amount: number; date: string; number: string }>()
  for (const inv of invoices) {
    if (!inv.dealId) continue
    const date = inv.issuedAt ?? inv.createdAt
    const existing = latestInvByDeal.get(inv.dealId)
    if ((inv.status === 'issued' || inv.status === 'paid') && (!existing || date > existing.date)) {
      latestInvByDeal.set(inv.dealId, { amount: inv.amountTotal, date, number: inv.number })
    }
  }

  // Latest accepted offer per closed deal (for contract start date)
  const acceptedOfferByDeal = new Map<string, { number: string; contractStartDate: string | null; amountTotal: number }>()
  for (const p of presupuestos) {
    if (!p.dealId || p.status !== 'accepted') continue
    const existing = acceptedOfferByDeal.get(p.dealId)
    if (!existing || (p.contractStartDate ?? '') > (existing.contractStartDate ?? '')) {
      acceptedOfferByDeal.set(p.dealId, { number: p.number, contractStartDate: p.contractStartDate, amountTotal: p.amountTotal })
    }
  }

  // Monthly value of an offer: fixed cuota if present, else the total
  // (covers offers whose recurring revenue is a calculated per-order variable).
  const offerMonthly = (o: { fixedMonthly: number; amountTotal: number }) =>
    o.fixedMonthly > 0 ? o.fixedMonthly : o.amountTotal

  const closedRows = closedDeals.map((d) => {
    const inv = latestInvByDeal.get(d.id)
    const offer = acceptedOfferByDeal.get(d.id)
    // Use latest invoice amount if available; otherwise fall back to accepted offer monthly value
    const offerMrr = (d.latestOffers ?? [])
      .filter((o) => o.status === 'accepted')
      .reduce((s, o) => s + offerMonthly(o), 0)
    const mrr = inv?.amount ?? offerMrr
    const mrrSource: 'invoice' | 'offer' | 'none' = inv ? 'invoice' : offerMrr > 0 ? 'offer' : 'none'
    const missingVariable = (d.latestOffers ?? []).some((o) => o.status === 'accepted' && o.hasVariable)
    return {
      company: d.company.brandName || d.company.name,
      legalName: d.company.name,
      owner: d.owner,
      mrr,
      mrrSource,
      missingVariable,
      locales: locationCountMap.get(d.id) ?? 0,
      lastInvoice: inv?.number ?? '—',
      contractStart: offer?.contractStartDate ?? null,
      offerNumber: offer?.number ?? '—',
    }
  }).sort((a, b) => b.mrr - a.mrr)

  const totalMrr = closedRows.reduce((s, r) => s + r.mrr, 0)
  const proj3m = totalMrr * 3
  const localesHoy = closedRows.reduce((s, r) => s + r.locales, 0)

  // ── Pipeline 75%+ ─────────────────────────────────────────────────────────
  const pipelineDeals = deals.filter((d) =>
    d.stage !== 'closed_won' && d.stage !== 'closed_lost' && d.stage !== 'rejected' &&
    (d.closeProbability >= 75 || d.stage === 'negotiation')
  )

  const STAGE_LABELS: Record<string, string> = {
    prospecting: 'Prospecto', qualified: 'Contactado', negotiation: 'Negociación',
    proposal_sent: 'Propuesta enviada',
  }

  // Best offer per pipeline deal
  const pipelineRows = pipelineDeals.map((d) => {
    const bestOffer = (d.latestOffers ?? []).sort((a, b) => offerMonthly(b) - offerMonthly(a))[0]
    return {
      company: d.company.brandName || d.company.name,
      legalName: d.company.name,
      stage: STAGE_LABELS[d.stage] ?? d.stage,
      probability: d.closeProbability,
      owner: d.owner,
      offerMrr: bestOffer ? offerMonthly(bestOffer) : 0,
      offerTotal: bestOffer?.amountTotal ?? 0,
      concept: bestOffer?.concept ?? '—',
      missingVariable: bestOffer?.hasVariable ?? false,
      locales: locationCountMap.get(d.id) ?? 0,
    }
  }).sort((a, b) => b.probability - a.probability || b.offerMrr - a.offerMrr)

  const pipelinePotentialMrr = pipelineRows.reduce((s, r) => s + r.offerMrr, 0)
  const weightedMrr = pipelineRows.reduce((s, r) => s + r.offerMrr * (r.probability / 100), 0)
  const localesPipeline = pipelineRows.reduce((s, r) => s + r.locales, 0)

  // ── Total invoiced ─────────────────────────────────────────────────────────
  const totalInvoiced = invoices
    .filter((i) => i.status === 'paid' || i.status === 'issued')
    .reduce((s, i) => s + i.amountTotal, 0)
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amountTotal, 0)

  // ── HTML ───────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Forecast — Platomico</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #18181b; background: #fff; padding: 48px; }
  h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
  .meta { color: #71717a; font-size: 12px; margin-top: 4px; }
  .section { margin-top: 40px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #a1a1aa; margin-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .kpi { background: #f4f4f5; border-radius: 12px; padding: 16px 20px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; margin-bottom: 6px; }
  .kpi-value { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .kpi-value.blue { color: #0071e3; }
  .kpi-value.green { color: #16a34a; }
  .kpi-value.amber { color: #d97706; }
  .kpi-sub { font-size: 10px; color: #a1a1aa; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #a1a1aa; padding: 8px 12px; text-align: left; border-bottom: 1px solid #e4e4e7; }
  td { padding: 10px 12px; border-bottom: 1px solid #f4f4f5; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .mono { font-family: 'SF Mono', 'Fira Code', monospace; }
  .bold { font-weight: 600; }
  .muted { color: #a1a1aa; }
  .tag { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
  .tag-green { background: #dcfce7; color: #15803d; }
  .tag-blue { background: #dbeafe; color: #1d4ed8; }
  .tag-amber { background: #fef3c7; color: #92400e; }
  .tag-purple { background: #ede9fe; color: #6d28d9; }
  .total-row td { font-weight: 700; background: #f4f4f5; border-top: 2px solid #e4e4e7; }
  .divider { border: none; border-top: 1px solid #e4e4e7; margin: 32px 0; }
  .note { font-size: 11px; color: #71717a; margin-top: 12px; }
  .download-btn {
    position: fixed; top: 24px; right: 24px; z-index: 100;
    background: #18181b; color: #fff; border: none; cursor: pointer;
    font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15); transition: background 0.15s;
  }
  .download-btn:hover { background: #3f3f46; }
  @media print {
    body { padding: 24px; }
    .page-break { page-break-before: always; }
    .download-btn { display: none; }
  }
</style>
</head>
<body>

<button class="download-btn" onclick="window.print()">⬇ Descargar PDF</button>

<div style="display:flex; align-items:flex-start; justify-content:space-between;">
  <div>
    <h1>Forecast · Próximos 3 meses</h1>
    <p class="meta">Generado el ${todayStr} · Platomico CRM</p>
  </div>
  <div style="text-align:right;">
    <p style="font-size:11px;color:#a1a1aa;">Generado por</p>
    <p style="font-weight:600;">${user.name ?? user.email}</p>
  </div>
</div>

<!-- KPIs -->
<div class="section">
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">MRR Actual</div>
      <div class="kpi-value blue">${fmt(totalMrr)}</div>
      <div class="kpi-sub">${closedRows.filter(r => r.mrrSource === 'invoice').length} facturando · ${closedRows.filter(r => r.mrrSource === 'offer').length} estimados</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total facturado</div>
      <div class="kpi-value">${fmt(totalInvoiced)}</div>
      <div class="kpi-sub">emitidas + pagadas (histórico)</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total cobrado</div>
      <div class="kpi-value green">${fmt(totalPaid)}</div>
      <div class="kpi-sub">facturas pagadas</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Forecast 3 meses</div>
      <div class="kpi-value blue">${fmt(proj3m + weightedMrr * 3)}</div>
      <div class="kpi-sub">actuales + pipeline ponderado por prob.</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Locales hoy</div>
      <div class="kpi-value">${localesHoy}</div>
      <div class="kpi-sub">clientes activos</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Locales potenciales</div>
      <div class="kpi-value amber">+${localesPipeline}</div>
      <div class="kpi-sub">en pipeline ≥75% / negociación</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Locales en 3 meses</div>
      <div class="kpi-value">${localesHoy} → ${localesHoy + localesPipeline}</div>
      <div class="kpi-sub">si se cierra el pipeline</div>
    </div>
  </div>
</div>

<hr class="divider">

<!-- Closed clients -->
<div class="section">
  <div class="section-title">Clientes actuales — Cerrado ganado (${closedRows.length})</div>
  <table>
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Comercial</th>
        <th>Inicio contrato</th>
        <th style="text-align:center">Locales</th>
        <th>Última factura</th>
        <th style="text-align:right">MRR</th>
        <th style="text-align:right">Proyección 3m</th>
      </tr>
    </thead>
    <tbody>
      ${closedRows.map(r => `
      <tr>
        <td>
          <div class="bold">${r.company}</div>
          ${r.company !== r.legalName ? `<div class="muted" style="font-size:11px">${r.legalName}</div>` : ''}
        </td>
        <td class="muted">${r.owner}</td>
        <td class="mono muted">${fmtDate(r.contractStart)}</td>
        <td class="mono" style="text-align:center">${r.locales || '—'}</td>
        <td class="mono muted">${r.lastInvoice}</td>
        <td class="mono bold" style="text-align:right">
          ${r.mrrSource === 'none'
            ? '<span class="muted">Sin datos</span>'
            : fmt(r.mrr) + (r.mrrSource === 'offer' ? ' <span style="font-size:10px;color:#d97706;font-weight:600">est.</span>' : '')}
          ${r.missingVariable ? '<div style="font-size:10px;color:#dc2626;font-weight:600;margin-top:2px">⚠ Falta variable ROS</div>' : ''}
        </td>
        <td class="mono" style="text-align:right">${r.mrr > 0 ? fmt(r.mrr * 3) : '—'}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="3">TOTAL</td>
        <td class="mono" style="text-align:center">${localesHoy}</td>
        <td></td>
        <td class="mono" style="text-align:right">${fmt(totalMrr)}</td>
        <td class="mono" style="text-align:right">${fmt(proj3m)}</td>
      </tr>
    </tbody>
  </table>
</div>

<hr class="divider page-break">

<!-- Pipeline -->
<div class="section">
  <div class="section-title">Pipeline probable próximos 3 meses — ≥75% o en Negociación (${pipelineRows.length})</div>
  <table>
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Etapa</th>
        <th>Prob.</th>
        <th>Comercial</th>
        <th>Servicio</th>
        <th style="text-align:center">Locales</th>
        <th style="text-align:right">MRR oferta</th>
        <th style="text-align:right">MRR ponderado</th>
      </tr>
    </thead>
    <tbody>
      ${pipelineRows.length === 0
        ? `<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">No hay deals en negociación o con probabilidad ≥75%</td></tr>`
        : pipelineRows.map(r => {
          const tagClass = r.stage === 'Negociación' ? 'tag-purple' : r.stage === 'Propuesta enviada' ? 'tag-blue' : 'tag-amber'
          return `
          <tr>
            <td>
              <div class="bold">${r.company}</div>
              ${r.company !== r.legalName ? `<div class="muted" style="font-size:11px">${r.legalName}</div>` : ''}
            </td>
            <td><span class="tag ${tagClass}">${r.stage}</span></td>
            <td class="mono bold">${r.probability}%</td>
            <td class="muted">${r.owner}</td>
            <td class="muted">${r.concept}</td>
            <td class="mono" style="text-align:center">${r.locales || '—'}</td>
            <td class="mono" style="text-align:right">
              ${r.offerMrr > 0 ? fmt(r.offerMrr) : '<span class="muted">Sin oferta</span>'}
              ${r.missingVariable ? '<div style="font-size:10px;color:#dc2626;font-weight:600;margin-top:2px">⚠ Falta variable ROS</div>' : ''}
            </td>
            <td class="mono bold" style="text-align:right">${r.offerMrr > 0 ? fmt(r.offerMrr * r.probability / 100) : '—'}</td>
          </tr>`
        }).join('')
      }
      ${pipelineRows.length > 0 ? `
      <tr class="total-row">
        <td colspan="5">TOTAL PIPELINE</td>
        <td class="mono" style="text-align:center">${localesPipeline}</td>
        <td class="mono" style="text-align:right">${fmt(pipelinePotentialMrr)}</td>
        <td class="mono" style="text-align:right">${fmt(weightedMrr)}</td>
      </tr>` : ''}
    </tbody>
  </table>
  <p class="note">* MRR ponderado = MRR oferta × probabilidad de cierre. Si se cierran todos: +${fmt(pipelinePotentialMrr * 3)} en 3 meses.</p>
</div>

</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
