'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getActiveConfig } from '@/lib/deals'
import { formatCurrency } from '@/lib/format'
import { assignDealOwnerAction } from '@/app/actions/assign-owner'
import type { Deal, DealCommercialStatus, DealStage } from '@/types'
import type { AuthUser } from '@/lib/auth'

// ---- Display maps ----

const STAGE_LABELS: Record<DealStage, string> = {
  prospecting: 'Prospecting',
  qualified: 'Qualified',
  proposal_sent: 'Propuesta enviada',
  negotiation: 'Negociación',
  closed_won: 'Cerrado ganado',
  closed_lost: 'Cerrado perdido',
  rejected: 'Rechazado',
}

const STAGE_COLORS: Record<DealStage, string> = {
  prospecting:   'bg-border-subtle text-text-tertiary',
  qualified:     'bg-info/12 text-info',
  proposal_sent: 'bg-accent-muted text-accent-text',
  negotiation:   'bg-warning/12 text-warning',
  closed_won:    'bg-success/12 text-success',
  closed_lost:   'bg-danger/12 text-danger',
  rejected:      'bg-danger/12 text-danger',
}

function paybackColor(months: number): string {
  if (months <= 12) return 'text-success'
  if (months <= 24) return 'text-warning'
  return 'text-danger'
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
  primary:   'bg-accent text-base hover:bg-accent-hover',
  secondary: 'bg-info/12 text-info hover:bg-info/20',
  outline:   'border border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary',
}

// ---- Status badge ----

const STATUS_CONFIG: Record<DealCommercialStatus, { label: string; cls: string; dot?: string }> = {
  no_config:        { label: '+ Configurar',    cls: 'bg-accent text-base hover:bg-accent-hover cursor-pointer' },
  configured:       { label: 'Configurado',     cls: 'bg-border-subtle text-text-tertiary', dot: 'bg-text-tertiary' },
  proposal_created: { label: 'Propuesta lista', cls: 'bg-success/12 text-success border border-success/20', dot: 'bg-success' },
  proposal_sent:    { label: 'Enviada',          cls: 'bg-info/12 text-info border border-info/20', dot: 'bg-info' },
  viewed:           { label: 'Vista',            cls: 'bg-warning/12 text-warning border border-warning/20', dot: 'bg-warning' },
  negotiating:      { label: 'Negociando',       cls: 'bg-warning/12 text-warning border border-warning/30', dot: 'bg-warning' },
  signed:           { label: 'Firmada ✓',        cls: 'bg-success text-base font-semibold' },
}

function StatusBadge({ status, dealId }: { status: DealCommercialStatus; dealId: string }) {
  const cfg = STATUS_CONFIG[status]
  if (status === 'no_config') {
    return (
      <Link
        href={`/deals/${dealId}/configurador`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-opacity whitespace-nowrap ${cfg.cls}`}
      >
        {cfg.label}
      </Link>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium whitespace-nowrap ${cfg.cls}`}>
      {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />}
      {cfg.label}
    </span>
  )
}

// ---- Filter config ----

type FilterKey = 'all' | DealCommercialStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',              label: 'Todos' },
  { key: 'signed',           label: 'Firmadas' },
  { key: 'negotiating',      label: 'Negociando' },
  { key: 'viewed',           label: 'Vista' },
  { key: 'proposal_sent',    label: 'Enviada' },
  { key: 'proposal_created', label: 'Propuesta lista' },
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

function matchesQuery(deal: Deal, q: string): boolean {
  const lq = q.toLowerCase()
  return (
    deal.company.name.toLowerCase().includes(lq) ||
    (deal.company.brandName?.toLowerCase().includes(lq) ?? false) ||
    deal.contact.name.toLowerCase().includes(lq)
  )
}

export function DealsTable({
  deals,
  initialFilter,
  focusMode = false,
  currentUser,
  members = [],
}: {
  deals: Deal[]
  initialFilter?: string
  focusMode?: boolean
  currentUser?: AuthUser
  members?: AuthUser[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [filter, setFilter] = useState<FilterKey>(() =>
    focusMode ? 'proposal_created' : toFilterKey(initialFilter)
  )
  const [query, setQuery] = useState('')

  function handleFilter(key: FilterKey) {
    setFilter(key)
    // Preserve existing params (e.g. scope) when changing status filter
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    )
    if (key !== 'all') {
      params.set('status', key)
    } else {
      params.delete('status')
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const queryFiltered = query ? deals.filter((d) => matchesQuery(d, query)) : deals
  const visible = filter === 'all' ? queryFiltered : queryFiltered.filter((d) => d.commercialStatus === filter)

  const counts: Record<FilterKey, number> = {
    all:              queryFiltered.length,
    signed:           queryFiltered.filter((d) => d.commercialStatus === 'signed').length,
    negotiating:      queryFiltered.filter((d) => d.commercialStatus === 'negotiating').length,
    viewed:           queryFiltered.filter((d) => d.commercialStatus === 'viewed').length,
    proposal_sent:    queryFiltered.filter((d) => d.commercialStatus === 'proposal_sent').length,
    proposal_created: queryFiltered.filter((d) => d.commercialStatus === 'proposal_created').length,
    configured:       queryFiltered.filter((d) => d.commercialStatus === 'configured').length,
    no_config:        queryFiltered.filter((d) => d.commercialStatus === 'no_config').length,
  }

  return (
    <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
      {/* Search + filter bar — hidden in focus mode */}
      {!focusMode && (
        <>
        <div className="px-4 pt-3 pb-2 border-b border-border-subtle">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" />
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
        <div className="px-4 py-2.5 border-b border-border-subtle flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key
            const count = counts[key]
            return (
              <button
                key={key}
                onClick={() => handleFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-[6px] text-[13px] font-medium transition-colors duration-150 ${
                  active
                    ? key === 'proposal_created'
                      ? 'bg-success/12 text-success'
                      : 'bg-accent-muted text-accent-text'
                    : 'bg-hover text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {label}
                <span className={`text-[11px] font-mono tabular-nums ${active ? 'opacity-70' : 'opacity-50'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        </>
      )}

      {/* Responsive scroll wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[900px]">
          <thead>
            <tr className="border-b border-border-subtle bg-hover">
              <th className="text-left px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap w-[200px]">Empresa</th>
              <th className="text-left px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Contacto</th>
              <th className="text-left px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Stage</th>
              <th className="text-left px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap">Estado</th>
              <th className="text-right px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap" title="Basado en versión activa">MRR</th>
              <th className="text-right px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">ARR</th>
              <th className="text-right px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Payback</th>
              <th className="text-left px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap hidden md:table-cell w-[90px]">Owner</th>
              <th className="text-right px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Actividad</th>
              <th className="px-3 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-[13px] text-text-tertiary">
                  {query ? 'Sin resultados para esa búsqueda.' : 'No hay deals con ese estado.'}
                </td>
              </tr>
            ) : (
              visible.map((deal) => (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  isAdmin={currentUser?.role === 'admin'}
                  members={members}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-border-subtle bg-hover">
        <p className="text-[11px] text-text-tertiary">MRR y ARR basados en la versión activa de cada deal</p>
      </div>
    </div>
  )
}

// ---- Row ----

function DealRow({
  deal,
  isAdmin = false,
  members = [],
}: {
  deal: Deal
  isAdmin?: boolean
  members?: AuthUser[]
}) {
  const cfg = getActiveConfig(deal)
  const mrr = cfg?.economics.totalMonthlyRevenue ?? 0
  const arr = cfg?.economics.annualRevenue ?? 0
  const payback = cfg?.economics.paybackMonths ?? null
  const versionLabel = cfg ? `v${cfg.version}${cfg.label ? ` · ${cfg.label}` : ''}` : null
  const hot = ['signed', 'negotiating', 'viewed', 'proposal_sent', 'proposal_created'].includes(deal.commercialStatus)
  const stale = !!deal.lastActivityAt && isStale(deal.lastActivityAt) && !hot

  return (
    <tr className={`transition-colors duration-150 group align-middle h-11 ${
      deal.commercialStatus === 'signed' ? 'bg-success/5 hover:bg-success/8' :
      hot ? 'hover:bg-hover' :
      stale ? 'hover:bg-hover' :
      'hover:bg-hover'
    }`}>

      {/* Empresa */}
      <td className={`py-2 px-3 ${hot ? 'border-l-2 border-accent' : stale ? 'border-l-2 border-warning/40' : ''}`}>
        <Link href={`/deals/${deal.id}`} className="block">
          <p className={`font-medium text-[13px] leading-snug truncate group-hover:text-accent-text transition-colors ${stale ? 'text-text-secondary' : 'text-text-primary'}`}>
            {deal.company.name}
          </p>
          {deal.company.brandName && (
            <p className="text-[12px] text-text-tertiary truncate leading-snug">{deal.company.brandName}</p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {deal.company.city && (
              <span className="text-[12px] text-text-tertiary truncate">{deal.company.city}</span>
            )}
            {hot && (
              <span className="text-[10px] font-medium text-success bg-success/12 px-1.5 py-0.5 rounded-[4px] whitespace-nowrap leading-none">
                Listo ✓
              </span>
            )}
            {stale && (
              <span className="text-[10px] font-medium text-warning bg-warning/12 px-1.5 py-0.5 rounded-[4px] whitespace-nowrap leading-none">
                Sin actividad
              </span>
            )}
          </div>
        </Link>
      </td>

      {/* Contacto */}
      <td className="px-3 py-2 hidden md:table-cell">
        <Link href={`/deals/${deal.id}`} className="block">
          {deal.contact.name !== 'Sin contacto' ? (
            <>
              <p className="text-[13px] text-text-primary truncate max-w-[140px]">{deal.contact.name}</p>
              <p className="text-[12px] text-text-tertiary truncate max-w-[140px]">{deal.contact.email || 'Sin email'}</p>
            </>
          ) : (
            <p className="text-[12px] text-text-tertiary">Sin contacto</p>
          )}
        </Link>
      </td>

      {/* Stage */}
      <td className="px-3 py-2 hidden lg:table-cell">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium uppercase tracking-wide whitespace-nowrap ${STAGE_COLORS[deal.stage]}`}>
          {STAGE_LABELS[deal.stage]}
        </span>
      </td>

      {/* Estado */}
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={deal.commercialStatus} dealId={deal.id} />
          {versionLabel && (
            <span className="text-[10px] font-mono text-text-tertiary leading-none">{versionLabel}</span>
          )}
        </div>
      </td>

      {/* MRR */}
      <td className="px-3 py-2 text-right">
        {cfg ? (
          <span className="font-mono font-semibold text-[13px] text-text-primary tabular-nums">{formatCurrency(mrr)}</span>
        ) : (
          <span className="text-[13px] text-text-disabled">—</span>
        )}
      </td>

      {/* ARR */}
      <td className="px-3 py-2 text-right hidden lg:table-cell">
        {cfg ? (
          <span className="font-mono text-[13px] text-text-secondary tabular-nums">{formatCurrency(arr)}</span>
        ) : (
          <span className="text-[13px] text-text-disabled">—</span>
        )}
      </td>

      {/* Payback */}
      <td className="px-3 py-2 text-right hidden lg:table-cell">
        {cfg ? (
          payback !== null ? (
            <span className={`font-mono text-[13px] font-medium tabular-nums ${paybackColor(payback)}`}>{payback}m</span>
          ) : (
            <span className="text-[13px] text-text-tertiary">—</span>
          )
        ) : (
          <span className="text-[13px] text-text-disabled">—</span>
        )}
      </td>

      {/* Owner */}
      <td className="px-3 py-2 hidden md:table-cell">
        {isAdmin && members.length > 0 ? (
          <OwnerSelect deal={deal} members={members} />
        ) : (
          <span className="text-[13px] text-text-secondary truncate block max-w-[90px]">{deal.owner.split(' ')[0]}</span>
        )}
      </td>

      {/* Última actividad */}
      <td className="px-3 py-2 text-right hidden md:table-cell">
        {(() => {
          const label = formatActivity(deal.lastActivityAt)
          const noActivity = label === '—'
          const isOld = !noActivity && deal.lastActivityAt && isStale(deal.lastActivityAt)
          return (
            <span className={`text-[13px] font-mono tabular-nums ${
              noActivity ? 'text-text-disabled' :
              isOld ? 'text-warning' :
              'text-text-tertiary'
            }`}>
              {label}
            </span>
          )
        })()}
      </td>

      {/* Acción principal */}
      <td className="px-3 py-2 text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <Link
            href={`/deals/${deal.id}/configurador`}
            className="px-2 h-8 rounded-[6px] text-[12px] font-medium border border-border-subtle text-text-tertiary hover:border-border-strong hover:text-text-secondary transition-colors duration-150 whitespace-nowrap hidden sm:inline-flex items-center"
          >
            Sim
          </Link>
          {(() => {
            const { label, href, variant } = getDealCTA(deal)
            return (
              <Link
                href={href}
                className={`inline-flex items-center px-2.5 h-8 rounded-[6px] text-[12px] font-semibold transition-colors duration-150 whitespace-nowrap ${CTA_STYLES[variant]}`}
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

// ---- Owner assign (admin only) ----

function OwnerSelect({ deal, members }: { deal: Deal; members: AuthUser[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newOwnerId = e.target.value
    if (!newOwnerId) return
    startTransition(async () => {
      await assignDealOwnerAction(deal.id, newOwnerId)
      router.refresh()
    })
  }

  const current = members.find((m) => m.id === deal.ownerId)

  return (
    <select
      defaultValue={deal.ownerId ?? ''}
      onChange={handleChange}
      className="text-[13px] text-text-secondary border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/40 rounded px-0 py-0 max-w-[90px] cursor-pointer"
      title="Asignar responsable"
    >
      <option value="" disabled>{current ? current.name ?? current.email.split('@')[0] : '—'}</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name ?? m.email.split('@')[0]}
        </option>
      ))}
    </select>
  )
}
