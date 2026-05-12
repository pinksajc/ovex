'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FilterSearchBar } from '@/components/ui/filter-search-bar'
import type { Invoice, InvoiceStatus } from '@/types'

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

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(n)
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
  const d = isoDate.slice(0, 10)
  if (desde && d < desde) return false
  if (hasta && d > hasta) return false
  return true
}

export function FacturasContent({
  invoices,
  invoiceFetchError,
}: {
  invoices: Invoice[]
  invoiceFetchError: string | null
}) {
  const [invStatus, setInvStatus] = useState<InvoiceStatus | 'all'>('all')
  const [invQuery, setInvQuery] = useState('')
  const [invDesde, setInvDesde] = useState('')
  const [invHasta, setInvHasta] = useState('')

  const filteredInvoices = invoices.filter((inv) => {
    if (invStatus !== 'all' && inv.status !== invStatus) return false
    if (invQuery && !matchesText(invQuery, inv.number, inv.clientName, inv.clientCif)) return false
    if (!inDateRange(inv.issuedAt, invDesde, invHasta)) return false
    return true
  })

  const invCount = (s: InvoiceStatus | 'all') =>
    s === 'all' ? invoices.length : invoices.filter((i) => i.status === s).length

  return (
    <div>
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

      <FilterSearchBar
        query={invQuery} onQuery={setInvQuery}
        desde={invDesde} onDesde={setInvDesde}
        hasta={invHasta} onHasta={setInvHasta}
      />

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
          Error al cargar las facturas: {invoiceFetchError}
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
    </div>
  )
}
