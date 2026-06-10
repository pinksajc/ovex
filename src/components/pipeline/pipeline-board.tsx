'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getActiveConfig } from '@/lib/deals'
import { formatCurrency } from '@/lib/format'
import type { Deal, DealStage } from '@/types'

const STAGE_ORDER: DealStage[] = [
  'prospecting',
  'qualified',
  'proposal_sent',
  'negotiation',
  'closed_won',
  'closed_lost',
  'rejected',
]

const STAGE_LABELS: Record<DealStage, string> = {
  prospecting: 'Prospecting',
  qualified: 'Qualified',
  proposal_sent: 'Propuesta enviada',
  negotiation: 'Negociación',
  closed_won: 'Cerrado ganado',
  closed_lost: 'Cerrado perdido',
  rejected: 'Rechazado',
}

const STAGE_COLORS: Record<DealStage, { header: string; card: string }> = {
  prospecting:   { header: 'bg-zinc-100 text-zinc-600',      card: 'border-zinc-200' },
  qualified:     { header: 'bg-blue-50 text-blue-700',       card: 'border-blue-100' },
  proposal_sent: { header: 'bg-violet-50 text-violet-700',   card: 'border-violet-100' },
  negotiation:   { header: 'bg-amber-50 text-amber-700',     card: 'border-amber-100' },
  closed_won:    { header: 'bg-emerald-50 text-emerald-700', card: 'border-emerald-100' },
  closed_lost:   { header: 'bg-red-50 text-red-600',         card: 'border-red-100' },
  rejected:      { header: 'bg-red-100 text-red-700',        card: 'border-red-200' },
}

function matchesQuery(deal: Deal, q: string): boolean {
  const lq = q.toLowerCase()
  return (
    deal.company.name.toLowerCase().includes(lq) ||
    (deal.company.brandName?.toLowerCase().includes(lq) ?? false) ||
    deal.contact.name.toLowerCase().includes(lq)
  )
}

export function PipelineBoard({ deals }: { deals: Deal[] }) {
  const [query, setQuery] = useState('')

  const filtered = query ? deals.filter((d) => matchesQuery(d, query)) : deals

  const byStage = STAGE_ORDER.reduce<Record<DealStage, Deal[]>>(
    (acc, stage) => ({ ...acc, [stage]: [] }),
    {} as Record<DealStage, Deal[]>
  )
  for (const deal of filtered) byStage[deal.stage].push(deal)

  const activeStages = STAGE_ORDER.filter((s) => s !== 'closed_lost')

  return (
    <>
      {/* Search */}
      <div className="mb-5">
        <div className="relative max-w-xs">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por empresa, marca o contacto…"
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent bg-white placeholder:text-zinc-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
        {activeStages.map((stage) => {
          const stageDeals = byStage[stage]
          const stageMRR = stageDeals.reduce(
            (sum, d) => sum + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0),
            0
          )
          const colors = STAGE_COLORS[stage]

          return (
            <div key={stage} className="flex-none w-64 flex flex-col gap-2">
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${colors.header}`}>
                <span className="text-xs font-semibold">{STAGE_LABELS[stage]}</span>
                <span className="text-xs font-mono">{stageDeals.length}</span>
              </div>

              {stageMRR > 0 && (
                <p className="text-[11px] text-zinc-400 font-mono px-1">
                  {formatCurrency(stageMRR)}/mes
                </p>
              )}

              <div className="flex flex-col gap-2">
                {stageDeals.length === 0 && (
                  <p className="text-xs text-zinc-300 px-1 py-3 text-center">
                    {query ? '—' : 'Sin deals'}
                  </p>
                )}
                {stageDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            </div>
          )
        })}

        {/* Closed lost — collapsed */}
        <div className="flex-none w-48 flex flex-col gap-2">
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${STAGE_COLORS.closed_lost.header}`}>
            <span className="text-xs font-semibold">{STAGE_LABELS.closed_lost}</span>
            <span className="text-xs font-mono">{byStage.closed_lost.length}</span>
          </div>
        </div>
      </div>
    </>
  )
}

function DealCard({ deal }: { deal: Deal }) {
  const cfg = getActiveConfig(deal)
  const mrr = cfg?.economics.totalMonthlyRevenue ?? 0

  return (
    <Link
      href={`/deals/${deal.id}`}
      className={`block bg-white border rounded-xl p-3 hover:shadow-sm transition-shadow ${STAGE_COLORS[deal.stage].card}`}
    >
      <p className="text-sm font-medium text-zinc-900 truncate">{deal.company.name}</p>
      {deal.company.brandName && (
        <p className="text-xs text-zinc-400 truncate mt-0.5">{deal.company.brandName}</p>
      )}
      {deal.company.city && !deal.company.brandName && (
        <p className="text-xs text-zinc-400 mt-0.5">{deal.company.city}</p>
      )}
      {mrr > 0 && (
        <p className="text-xs font-mono font-semibold text-zinc-700 mt-2">
          {formatCurrency(mrr)}/mes
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-zinc-400">{deal.owner.split(' ')[0]}</span>
        {deal.commercialStatus === 'proposal_created' && (
          <span className="text-[10px] bg-zinc-900 text-white px-1.5 py-0.5 rounded-full">
            Propuesta
          </span>
        )}
        {deal.commercialStatus === 'no_config' && (
          <span className="text-[10px] text-zinc-300">Sin config</span>
        )}
      </div>
    </Link>
  )
}
