'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FilterSearchBar } from '@/components/ui/filter-search-bar'
import { deletePresupuestoAction } from '@/app/actions/presupuestos'
import type { Presupuesto, PresupuestoStatus } from '@/types'

const STATUS_LABELS: Record<PresupuestoStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Expirado',
}

const STATUS_COLORS: Record<PresupuestoStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
}

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(n)
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function inDateRange(isoDate: string | null, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true
  if (!isoDate) return false
  const d = isoDate.slice(0, 10)
  if (desde && d < desde) return false
  if (hasta && d > hasta) return false
  return true
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({
  oferta,
  onClose,
  onConfirm,
  isPending,
}: {
  oferta: Presupuesto
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-red-600" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Eliminar oferta</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{oferta.number} · {oferta.clientName}</p>
          </div>
        </div>

        <p className="text-sm text-zinc-700 mb-6 leading-relaxed">
          ¿Estás seguro de que quieres eliminar esta oferta? Esta acción no se puede deshacer.
        </p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {isPending && (
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-2 duration-200">
      <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      {message}
      <button onClick={onDismiss} className="ml-2 text-zinc-400 hover:text-white transition-colors">
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function OfertasList({
  ofertas: initialOfertas,
  fetchError,
}: {
  ofertas: Presupuesto[]
  fetchError: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState<PresupuestoStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // Delete modal state
  const [pendingDelete, setPendingDelete] = useState<Presupuesto | null>(null)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = initialOfertas.filter((o) => {
    if (status !== 'all' && o.status !== status) return false
    if (query) {
      const lq = query.toLowerCase()
      const matches =
        o.number.toLowerCase().includes(lq) ||
        o.clientName.toLowerCase().includes(lq) ||
        (o.clientCif?.toLowerCase().includes(lq) ?? false)
      if (!matches) return false
    }
    if (!inDateRange(o.createdAt ?? null, desde, hasta)) return false
    return true
  })

  const count = (s: PresupuestoStatus | 'all') =>
    s === 'all' ? initialOfertas.length : initialOfertas.filter((o) => o.status === s).length

  const hasFilters = query || desde || hasta

  function handleDeleteConfirm() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    const number = pendingDelete.number
    startTransition(async () => {
      const result = await deletePresupuestoAction(id)
      if (result.ok) {
        setPendingDelete(null)
        setToast(`Oferta ${number} eliminada`)
        router.refresh()
        setTimeout(() => setToast(null), 4000)
      } else {
        setPendingDelete(null)
        setError(result.error ?? 'Error al eliminar la oferta')
        setTimeout(() => setError(null), 5000)
      }
    })
  }

  return (
    <>
      {/* Search + date bar */}
      <FilterSearchBar
        query={query} onQuery={setQuery}
        desde={desde} onDesde={setDesde}
        hasta={hasta} onHasta={setHasta}
        placeholder="Número, empresa o CIF…"
      />

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-6 bg-zinc-100 rounded-lg p-0.5 w-fit flex-wrap">
        {(['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as (PresupuestoStatus | 'all')[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              status === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {s === 'all' ? 'Todas' : STATUS_LABELS[s]} ({count(s)})
          </button>
        ))}
      </div>

      {fetchError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          Error al cargar las ofertas. Asegúrate de que la tabla <code>presupuestos</code> existe en Supabase.
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-400 text-sm">
            {hasFilters
              ? 'Sin resultados para los filtros aplicados.'
              : `No hay ofertas${status !== 'all' ? ` con estado "${STATUS_LABELS[status]}"` : ''}.`}
          </p>
          {!hasFilters && (
            <Link
              href="/ofertas/nuevo"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Nueva oferta
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Número</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Cliente</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Concepto</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Total</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Estado</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Válido hasta</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Creada</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-5 py-3">
                    <Link href={`/ofertas/${o.id}`} className="font-mono font-semibold text-zinc-900 hover:text-blue-700 text-xs">
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs font-medium text-zinc-800">{o.clientName}</p>
                    {o.clientCif && <p className="text-[10px] text-zinc-400">{o.clientCif}</p>}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs text-zinc-600 truncate">{o.concept}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-xs font-semibold text-zinc-900">{formatEur(o.amountTotal)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(o.validUntil)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(o.createdAt)}</td>
                  <td className="px-3 py-3">
                    {o.status === 'draft' && (
                      <button
                        onClick={() => setPendingDelete(o)}
                        title="Eliminar oferta"
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <DeleteModal
          oferta={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onConfirm={handleDeleteConfirm}
          isPending={isPending}
        />
      )}

      {/* Success toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  )
}
