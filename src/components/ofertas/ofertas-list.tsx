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
  draft: 'bg-border-subtle text-text-tertiary',
  sent: 'bg-info/12 text-info',
  accepted: 'bg-success/12 text-success',
  rejected: 'bg-danger/12 text-danger',
  expired: 'bg-warning/12 text-warning',
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
      <div className="flex items-center gap-1 mb-5 bg-elevated border border-border-subtle rounded-[6px] p-0.5 w-fit flex-wrap">
        {(['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as (PresupuestoStatus | 'all')[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 h-8 rounded-[4px] text-[13px] font-medium transition-colors duration-150 ${
              status === s ? 'bg-hover text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {s === 'all' ? 'Todas' : STATUS_LABELS[s]} ({count(s)})
          </button>
        ))}
      </div>

      {fetchError && (
        <div className="mb-5 bg-danger/8 border border-danger/20 rounded-lg px-5 py-4 text-[13px] text-danger">
          Error al cargar las ofertas. Asegúrate de que la tabla <code>presupuestos</code> existe en Supabase.
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-lg p-12 text-center">
          <p className="text-text-tertiary text-[13px]">
            {hasFilters
              ? 'Sin resultados para los filtros aplicados.'
              : `No hay ofertas${status !== 'all' ? ` con estado "${STATUS_LABELS[status]}"` : ''}.`}
          </p>
          {!hasFilters && (
            <Link
              href="/ofertas/nuevo"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium bg-accent text-base hover:bg-accent-hover px-3 h-9 rounded-[6px] transition-colors duration-150"
            >
              + Nueva oferta
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-subtle bg-hover">
                <th className="text-left px-5 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider">Número</th>
                <th className="text-left px-5 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider">Concepto</th>
                <th className="text-right px-4 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider">Válido hasta</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider">Creada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-hover transition-colors duration-150 h-11">
                  <td className="px-5 py-2">
                    <Link href={`/ofertas/${o.id}`} className="font-mono font-semibold text-accent-text hover:text-accent text-[13px]">
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-5 py-2">
                    <p className="text-[13px] font-medium text-text-primary">{o.clientName}</p>
                    {o.clientCif && <p className="text-[11px] text-text-tertiary">{o.clientCif}</p>}
                  </td>
                  <td className="px-4 py-2 max-w-xs">
                    <p className="text-[13px] text-text-secondary truncate">{o.concept}</p>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="font-mono text-[13px] font-semibold text-text-primary">{formatEur(o.amountTotal)}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-[4px] ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[13px] text-text-tertiary font-mono">{formatDate(o.validUntil)}</td>
                  <td className="px-4 py-2 text-[13px] text-text-tertiary font-mono">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
