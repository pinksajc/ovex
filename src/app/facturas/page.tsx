import Link from 'next/link'
import { getInvoices } from '@/lib/supabase/invoices'
import { getPresupuestos } from '@/lib/supabase/presupuestos'
import type { Invoice, InvoiceStatus, Presupuesto, PresupuestoStatus } from '@/types'

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
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; ostatus?: string }>
}) {
  const { tab, status, ostatus } = await searchParams

  const isOfertasTab = tab === 'ofertas'

  let invoices: Invoice[] = []
  let invoiceFetchError = false
  let ofertas: Presupuesto[] = []
  let ofertaFetchError = false

  try {
    invoices = await getInvoices()
  } catch {
    invoiceFetchError = true
  }

  try {
    ofertas = await getPresupuestos()
  } catch {
    ofertaFetchError = true
  }

  const activeInvoiceFilter = status as InvoiceStatus | undefined
  const activeOfertaFilter = ostatus as PresupuestoStatus | undefined

  const filteredInvoices = activeInvoiceFilter
    ? invoices.filter((i) => i.status === activeInvoiceFilter)
    : invoices

  const filteredOfertas = activeOfertaFilter
    ? ofertas.filter((o) => o.status === activeOfertaFilter)
    : ofertas

  const invoiceTotalByStatus = (s: InvoiceStatus) => invoices.filter((i) => i.status === s).length
  const ofertaTotalByStatus = (s: PresupuestoStatus) => ofertas.filter((o) => o.status === s).length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Top-level tab switcher */}
      <div className="mb-6 flex items-center gap-1 border-b border-zinc-200">
        <Link
          href="/facturas"
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            !isOfertasTab
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          Facturas
        </Link>
        <Link
          href="/facturas?tab=ofertas"
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            isOfertasTab
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          Ofertas
        </Link>
      </div>

      {!isOfertasTab ? (
        /* ===================== FACTURAS TAB ===================== */
        <>
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
                !activeInvoiceFilter ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Todas ({invoices.length})
            </Link>
            {(['draft', 'issued', 'paid', 'overdue'] as InvoiceStatus[]).map((s) => (
              <Link
                key={s}
                href={`/facturas?status=${s}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeInvoiceFilter === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {INVOICE_STATUS_LABELS[s]} ({invoiceTotalByStatus(s)})
              </Link>
            ))}
          </div>

          {invoiceFetchError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
              Error al cargar las facturas. Asegúrate de que la tabla <code>invoices</code> existe en Supabase.
            </div>
          )}

          {/* Table */}
          {filteredInvoices.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
              <p className="text-zinc-400 text-sm">No hay facturas{activeInvoiceFilter ? ` con estado "${INVOICE_STATUS_LABELS[activeInvoiceFilter]}"` : ''}.</p>
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
        /* ===================== OFERTAS TAB ===================== */
        <>
          {/* Header */}
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

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 mb-6 bg-zinc-100 rounded-lg p-0.5 w-fit">
            <Link
              href="/facturas?tab=ofertas"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !activeOfertaFilter ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Todas ({ofertas.length})
            </Link>
            {(['draft', 'sent', 'accepted', 'rejected', 'expired'] as PresupuestoStatus[]).map((s) => (
              <Link
                key={s}
                href={`/facturas?tab=ofertas&ostatus=${s}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeOfertaFilter === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {OFERTA_STATUS_LABELS[s]} ({ofertaTotalByStatus(s)})
              </Link>
            ))}
          </div>

          {ofertaFetchError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
              Error al cargar las ofertas. Asegúrate de que la tabla <code>presupuestos</code> existe en Supabase.
            </div>
          )}

          {/* Table */}
          {filteredOfertas.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
              <p className="text-zinc-400 text-sm">No hay ofertas{activeOfertaFilter ? ` con estado "${OFERTA_STATUS_LABELS[activeOfertaFilter]}"` : ''}.</p>
              <Link
                href="/ofertas/nuevo"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                + Nueva oferta
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
