'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getActiveConfig } from '@/lib/deals'
import { formatCurrency } from '@/lib/format'
import { assignDealOwnerAction } from '@/app/actions/assign-owner'
import { bulkDeleteDealsAction } from '@/app/actions/deals'
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
  prospecting: 'bg-zinc-100 text-zinc-600',
  qualified: 'bg-blue-50 text-blue-700',
  proposal_sent: 'bg-violet-50 text-violet-700',
  negotiation: 'bg-amber-50 text-amber-700',
  closed_won: 'bg-emerald-50 text-emerald-700',
  closed_lost: 'bg-red-50 text-red-600',
  rejected: 'bg-red-100 text-red-700',
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

const STATUS_CONFIG: Record<DealCommercialStatus, { label: string; cls: string; dot?: string }> = {
  no_config:        { label: '+ Configurar',    cls: 'bg-zinc-900 text-white' },
  configured:       { label: 'Configurado',     cls: 'bg-zinc-100 text-zinc-700', dot: 'bg-zinc-400' },
  proposal_created: { label: 'Propuesta lista', cls: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500' },
  proposal_sent:    { label: 'Enviada',          cls: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-400' },
  viewed:           { label: 'Vista',            cls: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  negotiating:      { label: 'Negociando',       cls: 'bg-amber-50 text-amber-800 border border-amber-300', dot: 'bg-amber-600' },
  signed:           { label: 'Firmada ✓',        cls: 'bg-emerald-600 text-white font-semibold' },
}

function StatusBadge({ status, dealId }: { status: DealCommercialStatus; dealId: string }) {
  const cfg = STATUS_CONFIG[status]
  if (status === 'no_config') {
    return (
      <Link
        href={`/deals/${dealId}/configurador`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity whitespace-nowrap ${cfg.cls}`}
      >
        {cfg.label}
      </Link>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.cls}`}>
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

  // ── Selection state ───────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  function handleFilter(key: FilterKey) {
    setFilter(key)
    setSelected(new Set())
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

  // Checkbox helpers
  const visibleIds = visible.map((d) => d.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        visibleIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelected((prev) => new Set([...prev, ...visibleIds]))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDeleteConfirmed() {
    const ids = Array.from(selected)
    startTransition(async () => {
      const res = await bulkDeleteDealsAction(ids)
      setShowConfirm(false)
      setSelected(new Set())
      if (res.ok) {
        showToast(`${res.deleted} deal${(res.deleted ?? 0) > 1 ? 's eliminados' : ' eliminado'} correctamente`, 'success')
        router.refresh()
      } else {
        showToast(res.error ?? 'Error al eliminar', 'error')
      }
    })
  }

  return (
    <div className="relative">
      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
          toast.type === 'success'
            ? 'bg-zinc-900 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2.5 8l4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 5v4M8 11.5v.5" strokeLinecap="round" />
              <circle cx="8" cy="8" r="6.5" />
            </svg>
          )}
          {toast.msg}
        </div>
      )}

      {/* ── Confirmation modal ────────────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Eliminar {selected.size} deal{selected.size > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  Se eliminarán también las configuraciones, propuestas y eventos asociados. Las facturas e ingresos vinculados se desasociarán pero no se borrarán.
                </p>
                <p className="text-xs font-semibold text-red-600 mt-2">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPending ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 1.5A6.5 6.5 0 1114.5 8" strokeLinecap="round" />
                    </svg>
                    Eliminando…
                  </>
                ) : (
                  `Eliminar ${selected.size} deal${selected.size > 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* Search + filter bar — hidden in focus mode */}
      {!focusMode && (
        <>
        <div className="px-4 pt-3 pb-2 border-b border-zinc-100">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por empresa, marca o contacto…"
              className="w-full pl-7 pr-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent bg-zinc-50 placeholder:text-zinc-400"
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
        </>
      )}

      {/* ── Selection action bar ─────────────────────────────────────────────── */}
      {someSelected && (
        <div className="px-4 py-2.5 bg-zinc-900 flex items-center justify-between gap-4">
          <span className="text-sm text-white font-medium">
            {selected.size} deal{selected.size > 1 ? 's' : ''} seleccionado{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Deseleccionar todo
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M2 4h12M5.5 4V2.5h5V4M6.5 7v5M9.5 7v5M3.5 4l.5 9.5h8L13 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Eliminar seleccionados
            </button>
          </div>
        </div>
      )}

      {/* Responsive scroll wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[940px]">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              {/* Checkbox column */}
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allVisibleSelected && visibleIds.some((id) => selected.has(id))
                  }}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                  aria-label="Seleccionar todos"
                />
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap w-[200px]">Empresa</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Contacto</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Stage</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap">Estado</th>
              <th className="text-right px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap" title="Basado en versión activa">MRR</th>
              <th className="text-right px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">ARR</th>
              <th className="text-right px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Payback</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap hidden md:table-cell w-[90px]">Owner</th>
              <th className="text-right px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Actividad</th>
              <th className="px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide whitespace-nowrap text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-zinc-400">
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
                  isSelected={selected.has(deal.id)}
                  onToggle={toggleOne}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50">
        <p className="text-[11px] text-zinc-400">MRR y ARR basados en la versión activa de cada deal</p>
      </div>
    </div>
    </div>
  )
}

// ---- Row ----

function DealRow({
  deal,
  isAdmin = false,
  members = [],
  isSelected = false,
  onToggle,
}: {
  deal: Deal
  isAdmin?: boolean
  members?: AuthUser[]
  isSelected?: boolean
  onToggle?: (id: string) => void
}) {
  const cfg = getActiveConfig(deal)
  const mrr = cfg?.economics.totalMonthlyRevenue ?? 0
  const arr = cfg?.economics.annualRevenue ?? 0
  const payback = cfg?.economics.paybackMonths ?? null
  const versionLabel = cfg ? `v${cfg.version}${cfg.label ? ` · ${cfg.label}` : ''}` : null
  const hot = ['signed', 'negotiating', 'viewed', 'proposal_sent', 'proposal_created'].includes(deal.commercialStatus)
  const stale = !!deal.lastActivityAt && isStale(deal.lastActivityAt) && !hot

  const borderCls = hot
    ? 'pl-3 pr-4 border-l-2 border-emerald-400'
    : stale
    ? 'pl-3 pr-4 border-l-2 border-orange-300'
    : 'px-4'

  return (
    <tr className={`transition-colors group align-middle ${
      isSelected ? 'bg-blue-50/40' :
      deal.commercialStatus === 'signed' ? 'bg-emerald-50/30 hover:bg-emerald-50/50' :
      hot ? 'hover:bg-zinc-50/60' :
      stale ? 'hover:bg-orange-50/20' :
      'hover:bg-zinc-50/60'
    }`}>

      {/* Checkbox */}
      <td className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle?.(deal.id)}
          className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
          aria-label={`Seleccionar ${deal.company.name}`}
        />
      </td>

      {/* Empresa */}
      <td className={`py-3 ${borderCls}`}>
        <Link href={`/deals/${deal.id}`} className="block">
          <p className={`font-medium text-sm leading-snug truncate group-hover:text-blue-600 transition-colors ${stale ? 'text-zinc-500' : 'text-zinc-900'}`}>
            {deal.company.name}
          </p>
          {deal.company.brandName && (
            <p className="text-xs text-zinc-400 truncate leading-snug">{deal.company.brandName}</p>
          )}
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
          </div>
        </Link>
      </td>

      {/* Contacto */}
      <td className="px-3 py-3 hidden md:table-cell">
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
      <td className="px-3 py-3 hidden lg:table-cell">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STAGE_COLORS[deal.stage]}`}>
          {STAGE_LABELS[deal.stage]}
        </span>
      </td>

      {/* Estado */}
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={deal.commercialStatus} dealId={deal.id} />
          {versionLabel && (
            <span className="text-[10px] font-mono text-zinc-400 leading-none">{versionLabel}</span>
          )}
        </div>
      </td>

      {/* MRR */}
      <td className="px-3 py-3 text-right">
        {cfg ? (
          <span className="font-mono font-semibold text-sm text-zinc-900 tabular-nums">{formatCurrency(mrr)}</span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>

      {/* ARR */}
      <td className="px-3 py-3 text-right hidden lg:table-cell">
        {cfg ? (
          <span className="font-mono text-sm text-zinc-500 tabular-nums">{formatCurrency(arr)}</span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>

      {/* Payback */}
      <td className="px-3 py-3 text-right hidden lg:table-cell">
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
      <td className="px-3 py-3 hidden md:table-cell">
        {isAdmin && members.length > 0 ? (
          <OwnerSelect deal={deal} members={members} />
        ) : (
          <span className="text-xs text-zinc-500 truncate block max-w-[90px]">{deal.owner.split(' ')[0]}</span>
        )}
      </td>

      {/* Última actividad */}
      <td className="px-3 py-3 text-right hidden md:table-cell">
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
      <td className="px-3 py-3 text-right">
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
      className="text-xs text-zinc-600 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-zinc-300 rounded px-0 py-0 max-w-[90px] cursor-pointer"
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
