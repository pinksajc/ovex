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
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-zinc-100 text-xs">
      <p className="font-semibold text-zinc-700 mb-1">{label}</p>
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

        {/* Real MRR line */}
        <Line
          type="monotone"
          dataKey="mrr"
          stroke="#0071e3"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: '#0071e3', strokeWidth: 0 }}
          connectNulls={false}
        />

        {/* Projected MRR line — dashed, lighter */}
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

        {/* Highlighted dot on last real point */}
        {lastReal && (
          <ReferenceDot
            x={lastReal.month}
            y={currentMrr}
            r={5}
            fill="#0071e3"
            stroke="white"
            strokeWidth={2}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
