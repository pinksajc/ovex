import type { ReactNode } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { getDeals, getActiveConfig } from '@/lib/deals'
import { getInvoices } from '@/lib/supabase/invoices'
import { getPresupuestos } from '@/lib/supabase/presupuestos'
import { formatCurrency } from '@/lib/format'

// ── Stage config ─────────────────────────────────────────────────────────────
const STAGE_ORDER = [
  'prospecting',
  'qualified',
  'negotiation',
  'proposal_sent',
  'closed_won',
  'closed_lost',
] as const

const STAGE_LABELS: Record<string, string> = {
  prospecting:   'Prospecto',
  qualified:     'Contactado',
  negotiation:   'Negociación',
  proposal_sent: 'Propuesta enviada',
  closed_won:    'Cerrado ganado',
  closed_lost:   'Cerrado perdido',
}

const STAGE_COLORS: Record<string, string> = {
  prospecting:   '#a1a1aa',
  qualified:     '#60a5fa',
  negotiation:   '#c084fc',
  proposal_sent: '#818cf8',
  closed_won:    '#22c55e',
  closed_lost:   '#f87171',
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const [deals, invoices, presupuestos] = await Promise.all([
    getDeals(user),
    getInvoices(),
    getPresupuestos(),
  ])

  // ── Section 1: Revenue ──────────────────────────────────────────────────
  const pipelineDeals = deals.filter(
    (d) => d.stage !== 'closed_lost' && d.stage !== 'rejected',
  )
  const mrr = pipelineDeals.reduce(
    (s, d) => s + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0),
    0,
  )
  const arr = mrr * 12

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const thisMonth = invoices.filter((i) => i.createdAt >= monthStart)
  const facturacionMes = thisMonth
    .filter((i) => i.status === 'issued' || i.status === 'paid')
    .reduce((s, i) => s + i.amountTotal, 0)
  const cobradoMes = thisMonth
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amountTotal, 0)
  const pendiente = invoices
    .filter((i) => i.status === 'issued')
    .reduce((s, i) => s + i.amountTotal, 0)

  // ── Section 2: Facturas ─────────────────────────────────────────────────
  const sum = (arr: typeof invoices) => arr.reduce((s, i) => s + i.amountTotal, 0)
  const paid    = invoices.filter((i) => i.status === 'paid')
  const issued  = invoices.filter((i) => i.status === 'issued')
  const draft   = invoices.filter((i) => i.status === 'draft')
  const overdue = invoices.filter((i) => i.status === 'overdue')

  const donutSegments = [
    { label: 'Pagadas',    count: paid.length,    amount: sum(paid),    color: '#22c55e' },
    { label: 'Emitidas',   count: issued.length,  amount: sum(issued),  color: '#3b82f6' },
    { label: 'Borradores', count: draft.length,   amount: sum(draft),   color: '#d4d4d8' },
    { label: 'Vencidas',   count: overdue.length, amount: sum(overdue), color: '#f87171' },
  ]

  // ── Section 3: Pipeline ─────────────────────────────────────────────────
  const pipeline = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: deals.filter((d) => d.stage === stage).length,
    color: STAGE_COLORS[stage],
  }))
  const maxCount = Math.max(...pipeline.map((p) => p.count), 1)

  // ── Section 4: Propuestas ───────────────────────────────────────────────
  const pqSent     = presupuestos.filter((p) => p.status === 'sent' || p.status === 'accepted')
  const pqAccepted = presupuestos.filter((p) => p.status === 'accepted')
  const pqRejected = presupuestos.filter((p) => p.status === 'rejected')
  const convBase   = pqSent.length + pqRejected.length
  const convRate   = convBase > 0 ? (pqAccepted.length / convBase) * 100 : 0

  const closedWon    = deals.filter((d) => d.stage === 'closed_won')
  const mrrMedioWon  = closedWon.length > 0
    ? closedWon.reduce((s, d) => s + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0), 0) / closedWon.length
    : 0

  // ── Section 5: Owners ───────────────────────────────────────────────────
  const ownerMap = new Map<string, { name: string; count: number; mrr: number }>()
  for (const deal of deals) {
    const key  = deal.ownerId ?? '__none__'
    const name = deal.owner || 'Sin asignar'
    const rec  = ownerMap.get(key) ?? { name, count: 0, mrr: 0 }
    rec.count += 1
    rec.mrr   += getActiveConfig(deal)?.economics.totalMonthlyRevenue ?? 0
    ownerMap.set(key, rec)
  }
  const owners = Array.from(ownerMap.values()).sort((a, b) => b.mrr - a.mrr)

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Resumen del negocio</p>
      </div>

      {/* ── Section 1: Revenue KPIs ── */}
      <section>
        <SectionLabel>Revenue</SectionLabel>
        <div className="grid grid-cols-5 gap-4">
          <KpiCard label="MRR" value={formatCurrency(mrr)} accent />
          <KpiCard label="ARR" value={formatCurrency(arr)} accent />
          <KpiCard label="Facturado (mes)" value={formatCurrency(facturacionMes)} />
          <KpiCard label="Cobrado (mes)" value={formatCurrency(cobradoMes)} />
          <KpiCard label="Pendiente de cobro" value={formatCurrency(pendiente)} warn={pendiente > 0} />
        </div>
      </section>

      {/* ── Sections 2 + 3: Facturas + Pipeline ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Section 2: Facturas donut */}
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm p-6">
          <SectionLabel>Facturas</SectionLabel>
          <div className="flex items-center gap-8 mt-2">
            <DonutChart segments={donutSegments} />
            <div className="flex-1 space-y-2.5">
              {donutSegments.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: seg.color }}
                    />
                    <span className="text-xs text-zinc-600">{seg.label}</span>
                    <span className="text-xs font-semibold text-zinc-900">{seg.count}</span>
                  </div>
                  <span className="text-xs text-zinc-400">{formatCurrency(seg.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Pipeline */}
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm p-6">
          <SectionLabel>Pipeline de deals</SectionLabel>
          <div className="mt-2 space-y-3">
            {pipeline.map(({ stage, label, count, color }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-36 shrink-0 text-right truncate">
                  {label}
                </span>
                <div className="flex-1 h-5 bg-zinc-50 rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md"
                    style={{
                      width: `${Math.max((count / maxCount) * 100, count > 0 ? 4 : 0)}%`,
                      background: color,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-zinc-900 w-5 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sections 4 + 5: Propuestas + Owners ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Section 4: Propuestas */}
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm p-6">
          <SectionLabel>Propuestas</SectionLabel>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <StatTile
              label="Enviadas / Aceptadas"
              value={`${pqSent.length} / ${pqAccepted.length}`}
            />
            <StatTile
              label="Tasa de conversión"
              value={`${convRate.toFixed(1)}%`}
              accent
            />
            <StatTile
              label="MRR medio cerrado"
              value={formatCurrency(mrrMedioWon)}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-50 grid grid-cols-3 text-center">
            <Micro label="Borradores" value={presupuestos.filter((p) => p.status === 'draft').length} />
            <Micro label="Rechazadas" value={pqRejected.length} />
            <Micro label="Expiradas" value={presupuestos.filter((p) => p.status === 'expired').length} />
          </div>
        </div>

        {/* Section 5: Owners */}
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm p-6">
          <SectionLabel>Por comercial</SectionLabel>
          <div className="mt-2">
            {owners.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">Sin datos</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-50">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-400 pb-2">
                      Comercial
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-400 pb-2">
                      Deals
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-400 pb-2">
                      MRR total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((o) => (
                    <tr
                      key={o.name}
                      className="border-b border-zinc-50 last:border-0"
                    >
                      <td className="py-2.5 text-sm font-medium text-zinc-800">{o.name}</td>
                      <td className="py-2.5 text-sm text-zinc-400 text-right">{o.count}</td>
                      <td className="py-2.5 text-sm font-semibold text-zinc-900 text-right">
                        {formatCurrency(o.mrr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components (server-renderable) ───────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
      {children}
    </p>
  )
}

function KpiCard({
  label,
  value,
  accent,
  warn,
}: {
  label: string
  value: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm p-5">
      <p className="text-xs text-zinc-400 mb-2 leading-tight">{label}</p>
      <p
        className={`text-xl font-bold tracking-tight ${
          accent ? 'text-indigo-600' : warn ? 'text-amber-500' : 'text-zinc-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="bg-zinc-50 rounded-xl p-4">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 leading-tight">
        {label}
      </p>
      <p className={`text-xl font-bold ${accent ? 'text-indigo-600' : 'text-zinc-900'}`}>
        {value}
      </p>
    </div>
  )
}

function Micro({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-bold text-zinc-900">{value}</p>
      <p className="text-[10px] text-zinc-400 mt-0.5">{label}</p>
    </div>
  )
}

function DonutChart({
  segments,
}: {
  segments: { label: string; count: number; color: string }[]
}) {
  const total = segments.reduce((s, d) => s + d.count, 0)
  const cx = 56, cy = 56, r = 40, sw = 14
  const circ = 2 * Math.PI * r

  if (total === 0) {
    return (
      <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e4e4e7" strokeWidth={sw} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight="600" fill="#a1a1aa">
          0
        </text>
      </svg>
    )
  }

  let cum = 0
  const arcs = segments
    .filter((d) => d.count > 0)
    .map((d, i) => {
      const dash     = (d.count / total) * circ
      const rotation = -90 + (cum / total) * 360
      cum += d.count
      return (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={d.color}
          strokeWidth={sw}
          strokeDasharray={`${dash.toFixed(3)} ${(circ - dash).toFixed(3)}`}
          transform={`rotate(${rotation.toFixed(3)} ${cx} ${cy})`}
        />
      )
    })

  return (
    <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0">
      {arcs}
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize={17} fontWeight="700" fill="#18181b">
        {total}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fontSize={9} fill="#a1a1aa">
        total
      </text>
    </svg>
  )
}
