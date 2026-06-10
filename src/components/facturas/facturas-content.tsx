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
  draft: 'bg-border-subtle text-text-tertiary',
  issued: 'bg-info/12 text-info',
  paid: 'bg-success/12 text-success',
  overdue: 'bg-danger/12 text-danger',
}

const OFERTA_STATUS_LABELS: Record<PresupuestoStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Expirado',
}

const OFERTA_STATUS_COLORS: Record<PresupuestoStatus, string> = {
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
  invoiceFetchError: string | null
  ofertaFetchError: string | null
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
      <div className="mb-6 flex items-center gap-1 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('facturas')}
          className={`px-5 py-2.5 text-[14px] font-medium border-b-2 transition-colors duration-150 -mb-px ${
            activeTab === 'facturas'
              ? 'border-accent text-accent-text'
              : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          Facturas
        </button>
        <button
          onClick={() => setActiveTab('ofertas')}
          className={`px-5 py-2.5 text-[14px] font-medium border-b-2 transition-colors duration-150 -mb-px ${
            activeTab === 'ofertas'
              ? 'border-accent text-accent-text'
              : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          Ofertas
        </button>
      </div>

      {activeTab === 'facturas' ? (
        /* ===================== FACTURAS ===================== */
        <>
          <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-semibold text-text-primary tracking-tight">Facturas</h1>
              <p className="text-text-tertiary text-[13px] mt-0.5">
                {invoices.length} factura{invoices.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/facturas/nueva"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-accent text-base hover:bg-accent-hover px-3 h-9 rounded-[6px] transition-colors duration-150"
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
          <div className="flex items-center gap-1 mb-5 bg-elevated border border-border-subtle rounded-[6px] p-0.5 w-fit">
            {(['all', 'draft', 'issued', 'paid', 'overdue'] as (InvoiceStatus | 'all')[]).map((s) => (
              <button
                key={s}
                onClick={() => setInvStatus(s)}
                className={`px-3 h-8 rounded-[4px] text-[13px] font-medium transition-colors duration-150 ${
                  invStatus === s ? 'bg-hover text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {s === 'all' ? 'Todas' : INVOICE_STATUS_LABELS[s]} ({invCount(s)})
              </button>
            ))}
          </div>

          {invoiceFetchError && (
            <div className="mb-5 bg-danger/8 border border-danger/20 rounded-lg px-5 py-4 text-[13px] text-danger">
              Error al cargar las facturas: {invoiceFetchError}
            </div>
          )}

          {filteredInvoices.length === 0 ? (
            <div className="bg-surface border border-border-subtle rounded-lg p-12 text-center">
              <p className="text-text-tertiary text-[13px]">
                {invQuery || invDesde || invHasta
                  ? 'Sin resultados para los filtros aplicados.'
                  : `No hay facturas${invStatus !== 'all' ? ` con estado "${INVOICE_STATUS_LABELS[invStatus]}"` : ''}.`}
              </p>
              {!invQuery && !invDesde && !invHasta && (
                <Link
                  href="/facturas/nueva"
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium bg-accent text-base hover:bg-accent-hover px-3 h-9 rounded-[6px] transition-colors duration-150"
                >
                  + Nueva factura
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
                    <th className="text-left px-4 py-3 text-[12px] font-medium text-text-tertiary uppercase tracking-wider">Emisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-hover transition-colors duration-150 h-11">
                      <td className="px-5 py-2">
                        <Link href={`/facturas/${inv.id}`} className="font-mono font-semibold text-accent-text hover:text-accent text-[13px]">
                          {inv.number}
                        </Link>
                        {inv.type === 'rectificativa' && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-warning font-medium">Rect.</span>
                        )}
                      </td>
                      <td className="px-5 py-2">
                        <p className="text-[13px] font-medium text-text-primary">{inv.clientName}</p>
                        {inv.clientCif && <p className="text-[11px] text-text-tertiary">{inv.clientCif}</p>}
                      </td>
                      <td className="px-4 py-2 max-w-xs">
                        <p className="text-[13px] text-text-secondary truncate">{inv.concept}</p>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="font-mono text-[13px] font-semibold text-text-primary">{formatEur(inv.amountTotal)}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-block text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-[4px] ${INVOICE_STATUS_COLORS[inv.status]}`}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[13px] text-text-tertiary font-mono">{formatDate(inv.issuedAt)}</td>
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
          <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-semibold text-text-primary tracking-tight">Ofertas</h1>
              <p className="text-text-tertiary text-[13px] mt-0.5">
                {ofertas.length} oferta{ofertas.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/ofertas/nuevo"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-accent text-base hover:bg-accent-hover px-3 h-9 rounded-[6px] transition-colors duration-150"
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
          <div className="flex items-center gap-1 mb-5 bg-elevated border border-border-subtle rounded-[6px] p-0.5 w-fit">
            {(['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as (PresupuestoStatus | 'all')[]).map((s) => (
              <button
                key={s}
                onClick={() => setOfStatus(s)}
                className={`px-3 h-8 rounded-[4px] text-[13px] font-medium transition-colors duration-150 ${
                  ofStatus === s ? 'bg-hover text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {s === 'all' ? 'Todas' : OFERTA_STATUS_LABELS[s]} ({ofCount(s)})
              </button>
            ))}
          </div>

          {ofertaFetchError && (
            <div className="mb-5 bg-danger/8 border border-danger/20 rounded-lg px-5 py-4 text-[13px] text-danger">
              Error al cargar las ofertas: {ofertaFetchError}
            </div>
          )}

          {filteredOfertas.length === 0 ? (
            <div className="bg-surface border border-border-subtle rounded-lg p-12 text-center">
              <p className="text-text-tertiary text-[13px]">
                {ofQuery || ofDesde || ofHasta
                  ? 'Sin resultados para los filtros aplicados.'
                  : `No hay ofertas${ofStatus !== 'all' ? ` con estado "${OFERTA_STATUS_LABELS[ofStatus]}"` : ''}.`}
              </p>
              {!ofQuery && !ofDesde && !ofHasta && (
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredOfertas.map((o) => (
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
                        <span className={`inline-block text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-[4px] ${OFERTA_STATUS_COLORS[o.status]}`}>
                          {OFERTA_STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[13px] text-text-tertiary font-mono">{formatDate(o.validUntil)}</td>
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
