'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts'
import type { CashflowTransaction } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function monthKey(date: string) { return date.slice(0, 7) }

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
}

const _EUR2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function eur(n: number) { return `${_EUR2.format(Math.abs(n))} €` }
function eurAxis(n: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n)
}

// ── Tooltip interfaces (recharts v3 compat) ───────────────────────────────────

interface TEntry { name: string; value: number; color: string }

function IncomeExpenseTooltip({ active, payload, label }: {
  active?: boolean; payload?: TEntry[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const income  = payload.find((p) => p.name === 'income')?.value  ?? 0
  const expense = payload.find((p) => p.name === 'expense')?.value ?? 0
  const neto    = income - expense
  return (
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-zinc-100 text-xs space-y-0.5">
      <p className="font-semibold text-zinc-700 mb-1.5">{label}</p>
      <p className="font-mono" style={{ color: '#34c759' }}>Ingresos: {eur(income)}</p>
      <p className="font-mono" style={{ color: '#ff3b30' }}>Gastos: {eur(expense)}</p>
      <p className="font-mono font-semibold" style={{ color: neto >= 0 ? '#0071e3' : '#ff3b30' }}>
        Neto: {neto >= 0 ? '+' : '−'}{eur(Math.abs(neto))}
      </p>
    </div>
  )
}

function LineTooltip({ active, payload, label }: {
  active?: boolean; payload?: TEntry[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  return (
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-zinc-100 text-xs">
      <p className="font-semibold text-zinc-700 mb-1">{label}</p>
      <p className="font-mono" style={{ color: val >= 0 ? '#0071e3' : '#ff3b30' }}>
        Saldo: {eur(val)}
      </p>
    </div>
  )
}

// ── Line chart: ingresos vs gastos por mes ────────────────────────────────────

interface MonthlyBarPoint { month: string; income: number; expense: number }

export function IncomeExpenseChart({ transactions }: { transactions: CashflowTransaction[] }) {
  const data = useMemo<MonthlyBarPoint[]>(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const t of transactions) {
      if (t.category === 'Traspaso interno') continue
      const k = monthKey(t.date)
      const rec = map.get(k) ?? { income: 0, expense: 0 }
      if (t.type === 'income') rec.income += t.amount
      else rec.expense += Math.abs(t.amount)
      map.set(k, rec)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        month:   monthLabel(k),
        income:  Math.round(v.income),
        expense: Math.round(v.expense),
      }))
  }, [transactions])

  if (data.length === 0) return <EmptyChart label="Ingresos vs Gastos por mes" />

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Ingresos vs Gastos · mensual
        </p>
        <div className="flex items-center gap-4">
          <LegendDot color="#34c759" label="Ingresos" />
          <LegendDot color="#ff3b30" label="Gastos" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dy={4} />
          <YAxis tickFormatter={eurAxis} tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dx={-4} width={40} />
          <Tooltip content={<IncomeExpenseTooltip />} />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#34c759"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#34c759', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#34c759', strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="#ff3b30"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#ff3b30', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#ff3b30', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Donut chart: gastos por categoría ─────────────────────────────────────────

const CAT_COLORS = [
  '#ff3b30', '#ff9f0a', '#ffcc00', '#34c759',
  '#0071e3', '#5856d6', '#af52de', '#ff2d55', '#a1a1aa',
]

/**
 * Build an SVG arc-path for a donut ring segment.
 * startDeg / endDeg are 0-based degrees (0 = top, clockwise).
 */
function arcPath(cx: number, cy: number, r: number, sw: number, startDeg: number, endDeg: number): string {
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180
  const inner = r - sw / 2
  const outer = r + sw / 2
  const sa = toRad(startDeg)
  const ea = toRad(endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  const pt = (a: number, radius: number) =>
    `${(cx + radius * Math.cos(a)).toFixed(3)},${(cy + radius * Math.sin(a)).toFixed(3)}`
  return [
    `M ${pt(sa, outer)}`,
    `A ${outer.toFixed(3)},${outer.toFixed(3)} 0 ${large} 1 ${pt(ea, outer)}`,
    `L ${pt(ea, inner)}`,
    `A ${inner.toFixed(3)},${inner.toFixed(3)} 0 ${large} 0 ${pt(sa, inner)}`,
    'Z',
  ].join(' ')
}

interface DonutHover { label: string; amount: number; pct: number; color: string }

export function ExpenseCategoryDonut({ transactions }: { transactions: CashflowTransaction[] }) {
  const [hovered, setHovered] = useState<DonutHover | null>(null)

  const expenses = transactions.filter((t) => t.type === 'expense' && t.category !== 'Traspaso interno')
  const catMap = new Map<string, number>()
  for (const t of expenses) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + Math.abs(t.amount))
  }
  const segments = Array.from(catMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([label, amount], i) => ({ label, amount, color: CAT_COLORS[i % CAT_COLORS.length] }))

  const total = segments.reduce((s, d) => s + d.amount, 0)
  const cx = 72, cy = 72, r = 52, sw = 16

  let cumAngle = 0
  const arcs = segments.filter((d) => d.amount > 0).map((seg) => {
    const startAngle = cumAngle
    const spanAngle  = (seg.amount / total) * 360
    cumAngle += spanAngle
    return { ...seg, startAngle, endAngle: cumAngle, pct: (seg.amount / total) * 100 }
  })

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 relative">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-5">
        Gastos por categoría
      </p>
      {total === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">Sin gastos</p>
      ) : (
        <>
          {/* Hover tooltip — anchored top-right of the card */}
          {hovered && (
            <div className="absolute top-5 right-5 z-10 pointer-events-none bg-white rounded-xl shadow-lg border border-zinc-100 px-3 py-2.5 text-xs" style={{ minWidth: 168 }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hovered.color }} />
                <span className="font-semibold text-zinc-700 truncate max-w-[130px]">{hovered.label}</span>
              </div>
              <p className="font-mono text-zinc-600">{eur(hovered.amount)}</p>
              <p className="text-zinc-400 mt-0.5">{hovered.pct.toFixed(1)}% del total</p>
            </div>
          )}

          <div className="flex items-start gap-6">
            {/* Donut */}
            <svg
              width="144" height="144" viewBox="0 0 144 144"
              className="shrink-0"
              onMouseLeave={() => setHovered(null)}
            >
              {arcs.map((arc, i) => (
                <path
                  key={i}
                  d={arcPath(cx, cy, r, sw, arc.startAngle, arc.endAngle)}
                  fill={arc.color}
                  className="cursor-pointer"
                  style={{
                    opacity: hovered && hovered.label !== arc.label ? 0.45 : 1,
                    transition: 'opacity 0.12s',
                  }}
                  onMouseEnter={() => setHovered({
                    label: arc.label, amount: arc.amount, pct: arc.pct, color: arc.color,
                  })}
                />
              ))}
              <text x={cx} y={cy + 1} textAnchor="middle" fontSize={13} fontWeight="700" fill="#18181b">
                {eurAxis(total)}
              </text>
              <text x={cx} y={cy + 16} textAnchor="middle" fontSize={9} fill="#a1a1aa" fontWeight="500">
                total gasto
              </text>
            </svg>

            {/* Legend — all categories, scrollable */}
            <div className="flex-1 min-w-0 max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {segments.map((seg) => (
                <div
                  key={seg.label}
                  className="flex items-center justify-between gap-2"
                  style={{
                    opacity: hovered && hovered.label !== seg.label ? 0.4 : 1,
                    transition: 'opacity 0.12s',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                    <span className="text-xs text-zinc-600 truncate">{seg.label}</span>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 shrink-0">{eur(seg.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Line chart: saldo acumulado mes a mes ─────────────────────────────────────

interface BalancePoint { month: string; balance: number }

export function BalanceTrendChart({ transactions }: { transactions: CashflowTransaction[] }) {
  const data = useMemo<BalancePoint[]>(() => {
    // Group by month, take last balance entry per month (Revolut balance is running)
    const monthBalances = new Map<string, { balance: number; date: string }>()
    for (const t of transactions) {
      if (t.balance == null) continue
      const k = monthKey(t.date)
      const existing = monthBalances.get(k)
      // Keep the most recent entry (transactions are sorted desc by date already)
      if (!existing || t.date > existing.date) {
        monthBalances.set(k, { balance: t.balance, date: t.date })
      }
    }

    if (monthBalances.size === 0) {
      // Fallback: cumulative net flow (exclude internal transfers)
      const netByMonth = new Map<string, number>()
      for (const t of transactions) {
        if (t.category === 'Traspaso interno') continue
        const k = monthKey(t.date)
        netByMonth.set(k, (netByMonth.get(k) ?? 0) + t.amount)
      }
      let running = 0
      return Array.from(netByMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, net]) => {
          running += net
          return { month: monthLabel(k), balance: Math.round(running) }
        })
    }

    return Array.from(monthBalances.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ month: monthLabel(k), balance: Math.round(v.balance) }))
  }, [transactions])

  if (data.length === 0) return <EmptyChart label="Saldo acumulado" />

  const hasNegative = data.some((d) => d.balance < 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">
        Saldo acumulado · mes a mes
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dy={4} />
          <YAxis tickFormatter={eurAxis} tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dx={-4} width={44} />
          <Tooltip content={<LineTooltip />} />
          {hasNegative && <ReferenceLine y={0} stroke="#e4e4e7" strokeWidth={1} />}
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#0071e3"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#0071e3', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">{label}</p>
      <div className="h-[200px] flex items-center justify-center text-sm text-zinc-400">
        Sin datos
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  )
}
