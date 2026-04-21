'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FilterSearchBar } from '@/components/ui/filter-search-bar'
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

export function OfertasList({
  ofertas,
  fetchError,
}: {
  ofertas: Presupuesto[]
  fetchError: boolean
}) {
  const [status, setStatus] = useState<PresupuestoStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const filtered = ofertas.filter((o) => {
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
    s === 'all' ? ofertas.length : ofertas.filter((o) => o.status === s).length

  const hasFilters = query || desde || hasta

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
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50 transition-colors">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
