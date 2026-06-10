'use client'

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
import { chartColors } from '@/lib/design-tokens'

export interface MrrPoint {
  month: string
  mrr?: number
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

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-4 py-3 border text-xs"
      style={{
        background: chartColors.tooltipBg,
        borderColor: chartColors.tooltipBorder,
        color: chartColors.tooltipText,
      }}
    >
      <p className="font-medium mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name === 'mrr' ? 'Real' : 'Proyectado'}: {formatEur(p.value)}
        </p>
      ))}
    </div>
  )
}

export function MrrChart({
  data,
  currentMrr,
}: {
  data: MrrPoint[]
  currentMrr: number
}) {
  // Find the last real data point month for the reference dot
  const lastReal = [...data].reverse().find((d) => d.mrr != null)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="0" stroke={chartColors.grid} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: chartColors.axis }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tickFormatter={formatEur}
          tick={{ fontSize: 11, fill: chartColors.axis }}
          axisLine={false}
          tickLine={false}
          dx={-4}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Real MRR line */}
        <Line
          type="monotone"
          dataKey="mrr"
          stroke={chartColors.primary}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: chartColors.primary, strokeWidth: 0 }}
          connectNulls={false}
        />

        {/* Projected MRR line — dashed, lighter */}
        <Line
          type="monotone"
          dataKey="projected"
          stroke={chartColors.primary}
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeOpacity={0.4}
          dot={false}
          activeDot={{ r: 4, fill: chartColors.primary, strokeWidth: 0 }}
          connectNulls={false}
        />

        {/* Highlighted dot on last real point */}
        {lastReal && (
          <ReferenceDot
            x={lastReal.month}
            y={currentMrr}
            r={5}
            fill={chartColors.primary}
            stroke={chartColors.tooltipBg}
            strokeWidth={2}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
