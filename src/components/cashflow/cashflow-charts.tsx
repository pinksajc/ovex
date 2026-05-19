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

/** Returns "YYYY-MM" — groups by year+month. */
function monthKey(date: string) { return date.slice(0, 7) }

/** Hardcoded Spanish abbreviations — avoids locale variance across environments. */
const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/** "2026-01" → "Ene 26" */
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTH_ABBR[m - 1]} ${String(y).slice(2)}`
}

/** Returns "YYYY-Www" for the Monday of the week containing `date`. */
function weekStartKey(date: string): string {
  const d = new Date(date + 'T00:00:00')
  // Shift to Monday
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - day)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** "2026-05-19" → "19 may" */
function shortDayLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTH_ABBR[m - 1].toLowerCase()}`
}

/** "2026-05-18" (week start) → "18 may" */
function weekLabel(key: string): string {
  return shortDayLabel(key)
}

type Granularity = 'monthly' | 'weekly' | 'daily'

function getGranularity(dateFrom: string, dateTo: string): Granularity {
  const from = new Date(dateFrom + 'T00:00:00')
  const to   = new Date(dateTo   + 'T00:00:00')
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
  if (days > 90)  return 'monthly'
  if (days >= 14) return 'weekly'
  return 'daily'
}

function bucketKey(date: string, gran: Granularity): string {
  if (gran === 'monthly') return monthKey(date)
  if (gran === 'weekly')  return weekStartKey(date)
  return date.slice(0, 10)
}

function bucketLabel(key: string, gran: Granularity): string {
  if (gran === 'monthly') return monthLabel(key)
  if (gran === 'weekly')  return weekLabel(key)
  return shortDayLabel(key)
}

function granularityLabel(gran: Granularity): string {
  if (gran === 'monthly') return 'mensual'
  if (gran === 'weekly')  return 'semanal'
  return 'diario'
}

const _EUR2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function eur(n: number) { return `${_EUR2.format(Math.abs(n))} €` }

/** Y-axis tick formatter — dots as thousand separators, no decimals. */
const _EUR0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
function eurAxis(n: number): string { return _EUR0.format(n) }

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

function BalanceTooltip({ active, payload, label }: {
  active?: boolean; payload?: TEntry[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const fin  = payload.find((p) => p.name === 'balance')?.value ?? 0
  const peak = payload.find((p) => p.name === 'peak')?.value
  return (
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-zinc-100 text-xs space-y-0.5">
      <p className="font-semibold text-zinc-700 mb-1.5">{label}</p>
      {peak != null && peak !== fin && (
        <p className="font-mono" style={{ color: '#60a5fa' }}>Saldo máximo: {eur(peak)}</p>
      )}
      <p className="font-mono" style={{ color: fin >= 0 ? '#0071e3' : '#ff3b30' }}>
        Saldo final: {eur(fin)}
      </p>
    </div>
  )
}

// ── Line chart: ingresos vs gastos ────────────────────────────────────────────

interface IncomeExpensePoint { period: string; income: number; expense: number }

export function IncomeExpenseChart({
  transactions,
  dateFrom,
  dateTo,
}: {
  transactions: CashflowTransaction[]
  dateFrom: string
  dateTo: string
}) {
  const gran = useMemo(() => getGranularity(dateFrom, dateTo), [dateFrom, dateTo])

  const data = useMemo<IncomeExpensePoint[]>(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const t of transactions) {
      if (t.category === 'Traspaso interno' || t.category === 'Préstamos') continue
      const k = bucketKey(t.date, gran)
      const rec = map.get(k) ?? { income: 0, expense: 0 }
      if (t.type === 'income') rec.income += t.amount
      else rec.expense += Math.abs(t.amount)
      map.set(k, rec)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        period:  bucketLabel(k, gran),
        income:  Math.round(v.income),
        expense: Math.round(v.expense),
      }))
  }, [transactions, gran])

  if (data.length === 0) return <EmptyChart label="Ingresos vs Gastos" />

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Ingresos vs Gastos · {granularityLabel(gran)}
        </p>
        <div className="flex items-center gap-4">
          <LegendDot color="#34c759" label="Ingresos" />
          <LegendDot color="#ff3b30" label="Gastos" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dy={4} />
          <YAxis tickFormatter={eurAxis} tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dx={-4} width={62} />
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

  const expenses = transactions.filter(
    (t) => t.type === 'expense' && t.category !== 'Traspaso interno' && t.category !== 'Préstamos',
  )
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
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">
        Gastos por categoría
      </p>
      {total === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">Sin gastos</p>
      ) : (
        <>
          {/* Hover tooltip — anchored top-right */}
          {hovered && (
            <div className="absolute top-5 right-5 z-10 pointer-events-none bg-white rounded-xl shadow-lg border border-zinc-100 px-3 py-2.5 text-xs" style={{ minWidth: 148 }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hovered.color }} />
                <span className="font-semibold text-zinc-700 truncate max-w-[110px]">{hovered.label}</span>
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

            {/* Legend — side-by-side, names wrap (no truncate) */}
            <div className="flex-1 min-w-0 max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {segments.map((seg) => (
                <div
                  key={seg.label}
                  className="flex items-start justify-between gap-2"
                  style={{
                    opacity: hovered && hovered.label !== seg.label ? 0.4 : 1,
                    transition: 'opacity 0.12s',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ background: seg.color }} />
                    <span className="text-xs text-zinc-600 leading-tight">{seg.label}</span>
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

interface BalancePoint { month: string; balance: number; peak: number }

export function BalanceTrendChart({
  transactions,
}: {
  transactions: CashflowTransaction[]
  dateFrom: string
  dateTo: string
}) {
  const data = useMemo<BalancePoint[]>(() => {
    // Group by month — track last (end) and max (peak) balance per month.
    // All categories included: every transaction affects the real bank balance.
    type MonthAcc = { balance: number; peak: number; lastDate: string }
    const map = new Map<string, MonthAcc>()

    for (const t of transactions) {
      if (t.balance == null) continue
      const k = monthKey(t.date)
      const rec = map.get(k)
      if (!rec) {
        map.set(k, { balance: t.balance, peak: t.balance, lastDate: t.date })
      } else {
        if (t.balance > rec.peak) rec.peak = t.balance
        if (t.date > rec.lastDate) { rec.lastDate = t.date; rec.balance = t.balance }
      }
    }

    if (map.size === 0) {
      // Fallback: cumulative net flow — all categories included, no peak tracking
      const netByMonth = new Map<string, number>()
      for (const t of transactions) {
        const k = monthKey(t.date)
        netByMonth.set(k, (netByMonth.get(k) ?? 0) + t.amount)
      }
      let running = 0
      return Array.from(netByMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, net]) => {
          running += net
          return { month: monthLabel(k), balance: Math.round(running), peak: Math.round(running) }
        })
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        month:   monthLabel(k),
        balance: Math.round(v.balance),
        peak:    Math.round(v.peak),
      }))
  }, [transactions])

  if (data.length === 0) return <EmptyChart label="Saldo acumulado" />

  const hasNegative = data.some((d) => d.balance < 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Saldo acumulado · mensual
        </p>
        <div className="flex items-center gap-4">
          <LegendLine color="#60a5fa" dashed label="Saldo máximo" />
          <LegendLine color="#0071e3" label="Saldo final" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dy={4} />
          <YAxis tickFormatter={eurAxis} tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dx={-4} width={62} />
          <Tooltip content={<BalanceTooltip />} />
          {hasNegative && <ReferenceLine y={0} stroke="#e4e4e7" strokeWidth={1} />}
          <Line
            type="monotone"
            dataKey="peak"
            stroke="#60a5fa"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3, fill: '#60a5fa', strokeWidth: 0 }}
          />
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

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="18" height="10" viewBox="0 0 18 10">
        {dashed
          ? <line x1="0" y1="5" x2="18" y2="5" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" />
          : <line x1="0" y1="5" x2="18" y2="5" stroke={color} strokeWidth="2.5" />
        }
      </svg>
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  )
}
