'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { FilterSearchBar } from '@/components/ui/filter-search-bar'
import type { Invoice, InvoiceStatus, InvoiceType } from '@/types'

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  paid: 'Pagada',
  overdue: 'Vencida',
  converted: 'Convertida',
}

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  issued: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
  converted: 'bg-zinc-100 text-zinc-500',
}

const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  ordinary: 'Factura',
  proforma: 'Proforma',
  rectificativa: 'Rectificativa',
}

const INVOICE_TYPE_COLORS: Record<InvoiceType, string> = {
  ordinary: 'bg-zinc-100 text-zinc-700',
  proforma: 'bg-violet-50 text-violet-700',
  rectificativa: 'bg-amber-50 text-amber-700',
}

// Sort order weights
const STATUS_ORDER: Record<InvoiceStatus, number> = {
  overdue: 0,
  draft: 1,
  issued: 2,
  paid: 3,
  converted: 4,
}

const TYPE_ORDER: Record<InvoiceType, number> = {
  ordinary: 0,
  proforma: 1,
  rectificativa: 2,
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

type TabKey = InvoiceStatus | 'all' | 'proforma'
type SortKey = 'number' | 'client' | 'type' | 'amount' | 'status' | 'date'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
      {active && dir === 'desc' ? '↓' : '↑'}
    </span>
  )
}

function sortInvoices(invoices: Invoice[], key: SortKey, dir: SortDir): Invoice[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...invoices].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'number':
        cmp = a.number.localeCompare(b.number, 'es')
        break
      case 'client':
        cmp = a.clientName.localeCompare(b.clientName, 'es')
        break
      case 'type':
        cmp = TYPE_ORDER[a.type] - TYPE_ORDER[b.type]
        break
      case 'amount':
        cmp = a.amountTotal - b.amountTotal
        break
      case 'status':
        cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        break
      case 'date':
        cmp = (a.issuedAt ?? '').localeCompare(b.issuedAt ?? '')
        break
    }
    return cmp * sign
  })
}

export function FacturasContent({
  invoices,
  invoiceFetchError,
  paymentTotals = {},
}: {
  invoices: Invoice[]
  invoiceFetchError: string | null
  paymentTotals?: Record<string, number>
}) {
  const [tab, setTab] = useState<TabKey>('all')
  const [invQuery, setInvQuery] = useState('')
  const [invDesde, setInvDesde] = useState('')
  const [invHasta, setInvHasta] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ── Bulk selection ────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'status' || key === 'type' ? 'asc' : 'desc')
    }
  }

  const filtered = invoices.filter((inv) => {
    if (tab === 'proforma' && inv.type !== 'proforma') return false
    if (tab !== 'all' && tab !== 'proforma' && inv.status !== tab) return false
    if (invQuery && !matchesText(invQuery, inv.number, inv.clientName, inv.clientCif)) return false
    if (!inDateRange(inv.issuedAt, invDesde, invHasta)) return false
    return true
  })

  const filteredInvoices = sortInvoices(filtered, sortKey, sortDir)

  const invCount = (t: TabKey) => {
    if (t === 'all') return invoices.length
    if (t === 'proforma') return invoices.filter((i) => i.type === 'proforma').length
    return invoices.filter((i) => i.status === t).length
  }

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allVisibleSelected =
    filteredInvoices.length > 0 && filteredInvoices.every((i) => selected.has(i.id))

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredInvoices.forEach((i) => next.delete(i.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredInvoices.forEach((i) => next.add(i.id))
        return next
      })
    }
  }

  const clearSelection = () => setSelected(new Set())

  const handleBulkDownload = async () => {
    if (selected.size === 0 || downloading) return
    setDownloading(true)
    try {
      const ids = Array.from(selected).join(',')
      const res = await fetch(`/api/facturas/bulk-pdf?ids=${encodeURIComponent(ids)}`)
      if (!res.ok) throw new Error('Error al generar los PDFs')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().slice(0, 10)
      a.download = `facturas-orvex-${today}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      clearSelection()
    } catch (err) {
      console.error('[bulk-download]', err)
      alert('Error al generar los PDFs. Inténtalo de nuevo.')
    } finally {
      setDownloading(false)
    }
  }

  const ThSort = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest cursor-pointer select-none group whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      {label}
      <SortIcon active={sortKey === col} dir={sortDir} />
    </th>
  )

  return (
    <div>
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Facturas</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {invoices.length} factura{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/facturas/report-pdf"
            download
            className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 1v8M4 6l3 3 3-3" /><path d="M2 11h10" />
            </svg>
            Informe CEO
          </a>
          <Link
            href="/facturas/nueva"
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nueva factura
          </Link>
        </div>
      </div>

      <FilterSearchBar
        query={invQuery} onQuery={setInvQuery}
        desde={invDesde} onDesde={setInvDesde}
        hasta={invHasta} onHasta={setInvHasta}
      />

      <div className="flex items-center gap-1 mb-6 bg-zinc-100 rounded-lg p-0.5 w-fit flex-wrap">
        {([
          ['all', 'Todas'],
          ['proforma', 'Proforma'],
          ['draft', 'Borrador'],
          ['issued', 'Emitida'],
          ['overdue', 'Vencida'],
          ['paid', 'Pagada'],
          ['converted', 'Convertida'],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label} ({invCount(key)})
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
              : `No hay facturas${tab !== 'all' ? ` para el filtro seleccionado` : ''}.`}
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
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-0 cursor-pointer"
                    title={allVisibleSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  />
                </th>
                <ThSort col="number" label="Número" />
                <ThSort col="type" label="Tipo" />
                <ThSort col="client" label="Cliente" />
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Concepto</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest cursor-pointer select-none group whitespace-nowrap" onClick={() => handleSort('amount')}>
                  Total
                  <SortIcon active={sortKey === 'amount'} dir={sortDir} />
                </th>
                <ThSort col="status" label="Estado" />
                <ThSort col="date" label="Emisión" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={`hover:bg-zinc-50 transition-colors ${selected.has(inv.id) ? 'bg-blue-50/40' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(inv.id)}
                      onChange={() => toggleOne(inv.id)}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-0 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/facturas/${inv.id}`} className="font-mono font-semibold text-zinc-900 hover:text-blue-700 text-xs">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${INVOICE_TYPE_COLORS[inv.type]}`}>
                      {INVOICE_TYPE_LABELS[inv.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
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
                    <div className="flex flex-col gap-1">
                      <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full w-fit ${INVOICE_STATUS_COLORS[inv.status]}`}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                      {(() => {
                        const paid = paymentTotals[inv.id] ?? 0
                        if (paid > 0 && paid < inv.amountTotal && inv.status !== 'paid') {
                          return (
                            <span className="inline-block text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full w-fit bg-amber-50 text-amber-700">
                              Pago parcial
                            </span>
                          )
                        }
                        return null
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{formatDate(inv.issuedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Floating bulk-action bar ─────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900 text-white rounded-2xl shadow-2xl px-5 py-3">
          <span className="text-sm font-medium tabular-nums">
            {selected.size} factura{selected.size !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}
          </span>
          <div className="h-4 w-px bg-zinc-700" />
          <button
            onClick={handleBulkDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white hover:text-zinc-200 disabled:opacity-50 transition-colors"
          >
            {downloading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                </svg>
                Generando PDFs…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v8M5 7l3 3 3-3" />
                  <path d="M2 12h12" />
                </svg>
                Descargar PDFs
              </>
            )}
          </button>
          <div className="h-4 w-px bg-zinc-700" />
          <button
            onClick={clearSelection}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
