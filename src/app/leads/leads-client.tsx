'use client'

import { useState, useEffect, useTransition, useMemo, useCallback, useRef } from 'react'
import type { AuthUser } from '@/lib/auth'
import type { AttioDeal, AttioDealStage } from '@/app/api/leads/attio/route'
import type { DealStage } from '@/types'

// ── Stage colours (light theme, matching ofertas badges) ──────────────────────
const STAGE_COLORS: Record<string, string> = {
  lead:        'bg-blue-50 text-blue-700',
  in_progress: 'bg-orange-50 text-orange-700',
  inprogress:  'bg-orange-50 text-orange-700',
  negotiating: 'bg-amber-50 text-amber-700',
  negotiation: 'bg-amber-50 text-amber-700',
  won:         'bg-emerald-50 text-emerald-700',
  closed_won:  'bg-emerald-50 text-emerald-700',
  lost:        'bg-red-50 text-red-700',
  closed_lost: 'bg-red-50 text-red-700',
}
function stageCls(slug: string) {
  return STAGE_COLORS[slug.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600'
}

const ORVEX_STAGES: { value: DealStage; label: string }[] = [
  { value: 'prospecting',   label: 'Prospecto'   },
  { value: 'qualified',     label: 'Contactado'  },
  { value: 'proposal_sent', label: 'Demo'        },
  { value: 'negotiation',   label: 'Negociación' },
]

const STAGE_ORDER = ['lead', 'in_progress', 'inprogress', 'negotiating', 'negotiation', 'won', 'closed_won', 'lost', 'closed_lost']

function fmtCurrency(val: number | null, code: string) {
  if (val === null) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(val)
}
function fmtDate(d: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return '—' }
}

interface Props {
  currentUser: AuthUser
  members: AuthUser[]
  convertedNames: Set<string>
  convertedEmails: Set<string>
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t) }, [onDismiss])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg">
      <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm3.78-9.22a.75.75 0 0 0-1.06-1.06L7 8.44 5.28 6.72a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25z" clipRule="evenodd" />
      </svg>
      {message}
      <button onClick={onDismiss} className="ml-1 text-zinc-400 hover:text-white">×</button>
    </div>
  )
}

// ── Convert Modal ─────────────────────────────────────────────────────────────
function ConvertModal({
  deal, members, currentUserId, onClose, onConverted,
}: {
  deal: AttioDeal
  members: AuthUser[]
  currentUserId: string
  onClose: () => void
  onConverted: (name: string) => void
}) {
  const [stage, setStage] = useState<DealStage>('prospecting')
  const [owner, setOwner] = useState(currentUserId)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await fetch('/api/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: deal.name, stage, ownerId: owner }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? 'Error al crear el deal')
        return
      }
      onConverted(deal.name)
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Convertir a Deal</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{deal.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
        </div>

        {/* Summary row */}
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-zinc-100">
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${stageCls(deal.stage)}`}>
            {deal.stageLabel}
          </span>
          {deal.value !== null && (
            <span className="text-xs text-zinc-500 font-medium">{fmtCurrency(deal.value, deal.currency)}</span>
          )}
          {deal.ownerName && (
            <span className="text-xs text-zinc-400 ml-auto">{deal.ownerName}</span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Stage en Orvex</label>
            <select value={stage} onChange={(e) => setStage(e.target.value as DealStage)}
              className="w-full px-3 py-2 text-sm text-zinc-900 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10">
              {ORVEX_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Owner</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}
              className="w-full px-3 py-2 text-sm text-zinc-900 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10">
              {members.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
            </select>
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {pending && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              {pending ? 'Creando…' : 'Crear Deal →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function LeadsClient({ currentUser, members, convertedNames }: Props) {
  const [activeStage, setActiveStage] = useState<AttioDealStage | 'all'>('all')
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(true)      // true while first page in flight
  const [loadingMore, setLoadingMore] = useState(false) // true while background pages load
  const [error, setError]     = useState<string | null>(null)
  const [deals, setDeals]     = useState<AttioDeal[]>([])
  const [converted, setConverted] = useState<Set<string>>(convertedNames)
  const [modal, setModal]     = useState<AttioDeal | null>(null)
  const [toast, setToast]     = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  type PageResponse = { deals?: AttioDeal[]; error?: string; hasMore?: boolean; nextOffset?: number }

  const fetchAllPages = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)

    try {
      // Page 0 — show immediately
      const r0 = await fetch('/api/leads/attio?offset=0', { signal: ctrl.signal })
      const d0 = await r0.json() as PageResponse
      if (d0.error) { setError(d0.error); return }
      setDeals(d0.deals ?? [])
      setLoading(false)

      if (!d0.hasMore) return

      // Remaining pages — background
      setLoadingMore(true)
      let nextOffset = d0.nextOffset ?? (d0.deals?.length ?? 0)

      while (nextOffset > 0) {
        const r = await fetch(`/api/leads/attio?offset=${nextOffset}`, { signal: ctrl.signal })
        const d = await r.json() as PageResponse
        if (d.error) break
        const batch = d.deals ?? []
        if (batch.length > 0) {
          setDeals((prev) => {
            // Deduplicate by attioId in case of overlap
            const ids = new Set(prev.map((x) => x.attioId))
            const fresh = batch.filter((x) => !ids.has(x.attioId))
            return [...prev, ...fresh]
          })
        }
        if (!d.hasMore) break
        nextOffset = d.nextOffset ?? (nextOffset + batch.length)
      }
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return
      setError(String(e))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchAllPages()
    return () => abortRef.current?.abort()
  }, [fetchAllPages])

  // Derive unique stages preserving canonical order
  const stages = useMemo(() => {
    const seen = new Map<string, string>() // slug → label
    for (const d of deals) {
      if (d.stage && d.stageLabel && !seen.has(d.stage)) seen.set(d.stage, d.stageLabel)
    }
    return [...seen.entries()].sort(([a], [b]) => {
      const ia = STAGE_ORDER.indexOf(a), ib = STAGE_ORDER.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }, [deals])

  const q = query.toLowerCase()
  const filtered = useMemo(() =>
    deals.filter((d) =>
      (activeStage === 'all' || d.stage === activeStage) &&
      (!q || d.name.toLowerCase().includes(q) || (d.ownerName ?? '').toLowerCase().includes(q))
    ),
    [deals, activeStage, q]
  )

  function handleConverted(name: string) {
    setConverted((prev) => new Set([...prev, name.toLowerCase().trim()]))
    setToast('Deal creado correctamente')
  }

  const count = (s: AttioDealStage | 'all') =>
    s === 'all' ? deals.length : deals.filter((d) => d.stage === s).length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Leads</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {loading
              ? 'Cargando desde Attio…'
              : loadingMore
                ? `Pipeline de Attio · ${deals.length} deal${deals.length !== 1 ? 's' : ''} (cargando más…)`
                : `Pipeline de Attio · ${deals.length} deal${deals.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        {/* Search */}
        <input
          type="text"
          placeholder="Buscar por nombre u owner…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-zinc-200 bg-white w-60 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        />
      </div>

      {/* Stage tabs */}
      {!loading && !error && stages.length > 0 && (
        <div className="flex items-center gap-1 mb-6 bg-zinc-100 rounded-lg p-0.5 w-fit flex-wrap">
          <button
            onClick={() => setActiveStage('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeStage === 'all' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Todos ({count('all')})
          </button>
          {stages.map(([slug, label]) => (
            <button
              key={slug}
              onClick={() => setActiveStage(slug)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeStage === slug ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {label} ({count(slug)})
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-400 text-sm">Cargando desde Attio…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          Error al cargar los leads: {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-400 text-sm">
            {query || activeStage !== 'all' ? 'Sin resultados para los filtros aplicados.' : 'No hay deals en Attio.'}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                {['Nombre', 'Stage', 'Valor', 'Owner Attio', 'Fecha', ''].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest ${i === 5 ? 'w-40' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((d) => {
                const isConverted = converted.has(d.name.toLowerCase().trim())
                return (
                  <tr key={d.attioId} className="hover:bg-zinc-50 transition-colors group">
                    <td className="px-5 py-3 max-w-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-900 truncate">{d.name}</span>
                        {isConverted && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            ✓ En Orvex
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${stageCls(d.stage)}`}>
                        {d.stageLabel}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-semibold text-zinc-900">{fmtCurrency(d.value, d.currency)}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500">{d.ownerName ?? '—'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-400">{fmtDate(d.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {!isConverted && (
                        <button
                          onClick={() => setModal(d)}
                          className="inline-flex items-center gap-1 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Convertir a Deal →
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ConvertModal
          deal={modal}
          members={members}
          currentUserId={currentUser.id}
          onClose={() => setModal(null)}
          onConverted={handleConverted}
        />
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
