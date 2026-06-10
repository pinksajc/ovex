import { getCurrentUser } from '@/lib/auth'
import { getDeals, getActiveConfig } from '@/lib/deals'
import { getInvoices } from '@/lib/supabase/invoices'
import { getPresupuestos } from '@/lib/supabase/presupuestos'
import { formatCurrency } from '@/lib/format'
import { BillingChart } from './billing-chart'
import type { Deal } from '@/types'

// ── Stage config ──────────────────────────────────────────────────────────────
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
  prospecting:   '#62626B',
  qualified:     '#60A5FA',
  negotiation:   '#FBBF24',
  proposal_sent: '#7C72E8',
  closed_won:    '#4ADE80',
  closed_lost:   '#F87171',
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const [deals, invoices, presupuestos] = await Promise.all([
    getDeals(user),
    getInvoices(),
    getPresupuestos(),
  ])

  // ── Section 1: KPIs ────────────────────────────────────────────────────────
  const pipelineDeals = deals.filter(
    (d) => d.stage !== 'closed_lost' && d.stage !== 'rejected',
  )
  const mrr = pipelineDeals.reduce(
    (s, d) => s + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0),
    0,
  )
  const arr = mrr * 12

  const now       = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thisMonth  = invoices.filter((i) => i.createdAt >= monthStart)

  const facturacionMes = thisMonth
    .filter((i) => i.status === 'issued' || i.status === 'paid')
    .reduce((s, i) => s + i.amountTotal, 0)
  const cobradoMes = thisMonth
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amountTotal, 0)
  const pendiente = invoices
    .filter((i) => i.status === 'issued')
    .reduce((s, i) => s + i.amountTotal, 0)

  // ── Section 3: Facturas donut ──────────────────────────────────────────────
  const sum = (arr: typeof invoices) => arr.reduce((s, i) => s + i.amountTotal, 0)
  const paid    = invoices.filter((i) => i.status === 'paid')
  const issued  = invoices.filter((i) => i.status === 'issued')
  const draft   = invoices.filter((i) => i.status === 'draft')
  const overdue = invoices.filter((i) => i.status === 'overdue')

  const donutSegments = [
    { label: 'Pagadas',    count: paid.length,    amount: sum(paid),    color: '#4ADE80' },
    { label: 'Emitidas',   count: issued.length,  amount: sum(issued),  color: '#60A5FA' },
    { label: 'Borradores', count: draft.length,   amount: sum(draft),   color: '#62626B' },
    { label: 'Vencidas',   count: overdue.length, amount: sum(overdue), color: '#F87171' },
  ]

  // ── Section 3: Pipeline ────────────────────────────────────────────────────
  const pipeline = STAGE_ORDER.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage)
    return {
      stage,
      label: STAGE_LABELS[stage],
      count: stageDeals.length,
      mrr: stageDeals.reduce(
        (s, d) => s + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0),
        0,
      ),
      color: STAGE_COLORS[stage],
    }
  })
  const maxPipelineMrr = Math.max(...pipeline.map((p) => p.mrr), 1)

  // ── Section 4: Propuestas ──────────────────────────────────────────────────
  const pqSent     = presupuestos.filter((p) => p.status === 'sent' || p.status === 'accepted')
  const pqAccepted = presupuestos.filter((p) => p.status === 'accepted')
  const pqRejected = presupuestos.filter((p) => p.status === 'rejected')
  const convBase   = pqSent.length + pqRejected.length
  const convRate   = convBase > 0 ? (pqAccepted.length / convBase) * 100 : 0

  const closedWon   = deals.filter((d) => d.stage === 'closed_won')
  const mrrMedioWon = closedWon.length > 0
    ? closedWon.reduce((s, d) => s + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0), 0) / closedWon.length
    : 0

  // ── Section 4: Owners leaderboard ─────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-base p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-text-tertiary mt-0.5">
          {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Section 1: KPI strip ── */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="MRR" value={formatCurrency(mrr)} accent />
        <KpiCard label="ARR" value={formatCurrency(arr)} accent />
        <KpiCard label="Facturado este mes" value={formatCurrency(facturacionMes)} />
        <KpiCard label="Cobrado este mes" value={formatCurrency(cobradoMes)} success />
        <KpiCard label="Pendiente de cobro" value={formatCurrency(pendiente)} warning={pendiente > 0} />
      </div>

      {/* ── Section 2: Billing line chart ── */}
      <div className="bg-surface border border-border-subtle rounded-lg p-6">
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="shrink-0">
            <p className="text-[12px] font-medium uppercase tracking-widest text-text-tertiary mb-1">Evolución Facturación</p>
            <p className="text-[28px] font-semibold text-text-primary font-mono tracking-tight leading-none">{formatCurrency(mrr)}</p>
            <p className="text-[12px] text-text-tertiary mt-1">MRR pipeline</p>
          </div>
          <div className="flex items-center gap-5 pt-1">
            <LegendDot color="#7C72E8" label="Facturado" />
            <LegendDot color="#4ADE80" label="Cobrado" />
            <LegendDot color="#7C72E8" label="Proyectado" dashed />
          </div>
        </div>
        <BillingChart invoices={invoices} />
      </div>

      {/* ── Section 3: Facturas + Pipeline ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Facturas donut */}
        <div className="bg-surface border border-border-subtle rounded-lg p-6">
          <p className="text-[12px] font-medium uppercase tracking-widest text-text-tertiary mb-5">Facturas</p>
          <div className="flex items-center gap-6">
            <DonutChart segments={donutSegments} />
            <div className="flex-1 space-y-3">
              {donutSegments.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: seg.color }}
                    />
                    <span className="text-[13px] text-text-secondary">{seg.label}</span>
                    <span className="text-[13px] font-semibold text-text-primary">{seg.count}</span>
                  </div>
                  <span className="text-[12px] font-mono text-text-tertiary">{formatCurrency(seg.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pipeline bars */}
        <div className="bg-surface border border-border-subtle rounded-lg p-6">
          <p className="text-[12px] font-medium uppercase tracking-widest text-text-tertiary mb-5">Pipeline de deals</p>
          <div className="space-y-3">
            {pipeline.map(({ stage, label, count, mrr: stageMrr, color }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-[12px] text-text-tertiary w-36 shrink-0 text-right truncate">{label}</span>
                <div className="flex-1 h-6 bg-hover rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: `${Math.max((stageMrr / maxPipelineMrr) * 100, count > 0 ? 5 : 0)}%`,
                      backgroundColor: color,
                      opacity: 0.8,
                    }}
                  />
                </div>
                <div className="text-right shrink-0 w-20">
                  <span className="text-[13px] font-semibold text-text-primary block font-mono">{count}</span>
                  {stageMrr > 0 && (
                    <span className="text-[11px] font-mono text-text-tertiary">{formatCurrency(stageMrr)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 4: Propuestas + Leaderboard ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Propuestas */}
        <div className="bg-surface border border-border-subtle rounded-lg p-6">
          <p className="text-[12px] font-medium uppercase tracking-widest text-text-tertiary mb-5">Propuestas</p>

          {/* 3 stat cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatCard
              label="Enviadas"
              value={String(pqSent.length)}
              sub={`${pqAccepted.length} aceptadas`}
            />
            <StatCard
              label="Conversión"
              value={`${convRate.toFixed(0)}%`}
              success
            />
            <StatCard
              label="MRR medio"
              value={formatCurrency(mrrMedioWon)}
              sub="por deal cerrado"
            />
          </div>

          {/* Mini stats row */}
          <div className="pt-4 border-t border-border-subtle grid grid-cols-3 text-center gap-2">
            <MiniStat
              label="Borradores"
              value={presupuestos.filter((p) => p.status === 'draft').length}
            />
            <MiniStat label="Rechazadas" value={pqRejected.length} danger />
            <MiniStat
              label="Expiradas"
              value={presupuestos.filter((p) => p.status === 'expired').length}
              warning
            />
          </div>
        </div>

        {/* Owner leaderboard */}
        <div className="bg-surface border border-border-subtle rounded-lg p-6">
          <p className="text-[12px] font-medium uppercase tracking-widest text-text-tertiary mb-5">Por comercial</p>
          {owners.length === 0 ? (
            <p className="text-[13px] text-text-tertiary py-8 text-center">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {owners.map((owner, idx) => {
                const initials = owner.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
                const rankColors = ['#7C72E8', '#4ADE80', '#FBBF24']
                const rankColor = rankColors[idx] ?? '#62626B'
                return (
                  <div key={owner.name} className="flex items-center gap-3">
                    <span
                      className="text-[13px] font-semibold w-5 text-right shrink-0 font-mono"
                      style={{ color: rankColor }}
                    >
                      {idx + 1}
                    </span>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                      style={{ background: `${rankColor}20`, color: rankColor }}
                    >
                      {initials || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text-primary truncate">{owner.name}</p>
                      <p className="text-[12px] font-mono text-text-tertiary">{formatCurrency(owner.mrr)}/mes</p>
                    </div>
                    <span className="text-[12px] font-mono text-text-tertiary bg-hover px-2.5 py-1 rounded-[4px] shrink-0">
                      {owner.count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  accent,
  success,
  warning,
}: {
  label: string
  value: string
  accent?: boolean
  success?: boolean
  warning?: boolean
}) {
  const valueColor = accent
    ? '#A9A2F2'
    : success
    ? '#4ADE80'
    : warning
    ? '#FBBF24'
    : '#EDEDEF'
  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-5">
      <p className="text-[12px] font-medium uppercase tracking-widest text-text-tertiary mb-3 leading-tight">
        {label}
      </p>
      <p className="text-[28px] font-semibold font-mono tracking-tight leading-none" style={{ color: valueColor }}>
        {value}
      </p>
    </div>
  )
}

function LegendDot({
  color,
  label,
  dashed,
}: {
  color: string
  label: string
  dashed?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="20" height="4" viewBox="0 0 20 4">
        {dashed ? (
          <line
            x1="0" y1="2" x2="20" y2="2"
            stroke={color}
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeOpacity={0.5}
          />
        ) : (
          <line x1="0" y1="2" x2="20" y2="2" stroke={color} strokeWidth="2.5" />
        )}
      </svg>
      <span className="text-[12px] text-text-tertiary">{label}</span>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  success,
}: {
  label: string
  value: string
  sub?: string
  success?: boolean
}) {
  return (
    <div className="bg-hover rounded-[6px] p-4">
      <p className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary mb-2 leading-tight">
        {label}
      </p>
      <p
        className="text-[24px] font-semibold font-mono leading-none tracking-tight"
        style={{ color: success ? '#4ADE80' : '#EDEDEF' }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-text-tertiary mt-1.5 leading-tight">{sub}</p>}
    </div>
  )
}

function MiniStat({
  label,
  value,
  danger,
  warning,
}: {
  label: string
  value: number
  danger?: boolean
  warning?: boolean
}) {
  const color = danger ? '#F87171' : warning ? '#FBBF24' : '#EDEDEF'
  return (
    <div>
      <p
        className="text-[20px] font-semibold font-mono tracking-tight"
        style={{ color }}
      >
        {value}
      </p>
      <p className="text-[11px] text-text-tertiary mt-0.5">{label}</p>
    </div>
  )
}

function DonutChart({
  segments,
}: {
  segments: { label: string; count: number; color: string }[]
}) {
  const total = segments.reduce((s, d) => s + d.count, 0)
  const cx = 72, cy = 72, r = 52, sw = 16
  const circ = 2 * Math.PI * r

  if (total === 0) {
    return (
      <svg width="144" height="144" viewBox="0 0 144 144" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#26262C" strokeWidth={sw} />
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={16} fontWeight="600" fill="#62626B">
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
    <svg width="144" height="144" viewBox="0 0 144 144" className="shrink-0">
      {arcs}
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize={22} fontWeight="600" fill="#EDEDEF">
        {total}
      </text>
      <text x={cx} y={cy + 17} textAnchor="middle" fontSize={10} fill="#62626B" fontWeight="500">
        facturas
      </text>
    </svg>
  )
}
