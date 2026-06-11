import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoice } from '@/lib/supabase/invoices'
import { getCurrentUser } from '@/lib/auth'
import { InvoiceActions, ConvertProformaButton, DeleteInvoiceButton } from './actions'
import { FacturaPageShell } from './factura-page-shell'
import { APPROVAL_CHIP, isDownloadBlocked } from '@/lib/approvals'
import { DueDateEditor } from '@/components/facturas/due-date-editor'
import type { Invoice, InvoiceStatus } from '@/types'

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  paid: 'Pagada',
  overdue: 'Vencida',
  converted: 'Convertida',
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  issued: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
  converted: 'bg-zinc-100 text-zinc-500',
}

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-zinc-50 last:border-0">
      <span className="text-xs text-zinc-400 shrink-0 w-40">{label}</span>
      <span className="text-xs font-medium text-zinc-800 text-right">{value}</span>
    </div>
  )
}

export default async function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [invoice, currentUser] = await Promise.all([
    getInvoice(id).catch(() => null),
    getCurrentUser(),
  ])
  if (!invoice) notFound()

  const vatAmount = invoice.amountNet * (invoice.vatRate / 100)

  const approvalChip  = APPROVAL_CHIP[invoice.approvalStatus]
  const downloadBlock = isDownloadBlocked(invoice.status, invoice.approvalStatus, currentUser?.role ?? 'sales')

  let rectifiedInvoice: Invoice | null = null
  if (invoice.rectifiesId) {
    rectifiedInvoice = await getInvoice(invoice.rectifiesId).catch(() => null)
  }

  const pdfPreviewUrl  = `/api/facturas/generate-pdf?id=${invoice.id}&inline=1`
  const pdfDownloadUrl = `/api/facturas/generate-pdf?id=${invoice.id}`

  /* ── Slots for FacturaPageShell ──────────────────────────────────────── */

  const beforeSlot = (
    <Link
      href="/facturas"
      className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 mb-6 transition-colors"
    >
      ← Facturas
    </Link>
  )

  // Status badges, type tags, client name + action buttons
  // Rendered next to the (interactive) number heading inside the shell
  const afterSlot = (
    <>
      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${STATUS_COLORS[invoice.status]}`}>
        {STATUS_LABELS[invoice.status]}
      </span>
      {invoice.type === 'rectificativa' && (
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
          Rectificativa
        </span>
      )}
      {invoice.type === 'proforma' && (
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">
          Factura Proforma
        </span>
      )}
      {approvalChip && (
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${approvalChip.cls}`}>
          {approvalChip.label}
        </span>
      )}
    </>
  )

  return (
    <FacturaPageShell
      number={invoice.number}
      previewUrl={pdfPreviewUrl}
      downloadUrl={pdfDownloadUrl}
      before={beforeSlot}
      after={afterSlot}
    >
      {/* Approval notes banner */}
      {(invoice.approvalStatus === 'rejected' || invoice.approvalStatus === 'changes_requested') && invoice.approvalNotes && (
        <div className={`mb-4 text-xs px-3 py-2 rounded-lg border ${
          invoice.approvalStatus === 'rejected'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <strong>Motivo:</strong> {invoice.approvalNotes}
        </div>
      )}

      {/* Client name subtitle + action buttons row */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6 -mt-4">
        <p className="text-sm text-zinc-500">{invoice.clientName}</p>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit — only for draft or issued */}
          {(invoice.status === 'draft' || invoice.status === 'issued') && (
            <Link
              href={`/facturas/${invoice.id}/editar`}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Editar
            </Link>
          )}

          {/* PDF download */}
          {downloadBlock ? (
            <span
              title="Pendiente de aprobación — un admin u owner debe aprobar antes de descargar"
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-100 text-zinc-300 px-3 py-1.5 rounded-lg cursor-not-allowed select-none"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11h10" strokeLinecap="round" />
              </svg>
              Descargar PDF
            </span>
          ) : (
            <a
              href={pdfDownloadUrl}
              download
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11h10" strokeLinecap="round" />
              </svg>
              Descargar PDF
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left: invoice data */}
        <div className="space-y-5">
          {/* Client */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Cliente</h2>
            <p className="text-sm font-semibold text-zinc-900">{invoice.clientName}</p>
            {invoice.clientCif && <p className="text-xs text-zinc-500 mt-0.5">NIF/CIF: {invoice.clientCif}</p>}
            {invoice.clientAddress && <p className="text-xs text-zinc-500 mt-0.5">{invoice.clientAddress}</p>}
            {invoice.locationName && (
              <p className="text-xs text-zinc-400 mt-1.5 pt-1.5 border-t border-zinc-100">
                📍 {invoice.locationName}
                {invoice.locationCostCenter && (
                  <span className="ml-1.5 text-zinc-300">· Centro de coste: {invoice.locationCostCenter}</span>
                )}
              </p>
            )}
          </div>

          {/* Concept */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Concepto</h2>
            <p className="text-sm text-zinc-800">{invoice.concept}</p>
          </div>

          {/* Dates */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Fechas</h2>
            <Row label="Fecha emisión" value={formatDate(invoice.issuedAt)} />
            {invoice.dueDateEnabled && (
              <Row
                label="Fecha vencimiento"
                value={
                  <DueDateEditor
                    invoiceId={invoice.id}
                    dueAt={invoice.dueAt}
                    dueDateEnabled={invoice.dueDateEnabled}
                    invoiceStatus={invoice.status}
                  />
                }
              />
            )}
            <Row label="Creada" value={formatDate(invoice.createdAt)} />
          </div>

          {/* Link to rectified invoice */}
          {rectifiedInvoice && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h2 className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-2">Rectifica la factura</h2>
              <Link
                href={`/facturas/${rectifiedInvoice.id}`}
                className="text-sm font-mono font-semibold text-amber-700 hover:underline"
              >
                {rectifiedInvoice.number}
              </Link>
              <p className="text-xs text-amber-600 mt-0.5">{rectifiedInvoice.clientName}</p>
            </div>
          )}
        </div>

        {/* Right: amounts + actions */}
        <div className="space-y-5">
          {/* Amounts */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Importes</h2>
            <div className="space-y-1">
              <Row label="Base imponible" value={<span className="font-mono">{formatEur(invoice.amountNet)}</span>} />
              <Row label={`IVA (${invoice.vatRate}%)`} value={<span className="font-mono">{formatEur(vatAmount)}</span>} />
              <div className="flex items-start justify-between pt-2.5 border-t border-zinc-200">
                <span className="text-xs font-semibold text-zinc-700">Total factura</span>
                <span className="text-base font-mono font-semibold text-zinc-900">{formatEur(invoice.amountTotal)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Acciones</h2>
            {invoice.type === 'proforma' && invoice.status !== 'converted' && (
              <div className="mb-3">
                <ConvertProformaButton invoiceId={invoice.id} />
              </div>
            )}
            {invoice.status === 'converted' ? (
              <p className="text-xs text-zinc-400">Esta factura proforma ya fue convertida a factura.</p>
            ) : (
              <InvoiceActions invoiceId={invoice.id} currentStatus={invoice.status} />
            )}
            <DeleteInvoiceButton invoiceId={invoice.id} />
          </div>

          {/* Deal link */}
          {invoice.dealId && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Deal vinculado</h2>
              <Link
                href={`/deals/${invoice.dealId}`}
                className="text-xs text-blue-700 hover:underline font-mono"
              >
                {invoice.dealId}
              </Link>
            </div>
          )}
        </div>
      </div>
    </FacturaPageShell>
  )
}
