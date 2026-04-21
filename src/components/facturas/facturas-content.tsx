'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FilterSearchBar } from '@/components/ui/filter-search-bar'
import type { Invoice, InvoiceStatus, Presupuesto, PresupuestoStatus } from '@/types'

// ---- Display maps ----

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  paid: 'Pagada',
  overdue: 'Vencida',
}

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  issued: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
}

const OFERTA_STATUS_LABELS: Record<PresupuestoStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Expirado',
}

const OFERTA_STATUS_COLORS: Record<PresupuestoStatus, string> = {
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

// ---- Filter helpers ----

function matchesText(q: string, number: string, clientName: string, clientCif?: string | null): boolean {
  const lq = q.toLowerCase()
  return (
    number.toLowerCase().includes(lq) ||
    clientName.toLowerCase().includes(lq) ||
    (clientCif?.toLowerCase().includes(lq) ?? false)
  )
}

function inDateRange(isoDate: string | null, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true
  if (!isoDate) return false
  const d = isoDate.slice(0, 10) // YYYY-MM-DD
  if (desde && d < desde) return false
  if (hasta && d > hasta) return false
  return true
}

// ---- Main component ----

export function FacturasContent({
  invoices,
  ofertas,
  invoiceFetchError,
  ofertaFetchError,
  initialTab,
}: {
  invoices: Invoice[]
  ofertas: Presupuesto[]
  invoiceFetchError: boolean
  ofertaFetchError: boolean
  initialTab?: string
}) {
  const isOfertasTab = initialTab === 'ofertas'
  const [activeTab, setActiveTab] = useState<'facturas' | 'ofertas'>(isOfertasTab ? 'ofertas' : 'facturas')

  // Factura filters
  const [invStatus, setInvStatus] = useState<InvoiceStatus | 'all'>('all')
  const [invQuery, setInvQuery] = useState('')
  const [invDesde, setInvDesde] = useState('')
  const [invHasta, setInvHasta] = useState('')

  // Oferta filters
  const [ofStatus, setOfStatus] = useState<PresupuestoStatus | 'all'>('all')
  const [ofQuery, setOfQuery] = useState('')
  const [ofDesde, setOfDesde] = useState('')
  const [ofHasta, setOfHasta] = useState('')

  // ---- Filtered invoices ----
  const filteredInvoices = invoices.filter((inv) => {
    if (invStatus !== 'all' && inv.status !== invStatus) return false
    if (invQuery && !matchesText(invQuery, inv.number, inv.clientName, inv.clientCif)) return false
    if (!inDateRange(inv.issuedAt, invDesde, invHasta)) return false
    return true
  })

  // ---- Filtered ofertas ----
  const filteredOfertas = ofertas.filter((o) => {
    if (ofStatus !== 'all' && o.status !== ofStatus) return false
    if (ofQuery && !matchesText(ofQuery, o.number, o.clientName, o.clientCif)) return false
    if (!inDateRange(o.createdAt ?? null, ofDesde, ofHasta)) return false
    return true
  })

  const invCount = (s: InvoiceStatus | 'all') =>
    s === 'all' ? invoices.length : invoices.filter((i) => i.status === s).length
  const ofCount = (s: PresupuestoStatus | 'all') =>
    s === 'all' ? ofertas.length : ofertas.filter((o) => o.status === s).length

  return (
    <div>
      {/* Top-level tab switcher */}
      <div className="mb-6 flex items-center gap-1 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('facturas')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'facturas'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          Facturas
        </button>
        <button
          onClick={() => setActiveTab('ofertas')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'ofertas'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          Ofertas
        </button>
      </div>

      {activeTab === 'facturas' ? (
        /* ===================== FACTURAS ===================== */
        <>
          <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Facturas</h1>
              <p className="text-zinc-500 text-sm mt-1">
                {invoices.length} factura{invoices.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/facturas/nueva"
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Nueva factura
            </Link>
          </div>

          {/* Search + date bar */}
          <FilterSearchBar
            query={invQuery} onQuery={setInvQuery}
            desde={invDesde} onDesde={setInvDesde}
            hasta={invHasta} onHasta={setInvHasta}
          />

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 mb-6 bg-zinc-100 rounded-lg p-0.5 w-fit">
            {(['all', 'draft', 'issued', 'paid', 'overdue'] as (InvoiceStatus | 'all')[]).map((s) => (
              <button
                key={s}
                onClick={() => setInvStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  invStatus === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {s === 'all' ? 'Todas' : INVOICE_STATUS_LABELS[s]} ({invCount(s)})
              </button>
            ))}
          </div>

          {invoiceFetchError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
              Error al cargar las facturas. Asegúrate de que la tabla <code>invoices</code> existe en Supabase.
            </div>
          )}

          {filteredInvoices.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
              <p className="text-zinc-400 text-sm">
                {invQuery || invDesde || invHasta
                  ? 'Sin resultados para los filtros aplicados.'
                  : `No hay facturas${invStatus !== 'all' ? ` con estado "${INVOICE_STATUS_LABELS[invStatus]}"` : ''}.`}
              </p>
              {!invQuery && !invDesde && !invHasta && (
                <Link
                  href="/facturas/nueva"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Nueva factura
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
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Emisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/facturas/${inv.id}`} className="font-mono font-semibold text-zinc-900 hover:text-blue-700 text-xs">
                          {inv.number}
                        </Link>
                        {inv.type === 'rectificativa' && (
                          <span className="ml-2 text-[9px] uppercase tracking-wide text-amber-600 font-semibold">Rect.</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-xs font-medium text-zinc-800">{inv.clientName}</p>
                        {inv.clientCif && <p className="text-[10px] text-zinc-400">{inv.clientCif}</p>}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-zinc-600 truncate">{inv.concept}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-xs font-semibold text-zinc-900">{formatEur(inv.amountTotal)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${INVOICE_STATUS_COLORS[inv.status]}`}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(inv.issuedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* ===================== OFERTAS ===================== */
        <>
          <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Ofertas</h1>
              <p className="text-zinc-500 text-sm mt-1">
                {ofertas.length} oferta{ofertas.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/ofertas/nuevo"
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Nueva oferta
            </Link>
          </div>

          {/* Search + date bar */}
          <FilterSearchBar
            query={ofQuery} onQuery={setOfQuery}
            desde={ofDesde} onDesde={setOfDesde}
            hasta={ofHasta} onHasta={setOfHasta}
          />

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 mb-6 bg-zinc-100 rounded-lg p-0.5 w-fit">
            {(['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as (PresupuestoStatus | 'all')[]).map((s) => (
              <button
                key={s}
                onClick={() => setOfStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  ofStatus === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {s === 'all' ? 'Todas' : OFERTA_STATUS_LABELS[s]} ({ofCount(s)})
              </button>
            ))}
          </div>

          {ofertaFetchError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
              Error al cargar las ofertas. Asegúrate de que la tabla <code>presupuestos</code> existe en Supabase.
            </div>
          )}

          {filteredOfertas.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
              <p className="text-zinc-400 text-sm">
                {ofQuery || ofDesde || ofHasta
                  ? 'Sin resultados para los filtros aplicados.'
                  : `No hay ofertas${ofStatus !== 'all' ? ` con estado "${OFERTA_STATUS_LABELS[ofStatus]}"` : ''}.`}
              </p>
              {!ofQuery && !ofDesde && !ofHasta && (
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredOfertas.map((o) => (
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
                        <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${OFERTA_STATUS_COLORS[o.status]}`}>
                          {OFERTA_STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(o.validUntil)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
