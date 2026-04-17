import Link from 'next/link'
import { getInvoices } from '@/lib/supabase/invoices'
import type { Invoice, InvoiceStatus } from '@/types'

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  paid: 'Pagada',
  overdue: 'Vencida',
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  issued: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
}

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams

  let invoices: Invoice[] = []
  let fetchError = false
  try {
    invoices = await getInvoices()
  } catch {
    fetchError = true
  }

  const activeFilter = status as InvoiceStatus | undefined
  const filtered = activeFilter
    ? invoices.filter((i) => i.status === activeFilter)
    : invoices

  const totalByStatus = (s: InvoiceStatus) => invoices.filter((i) => i.status === s).length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
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

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-6 bg-zinc-100 rounded-lg p-0.5 w-fit">
        <Link
          href="/facturas"
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            !activeFilter ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Todas ({invoices.length})
        </Link>
        {(['draft', 'issued', 'paid', 'overdue'] as InvoiceStatus[]).map((s) => (
          <Link
            key={s}
            href={`/facturas?status=${s}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeFilter === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {STATUS_LABELS[s]} ({totalByStatus(s)})
          </Link>
        ))}
      </div>

      {fetchError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          Error al cargar las facturas. Asegúrate de que la tabla <code>invoices</code> existe en Supabase.
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-400 text-sm">No hay facturas{activeFilter ? ` con estado "${STATUS_LABELS[activeFilter]}"` : ''}.</p>
          <Link
            href="/facturas/nueva"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nueva factura
          </Link>
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
              {filtered.map((inv) => (
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
                    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status]}`}>
                      {STATUS_LABELS[inv.status]}
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
