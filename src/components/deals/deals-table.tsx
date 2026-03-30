'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getActiveConfig } from '@/lib/deals'
import { formatCurrency } from '@/lib/format'
import type { Deal, DealCommercialStatus, DealStage } from '@/types'

// ---- Display maps ----

const STAGE_LABELS: Record<DealStage, string> = {
  prospecting: 'Prospecting',
  qualified: 'Qualified',
  proposal_sent: 'Propuesta enviada',
  negotiation: 'Negociación',
  closed_won: 'Cerrado ganado',
  closed_lost: 'Cerrado perdido',
}

const STAGE_COLORS: Record<DealStage, string> = {
  prospecting: 'bg-zinc-100 text-zinc-600',
  qualified: 'bg-blue-50 text-blue-700',
  proposal_sent: 'bg-violet-50 text-violet-700',
  negotiation: 'bg-amber-50 text-amber-700',
  closed_won: 'bg-emerald-50 text-emerald-700',
  closed_lost: 'bg-red-50 text-red-600',
}

function paybackColor(months: number): string {
  if (months <= 12) return 'text-emerald-600'
  if (months <= 24) return 'text-amber-600'
  return 'text-red-500'
}

// ---- CTA helper ----

type CTAVariant = 'primary' | 'secondary' | 'outline'

function getDealCTA(deal: Deal): { label: string; href: string; variant: CTAVariant } {
  if (deal.commercialStatus === 'no_config')
    return { label: 'Configurar', href: `/deals/${deal.id}/configurador`, variant: 'primary' }
  if (deal.commercialStatus === 'configured')
    return { label: 'Crear propuesta', href: `/deals/${deal.id}/propuesta`, variant: 'secondary' }
  return { label: 'Ver propuesta', href: `/deals/${deal.id}/propuesta`, variant: 'outline' }
}

const CTA_STYLES: Record<CTAVariant, string> = {
  primary:   'bg-zinc-900 text-white hover:bg-zinc-700',
  secondary: 'bg-blue-600 text-white hover:bg-blue-500',
  outline:   'border border-zinc-300 text-zinc-600 hover:border-zinc-500 hover:text-zinc-900',
}

// ---- Status badge ----

function StatusBadge({ status, dealId }: { status: DealCommercialStatus; dealId: string }) {
  if (status === 'no_config') {
    return (
      <Link
        href={`/deals/${dealId}/configurador`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 transition-colors whitespace-nowrap"
      >
        + Configurar
      </Link>
    )
  }
  if (status === 'configured') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        Configurado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white ring-1 ring-emerald-500/40 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
      Propuesta creada
    </span>
  )
}

// ---- Filter config ----

type FilterKey = 'all' | DealCommercialStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',              label: 'Todos' },
  { key: 'proposal_created', label: 'Propuesta creada' },
  { key: 'configured',       label: 'Configurado' },
  { key: 'no_config',        label: 'Sin config' },
]

// ---- Stale detection & activity formatting ----

const STALE_DAYS = 3

function isStale(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000
}

function formatActivity(isoDate: string | null): string {
  if (!isoDate) return '—'
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  return `Hace ${diffDays}d`
}

// ---- Main component ----

function toFilterKey(s: string | undefined): FilterKey {
  if (s === 'proposal_created' || s === 'configured' || s === 'no_config') return s
  return 'all'
}

export function DealsTable({
  deals,
  initialFilter,
  focusMode = false,
}: {
  deals: Deal[]
  initialFilter?: string
  focusMode?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [filter, setFilter] = useState<FilterKey>(() =>
    focusMode ? 'proposal_created' : toFilterKey(initialFilter)
  )

  function handleFilter(key: FilterKey) {
    setFilter(key)
    const params = new URLSearchParams()
    if (key !== 'all') params.set('status', key)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const visible = filter === 'all' ? deals : deals.filter((d) => d.commercialStatus === filter)

  const counts: Record<FilterKey, number> = {
    all:              deals.length,
    proposal_created: deals.filter((d) => d.commercialStatus === 'proposal_created').length,
    configured:       deals.filter((d) => d.commercialStatus === 'configured').length,
    no_config:        deals.filter((d) => d.commercialStatus === 'no_config').length,
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* Filter bar — hidden in focus mode */}
      {!focusMode && (
        <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key
            const count = counts[key]
            return (
              <button
                key={key}
                onClick={() => handleFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? key === 'proposal_created'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-900 text-white'
                    : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
                }`}
              >
                {label}
                <span className={`text-[10px] font-mono tabular-nums ${active ? 'opacity-70' : 'opacity-50'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Responsive scroll wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide w-[220px]">Empresa</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden md:table-cell">Contacto</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden lg:table-cell">Stage</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Estado</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide" title="Basado en versión activa">MRR</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden lg:table-cell">ARR</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden lg:table-cell">Payback</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden md:table-cell w-[100px]">Owner</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden md:table-cell">Actividad</th>
              <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-zinc-400">
                  No hay deals con ese estado.
                </td>
              </tr>
            ) : (
              visible.map((deal) => <DealRow key={deal.id} deal={deal} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50">
        <p className="text-[11px] text-zinc-400">MRR y ARR basados en la versión activa de cada deal</p>
      </div>
    </div>
  )
}

// ---- Proposal view badge ----

function ProposalViewBadge({ lastViewAt }: { lastViewAt: string | null }) {
  if (!lastViewAt) {
    return (
      <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">
        No abierta
      </span>
    )
  }
  const diffH = (Date.now() - new Date(lastViewAt).getTime()) / 3600000
  if (diffH > 48) {
    return (
      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">
        Vista hace +48h
      </span>
    )
  }
  return (
    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">
      Vista recientemente
    </span>
  )
}

// ---- Row ----

function DealRow({ deal }: { deal: Deal }) {
  const cfg = getActiveConfig(deal)
  const mrr = cfg?.economics.totalMonthlyRevenue ?? 0
  const arr = cfg?.economics.annualRevenue ?? 0
  const payback = cfg?.economics.paybackMonths ?? null
  const versionLabel = cfg ? `v${cfg.version}${cfg.label ? ` · ${cfg.label}` : ''}` : null
  const hot = deal.commercialStatus === 'proposal_created'
  const stale = !!deal.lastActivityAt && isStale(deal.lastActivityAt) && !hot

  const borderCls = hot
    ? 'pl-3 pr-4 border-l-2 border-emerald-400'
    : stale
    ? 'pl-3 pr-4 border-l-2 border-orange-300'
    : 'px-4'

  return (
    <tr className={`transition-colors group align-middle ${
      hot ? 'bg-emerald-50/40 hover:bg-emerald-50/70' :
      stale ? 'hover:bg-orange-50/20' :
      'hover:bg-zinc-50/60'
    }`}>

      {/* Empresa */}
      <td className={`py-3 ${borderCls}`}>
        <Link href={`/deals/${deal.id}`} className="block">
          <p className={`font-medium text-sm leading-snug truncate group-hover:text-blue-600 transition-colors ${stale ? 'text-zinc-500' : 'text-zinc-900'}`}>
            {deal.company.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {deal.company.city && (
              <span className="text-xs text-zinc-400 truncate">{deal.company.city}</span>
            )}
            {hot && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">
                Listo ✓
              </span>
            )}
            {stale && (
              <span className="text-[10px] font-medium text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">
                Sin actividad
              </span>
            )}
            {hot && <ProposalViewBadge lastViewAt={deal.lastProposalViewAt} />}
          </div>
        </Link>
      </td>

      {/* Contacto */}
      <td className="px-4 py-3 hidden md:table-cell">
        <Link href={`/deals/${deal.id}`} className="block">
          {deal.contact.name !== 'Sin contacto' ? (
            <>
              <p className="text-sm text-zinc-700 truncate max-w-[140px]">{deal.contact.name}</p>
              <p className="text-xs text-zinc-400 truncate max-w-[140px]">{deal.contact.email || 'Sin email'}</p>
            </>
          ) : (
            <p className="text-xs text-zinc-400">Sin contacto</p>
          )}
        </Link>
      </td>

      {/* Stage */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STAGE_COLORS[deal.stage]}`}>
          {STAGE_LABELS[deal.stage]}
        </span>
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={deal.commercialStatus} dealId={deal.id} />
          {versionLabel && (
            <span className="text-[10px] font-mono text-zinc-400 leading-none">{versionLabel}</span>
          )}
        </div>
      </td>

      {/* MRR */}
      <td className="px-4 py-3 text-right">
        {cfg ? (
          <span className="font-mono font-semibold text-sm text-zinc-900 tabular-nums">{formatCurrency(mrr)}</span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>

      {/* ARR */}
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        {cfg ? (
          <span className="font-mono text-sm text-zinc-500 tabular-nums">{formatCurrency(arr)}</span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>

      {/* Payback */}
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        {cfg ? (
          payback !== null ? (
            <span className={`font-mono text-sm font-medium tabular-nums ${paybackColor(payback)}`}>{payback}m</span>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          )
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>

      {/* Owner */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-xs text-zinc-500 truncate block max-w-[90px]">{deal.owner.split(' ')[0]}</span>
      </td>

      {/* Última actividad */}
      <td className="px-4 py-3 text-right hidden md:table-cell">
        {(() => {
          const label = formatActivity(deal.lastActivityAt)
          const noActivity = label === '—'
          const isOld = !noActivity && deal.lastActivityAt && isStale(deal.lastActivityAt)
          return (
            <span className={`text-xs font-mono tabular-nums ${
              noActivity ? 'text-zinc-300' :
              isOld ? 'text-orange-400' :
              'text-zinc-400'
            }`}>
              {label}
            </span>
          )
        })()}
      </td>

      {/* Acción principal */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <Link
            href={`/deals/${deal.id}/configurador`}
            className="px-2 py-1 rounded-md text-xs font-medium border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 transition-colors whitespace-nowrap hidden sm:inline-flex"
          >
            Sim
          </Link>
          {(() => {
            const { label, href, variant } = getDealCTA(deal)
            return (
              <Link
                href={href}
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${CTA_STYLES[variant]}`}
              >
                {label}
              </Link>
            )
          })()}
        </div>
      </td>
    </tr>
  )
}
