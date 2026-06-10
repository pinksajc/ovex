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

const STAGE_ACCENT: Record<DealStage, string> = {
  prospecting:   '#62626B',
  qualified:     '#60A5FA',
  proposal_sent: '#7C72E8',
  negotiation:   '#FBBF24',
  closed_won:    '#4ADE80',
  closed_lost:   '#F87171',
  rejected:      '#F87171',
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
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none"
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
            className="w-full pl-7 pr-3 h-9 text-[13px] border border-border-subtle rounded-[6px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary placeholder:text-text-tertiary"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 flex-1 items-start">
        {activeStages.map((stage) => {
          const stageDeals = byStage[stage]
          const stageMRR = stageDeals.reduce(
            (sum, d) => sum + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0),
            0
          )
          const accent = STAGE_ACCENT[stage]

          return (
            <div key={stage} className="flex-none w-60 flex flex-col gap-2">
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-[6px] bg-surface border border-border-subtle"
                style={{ borderTopColor: accent, borderTopWidth: 2 }}
              >
                <span className="text-[12px] font-medium text-text-secondary">{STAGE_LABELS[stage]}</span>
                <span
                  className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-[4px]"
                  style={{ color: accent, background: `${accent}18` }}
                >
                  {stageDeals.length}
                </span>
              </div>

              {stageMRR > 0 && (
                <p className="text-[11px] text-text-tertiary font-mono px-1">
                  {formatCurrency(stageMRR)}/mes
                </p>
              )}

              <div className="flex flex-col gap-2">
                {stageDeals.length === 0 && (
                  <p className="text-[12px] text-text-disabled px-1 py-3 text-center">
                    {query ? '—' : 'Sin deals'}
                  </p>
                )}
                {stageDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} accent={accent} />
                ))}
              </div>
            </div>
          )
        })}

        {/* Closed lost — collapsed */}
        <div className="flex-none w-48 flex flex-col gap-2">
          <div
            className="flex items-center justify-between px-3 py-2 rounded-[6px] bg-surface border border-border-subtle"
            style={{ borderTopColor: STAGE_ACCENT.closed_lost, borderTopWidth: 2 }}
          >
            <span className="text-[12px] font-medium text-text-tertiary">{STAGE_LABELS.closed_lost}</span>
            <span
              className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-[4px]"
              style={{ color: STAGE_ACCENT.closed_lost, background: `${STAGE_ACCENT.closed_lost}18` }}
            >
              {byStage.closed_lost.length}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function DealCard({ deal, accent }: { deal: Deal; accent: string }) {
  const cfg = getActiveConfig(deal)
  const mrr = cfg?.economics.totalMonthlyRevenue ?? 0

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block bg-surface border border-border-subtle rounded-lg p-3 hover:bg-elevated hover:border-border-strong transition-colors duration-150"
    >
      <p className="text-[13px] font-medium text-text-primary truncate">{deal.company.name}</p>
      {deal.company.brandName && (
        <p className="text-[12px] text-text-tertiary truncate mt-0.5">{deal.company.brandName}</p>
      )}
      {deal.company.city && !deal.company.brandName && (
        <p className="text-[12px] text-text-tertiary mt-0.5">{deal.company.city}</p>
      )}
      {mrr > 0 && (
        <p className="text-[12px] font-mono font-semibold mt-2" style={{ color: accent }}>
          {formatCurrency(mrr)}/mes
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-text-tertiary">{deal.owner.split(' ')[0]}</span>
        {deal.commercialStatus === 'proposal_created' && (
          <span className="text-[10px] bg-accent-muted text-accent-text px-1.5 py-0.5 rounded-[4px]">
            Propuesta
          </span>
        )}
        {deal.commercialStatus === 'no_config' && (
          <span className="text-[10px] text-text-disabled">Sin config</span>
        )}
      </div>
    </Link>
  )
}
