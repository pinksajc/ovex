import { getCurrentUser } from '@/lib/auth'
import { getDeals, getActiveConfig } from '@/lib/deals'
import { getInvoices } from '@/lib/supabase/invoices'
import { getPresupuestos } from '@/lib/supabase/presupuestos'
import { formatCurrency } from '@/lib/format'
import { MrrChart, type MrrPoint } from './mrr-chart'
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
  prospecting:   '#a1a1aa',
  qualified:     '#60a5fa',
  negotiation:   '#c084fc',
  proposal_sent: '#818cf8',
  closed_won:    '#34c759',
  closed_lost:   '#ff3b30',
}

// ── MRR history helper ────────────────────────────────────────────────────────
function computeMrrData(deals: Deal[], numMonths: number): MrrPoint[] {
  const now = new Date()
  const result: MrrPoint[] = []

  for (let i = numMonths - 1; i >= 0; i--) {
    const baseMonth = now.getMonth() - i
    const year  = now.getFullYear() + Math.floor(baseMonth / 12)
    const month = ((baseMonth % 12) + 12) % 12
    const monthEnd  = new Date(year, month + 1, 0, 23, 59, 59, 999)
    const monthLabel = new Date(year, month, 1).toLocaleDateString('es-ES', {
      month: 'short',
      year: '2-digit',
    })

    let totalMrr = 0
    for (const deal of deals) {
      if (deal.stage === 'closed_lost' || deal.stage === 'rejected') continue
      const configs = deal.configurations ?? []
      const eligible = configs.filter((c) => new Date(c.createdAt) <= monthEnd)
      if (eligible.length === 0) continue
      const latest = eligible.reduce((best, c) =>
        new Date(c.createdAt) > new Date(best.createdAt) ? c : best,
      )
      totalMrr += latest.economics?.totalMonthlyRevenue ?? 0
    }

    result.push({ month: monthLabel, mrr: Math.round(totalMrr) })
  }

  // Projected next 3 months (last real MRR × 1.05^n)
  const lastMrr = result[result.length - 1]?.mrr ?? 0
  // Overlap: seed projected from last real point so lines connect
  result[result.length - 1] = {
    ...result[result.length - 1],
    projected: lastMrr,
  }
  for (let i = 1; i <= 3; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const monthLabel = futureDate.toLocaleDateString('es-ES', {
      month: 'short',
      year: '2-digit',
    })
    result.push({
      month: monthLabel,
      projected: Math.round(lastMrr * Math.pow(1.05, i)),
    })
  }

  return result
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

  // ── Section 2: MRR chart ───────────────────────────────────────────────────
  const mrrData = computeMrrData(deals, 12)

  // ── Section 3: Facturas donut ──────────────────────────────────────────────
  const sum = (arr: typeof invoices) => arr.reduce((s, i) => s + i.amountTotal, 0)
  const paid    = invoices.filter((i) => i.status === 'paid')
  const issued  = invoices.filter((i) => i.status === 'issued')
  const draft   = invoices.filter((i) => i.status === 'draft')
  const overdue = invoices.filter((i) => i.status === 'overdue')

  const donutSegments = [
    { label: 'Pagadas',    count: paid.length,    amount: sum(paid),    color: '#34c759' },
    { label: 'Emitidas',   count: issued.length,  amount: sum(issued),  color: '#0071e3' },
    { label: 'Borradores', count: draft.length,   amount: sum(draft),   color: '#d4d4d8' },
    { label: 'Vencidas',   count: overdue.length, amount: sum(overdue), color: '#ff3b30' },
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
    <div className="min-h-full bg-[#f5f5f7] p-8 space-y-5">

      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Section 1: KPI strip ── */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="MRR" value={formatCurrency(mrr)} color="#0071e3" />
        <KpiCard label="ARR" value={formatCurrency(arr)} color="#0071e3" />
        <KpiCard label="Facturado este mes" value={formatCurrency(facturacionMes)} color="#8e8e93" />
        <KpiCard label="Cobrado este mes" value={formatCurrency(cobradoMes)} color="#34c759" />
        <KpiCard label="Pendiente de cobro" value={formatCurrency(pendiente)} color={pendiente > 0 ? '#ff9f0a' : '#8e8e93'} />
      </div>

      {/* ── Section 2: MRR line chart ── */}
      <div className="bg-white rounded-2xl shadow-sm p-7">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-1">Evolución MRR</p>
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{formatCurrency(mrr)}</p>
          </div>
          <div className="flex items-center gap-5 pb-1">
            <LegendDot color="#0071e3" label="MRR real" />
            <LegendDot color="#0071e3" label="Proyectado" dashed />
          </div>
        </div>
        <MrrChart data={mrrData} currentMrr={mrr} />
      </div>

      {/* ── Section 3: Facturas + Pipeline ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Facturas donut */}
        <div className="bg-white rounded-2xl shadow-sm p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-6">Facturas</p>
          <div className="flex items-center gap-8">
            <DonutChart segments={donutSegments} />
            <div className="flex-1 space-y-3.5">
              {donutSegments.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: seg.color }}
                    />
                    <span className="text-sm text-zinc-600">{seg.label}</span>
                    <span className="text-sm font-semibold text-zinc-900">{seg.count}</span>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">{formatCurrency(seg.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pipeline bars */}
        <div className="bg-white rounded-2xl shadow-sm p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-6">Pipeline de deals</p>
          <div className="space-y-3">
            {pipeline.map(({ stage, label, count, mrr: stageMrr, color }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-36 shrink-0 text-right truncate">{label}</span>
                <div className="flex-1 h-8 bg-zinc-50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max((stageMrr / maxPipelineMrr) * 100, count > 0 ? 5 : 0)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <div className="text-right shrink-0 w-20">
                  <span className="text-xs font-semibold text-zinc-900 block">{count} deal{count !== 1 ? 's' : ''}</span>
                  {stageMrr > 0 && (
                    <span className="text-[10px] font-mono text-zinc-400">{formatCurrency(stageMrr)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 4: Propuestas + Leaderboard ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Propuestas */}
        <div className="bg-white rounded-2xl shadow-sm p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-5">Propuestas</p>

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
              color="#34c759"
            />
            <StatCard
              label="MRR medio"
              value={formatCurrency(mrrMedioWon)}
              sub="por deal cerrado"
            />
          </div>

          {/* Mini stats row */}
          <div className="pt-4 border-t border-zinc-50 grid grid-cols-3 text-center gap-2">
            <MiniStat
              label="Borradores"
              value={presupuestos.filter((p) => p.status === 'draft').length}
            />
            <MiniStat label="Rechazadas" value={pqRejected.length} color="#ff3b30" />
            <MiniStat
              label="Expiradas"
              value={presupuestos.filter((p) => p.status === 'expired').length}
              color="#ff9f0a"
            />
          </div>
        </div>

        {/* Owner leaderboard */}
        <div className="bg-white rounded-2xl shadow-sm p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-5">Por comercial</p>
          {owners.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {owners.map((owner, idx) => {
                const initials = owner.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
                const rankColors = ['#0071e3', '#34c759', '#ff9f0a']
                const rankColor = rankColors[idx] ?? '#a1a1aa'
                return (
                  <div key={owner.name} className="flex items-center gap-4">
                    {/* Rank */}
                    <span
                      className="text-sm font-bold w-5 text-right shrink-0"
                      style={{ color: rankColor }}
                    >
                      {idx + 1}
                    </span>
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: rankColor }}
                    >
                      {initials || '?'}
                    </div>
                    {/* Name + MRR */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{owner.name}</p>
                      <p className="text-xs font-mono text-zinc-400">{formatCurrency(owner.mrr)}/mes</p>
                    </div>
                    {/* Deal count badge */}
                    <span className="text-xs font-semibold bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-full shrink-0">
                      {owner.count} deal{owner.count !== 1 ? 's' : ''}
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
  color = '#18181b',
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3 leading-tight">
        {label}
      </p>
      <p className="text-2xl font-bold tracking-tight" style={{ color }}>
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
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-[#f5f5f7] rounded-xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2 leading-tight">
        {label}
      </p>
      <p
        className="text-2xl font-bold leading-none tracking-tight"
        style={{ color: color ?? '#18181b' }}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-zinc-400 mt-1.5 leading-tight">{sub}</p>}
    </div>
  )
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div>
      <p
        className="text-xl font-bold tracking-tight"
        style={{ color: color ?? '#18181b' }}
      >
        {value}
      </p>
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
  const cx = 72, cy = 72, r = 52, sw = 16
  const circ = 2 * Math.PI * r

  if (total === 0) {
    return (
      <svg width="144" height="144" viewBox="0 0 144 144" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e4e4e7" strokeWidth={sw} />
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={16} fontWeight="700" fill="#a1a1aa">
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
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize={22} fontWeight="700" fill="#18181b">
        {total}
      </text>
      <text x={cx} y={cy + 17} textAnchor="middle" fontSize={10} fill="#a1a1aa" fontWeight="500">
        facturas
      </text>
    </svg>
  )
}
