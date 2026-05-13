'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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

function formatK(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`
  return `${Math.round(n)}`
}

function formatEur(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1000) return `${(abs / 1000).toFixed(2).replace(/\.?0+$/, '')}k €`
  return `${abs.toFixed(2)} €`
}

// ── Tooltip interfaces (recharts v3 compat) ───────────────────────────────────

interface TEntry { name: string; value: number; color: string }

function BarTooltip({ active, payload, label }: {
  active?: boolean; payload?: TEntry[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-zinc-100 text-xs">
      <p className="font-semibold text-zinc-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name === 'income' ? 'Ingresos' : 'Gastos'}: {formatEur(p.value)}
        </p>
      ))}
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
        Saldo: {formatEur(val)}
      </p>
    </div>
  )
}

// ── Bar chart: ingresos vs gastos por mes ─────────────────────────────────────

interface MonthlyBarPoint { month: string; income: number; expense: number }

export function IncomeExpenseChart({ transactions }: { transactions: CashflowTransaction[] }) {
  const data = useMemo<MonthlyBarPoint[]>(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const t of transactions) {
      const k = monthKey(t.date)
      const rec = map.get(k) ?? { income: 0, expense: 0 }
      if (t.type === 'income') rec.income += t.amount
      else rec.expense += Math.abs(t.amount)
      map.set(k, rec)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        month: monthLabel(k),
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
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dy={4} />
          <YAxis tickFormatter={formatK} tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dx={-4} width={40} />
          <Tooltip content={<BarTooltip />} />
          <Bar dataKey="income"  fill="#34c759" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expense" fill="#ff3b30" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Donut chart: gastos por categoría ─────────────────────────────────────────

const CAT_COLORS = [
  '#ff3b30', '#ff9f0a', '#ffcc00', '#34c759',
  '#0071e3', '#5856d6', '#af52de', '#ff2d55', '#a1a1aa',
]

export function ExpenseCategoryDonut({ transactions }: { transactions: CashflowTransaction[] }) {
  const expenses = transactions.filter((t) => t.type === 'expense')
  const catMap = new Map<string, number>()
  for (const t of expenses) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + Math.abs(t.amount))
  }
  const segments = Array.from(catMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([label, amount], i) => ({ label, amount: Math.round(amount), color: CAT_COLORS[i % CAT_COLORS.length] }))

  const total = segments.reduce((s, d) => s + d.amount, 0)
  const cx = 72, cy = 72, r = 52, sw = 16
  const circ = 2 * Math.PI * r

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-5">
        Gastos por categoría
      </p>
      {total === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">Sin gastos</p>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut */}
          <svg width="144" height="144" viewBox="0 0 144 144" className="shrink-0">
            {(() => {
              let cum = 0
              return segments.filter((d) => d.amount > 0).map((d, i) => {
                const dash = (d.amount / total) * circ
                const rotation = -90 + (cum / total) * 360
                cum += d.amount
                return (
                  <circle
                    key={i}
                    cx={cx} cy={cy} r={r}
                    fill="none"
                    stroke={d.color}
                    strokeWidth={sw}
                    strokeDasharray={`${dash.toFixed(3)} ${(circ - dash).toFixed(3)}`}
                    transform={`rotate(${rotation.toFixed(3)} ${cx} ${cy})`}
                  />
                )
              })
            })()}
            <text x={cx} y={cy + 1} textAnchor="middle" fontSize={13} fontWeight="700" fill="#18181b">
              {formatK(total)}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize={9} fill="#a1a1aa" fontWeight="500">
              total gasto
            </text>
          </svg>
          {/* Legend */}
          <div className="flex-1 space-y-2 min-w-0">
            {segments.slice(0, 8).map((seg) => (
              <div key={seg.label} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span className="text-xs text-zinc-600 truncate">{seg.label}</span>
                </div>
                <span className="text-xs font-mono text-zinc-400 shrink-0">{formatEur(seg.amount)}</span>
              </div>
            ))}
          </div>
        </div>
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
      // Fallback: cumulative net flow
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
          <YAxis tickFormatter={formatK} tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dx={-4} width={44} />
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
