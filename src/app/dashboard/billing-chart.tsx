'use client'

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from 'recharts'
import type { Invoice } from '@/types'

export interface BillingPoint {
  month: string
  facturado?: number
  cobrado?: number
  projected?: number
}

function formatEur(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k €`
  return `${Math.round(n)} €`
}

interface TooltipEntry {
  name: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const labelMap: Record<string, string> = {
    facturado: 'Facturado',
    cobrado: 'Cobrado',
    projected: 'Proyectado',
  }
  return (
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-zinc-100 text-xs">
      <p className="font-semibold text-zinc-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {labelMap[p.name] ?? p.name}: {formatEur(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // "YYYY-MM"
}

function monthLabel(key: string): string {
  const [yearStr, monthStr] = key.split('-')
  return new Date(Number(yearStr), Number(monthStr) - 1, 1).toLocaleDateString('es-ES', {
    month: 'short',
    year: '2-digit',
  })
}

function addMonths(key: string, n: number): string {
  const [yearStr, monthStr] = key.split('-')
  const d = new Date(Number(yearStr), Number(monthStr) - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BillingChart({
  invoices,
}: {
  invoices: Invoice[]
}) {
  const now = new Date()
  const defaultTo   = toDateInput(now)
  const defaultFrom = toDateInput(new Date(now.getFullYear(), now.getMonth() - 11, 1))

  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo,   setDateTo]   = useState(defaultTo)

  const data = useMemo<BillingPoint[]>(() => {
    const fromKey = dateFrom.slice(0, 7)
    const toKey   = dateTo.slice(0, 7)
    if (fromKey > toKey) return []

    // Build ordered list of month keys in range
    const months: string[] = []
    let cur = fromKey
    while (cur <= toKey) {
      months.push(cur)
      cur = addMonths(cur, 1)
    }

    // Aggregate invoice amounts per month
    const facturadoMap: Record<string, number> = {}
    const cobradoMap:   Record<string, number> = {}
    for (const inv of invoices) {
      const key = toMonthKey(inv.createdAt)
      if (key < fromKey || key > toKey) continue
      if (inv.status === 'issued' || inv.status === 'paid') {
        facturadoMap[key] = (facturadoMap[key] ?? 0) + inv.amountTotal
      }
      if (inv.status === 'paid') {
        cobradoMap[key] = (cobradoMap[key] ?? 0) + inv.amountTotal
      }
    }

    const real: BillingPoint[] = months.map((key) => ({
      month:      monthLabel(key),
      facturado:  Math.round(facturadoMap[key] ?? 0),
      cobrado:    Math.round(cobradoMap[key] ?? 0),
    }))

    // Projected: 3-month rolling avg of facturado
    const recentKeys = months.slice(-3)
    const avgFact = recentKeys.reduce((s, k) => s + (facturadoMap[k] ?? 0), 0) / Math.max(recentKeys.length, 1)

    // Seed projected from last real data point so lines connect visually
    if (real.length > 0) {
      real[real.length - 1] = {
        ...real[real.length - 1],
        projected: real[real.length - 1].facturado,
      }
    }

    // Append 3 future months
    const lastKey = months[months.length - 1] ?? toKey
    for (let i = 1; i <= 3; i++) {
      real.push({
        month:     monthLabel(addMonths(lastKey, i)),
        projected: Math.round(avgFact * Math.pow(1.05, i)),
      })
    }

    return real
  }, [invoices, dateFrom, dateTo])

  const lastReal = [...data].reverse().find((d) => d.facturado != null)

  return (
    <div>
      {/* Date range inputs */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="text-xs bg-zinc-100 border-0 rounded-lg px-3 py-1.5 text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-300"
        />
        <span className="text-xs text-zinc-400">—</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="text-xs bg-zinc-100 border-0 rounded-lg px-3 py-1.5 text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-300"
        />
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tickFormatter={formatEur}
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={false}
            tickLine={false}
            dx={-4}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Facturado — solid blue */}
          <Line
            type="monotone"
            dataKey="facturado"
            stroke="#0071e3"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#0071e3', strokeWidth: 0 }}
            connectNulls={false}
          />

          {/* Cobrado — solid green */}
          <Line
            type="monotone"
            dataKey="cobrado"
            stroke="#34c759"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#34c759', strokeWidth: 0 }}
            connectNulls={false}
          />

          {/* Proyectado — dashed blue */}
          <Line
            type="monotone"
            dataKey="projected"
            stroke="#0071e3"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeOpacity={0.4}
            dot={false}
            activeDot={{ r: 4, fill: '#0071e3', strokeWidth: 0 }}
            connectNulls={false}
          />

          {/* Highlighted dot on last real facturado point */}
          {lastReal && lastReal.facturado != null && (
            <ReferenceDot
              x={lastReal.month}
              y={lastReal.facturado}
              r={5}
              fill="#0071e3"
              stroke="white"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
