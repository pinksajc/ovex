import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoice } from '@/lib/supabase/invoices'
import { InvoiceActions } from './actions'
import type { Invoice, InvoiceStatus } from '@/types'

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  paid: 'Pagada',
  overdue: 'Vencida',
  converted: 'Convertida',
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-border-subtle text-text-tertiary',
  issued: 'bg-info/12 text-info',
  paid: 'bg-success/12 text-success',
  overdue: 'bg-danger/12 text-danger',
  converted: 'bg-accent/12 text-accent-text',
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
    <div className="flex items-start justify-between py-2.5 border-b border-border-subtle last:border-0">
      <span className="text-[13px] text-text-tertiary shrink-0 w-40">{label}</span>
      <span className="text-[13px] font-medium text-text-primary text-right">{value}</span>
    </div>
  )
}

export default async function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id).catch(() => null)
  if (!invoice) notFound()

  const vatAmount = invoice.amountNet * (invoice.vatRate / 100)

  let rectifiedInvoice: Invoice | null = null
  if (invoice.rectifiesId) {
    rectifiedInvoice = await getInvoice(invoice.rectifiesId).catch(() => null)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link
        href="/facturas"
        className="inline-flex items-center gap-1 text-[13px] text-text-tertiary hover:text-text-secondary mb-6 transition-colors duration-150"
      >
        ← Facturas
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-text-primary font-mono tracking-tight">{invoice.number}</h1>
            <span className={`text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-[4px] ${STATUS_COLORS[invoice.status]}`}>
              {STATUS_LABELS[invoice.status]}
            </span>
            {invoice.type === 'rectificativa' && (
              <span className="text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-[4px] bg-warning/12 text-warning">
                Rectificativa
              </span>
            )}
          </div>
          <p className="text-[13px] text-text-secondary">{invoice.clientName}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit — only for draft or issued */}
          {(invoice.status === 'draft' || invoice.status === 'issued') && (
            <Link
              href={`/facturas/${invoice.id}/editar`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border-subtle text-text-secondary hover:bg-hover hover:border-border-strong px-3 h-9 rounded-[6px] transition-colors duration-150"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Editar
            </Link>
          )}

          {/* PDF download */}
          <a
            href={`/api/facturas/generate-pdf?id=${invoice.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border-subtle text-text-secondary hover:bg-hover hover:border-border-strong px-3 h-9 rounded-[6px] transition-colors duration-150"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 11h10" strokeLinecap="round" />
            </svg>
            Descargar PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left: invoice data */}
        <div className="space-y-5">
          {/* Client */}
          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Cliente</h2>
            <p className="text-[14px] font-semibold text-text-primary">{invoice.clientName}</p>
            {invoice.clientCif && <p className="text-[13px] text-text-secondary mt-0.5">NIF/CIF: {invoice.clientCif}</p>}
            {invoice.clientAddress && <p className="text-[13px] text-text-secondary mt-0.5">{invoice.clientAddress}</p>}
          </div>

          {/* Concept */}
          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Concepto</h2>
            <p className="text-[13px] text-text-primary">{invoice.concept}</p>
          </div>

          {/* Dates */}
          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Fechas</h2>
            <Row label="Fecha emisión" value={<span className="font-mono">{formatDate(invoice.issuedAt)}</span>} />
            <Row label="Fecha vencimiento" value={<span className="font-mono">{formatDate(invoice.dueAt)}</span>} />
            <Row label="Creada" value={<span className="font-mono">{formatDate(invoice.createdAt)}</span>} />
          </div>

          {/* Link to rectified invoice */}
          {rectifiedInvoice && (
            <div className="bg-warning/8 border border-warning/20 rounded-lg p-5">
              <h2 className="text-[11px] font-medium text-warning/70 uppercase tracking-wider mb-2">Rectifica la factura</h2>
              <Link
                href={`/facturas/${rectifiedInvoice.id}`}
                className="text-[14px] font-mono font-semibold text-warning hover:opacity-80 transition-opacity"
              >
                {rectifiedInvoice.number}
              </Link>
              <p className="text-[13px] text-warning/70 mt-0.5">{rectifiedInvoice.clientName}</p>
            </div>
          )}
        </div>

        {/* Right: amounts + actions */}
        <div className="space-y-5">
          {/* Amounts */}
          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Importes</h2>
            <div className="space-y-1">
              <Row label="Base imponible" value={<span className="font-mono">{formatEur(invoice.amountNet)}</span>} />
              <Row label={`IVA (${invoice.vatRate}%)`} value={<span className="font-mono">{formatEur(vatAmount)}</span>} />
              <div className="flex items-start justify-between pt-2.5 border-t border-border-subtle">
                <span className="text-[13px] font-semibold text-text-secondary">Total factura</span>
                <span className="text-[16px] font-mono font-semibold text-text-primary">{formatEur(invoice.amountTotal)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Cambiar estado</h2>
            <InvoiceActions invoiceId={invoice.id} currentStatus={invoice.status} />
          </div>

          {/* Deal link */}
          {invoice.dealId && (
            <div className="bg-surface border border-border-subtle rounded-lg p-5">
              <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Deal vinculado</h2>
              <Link
                href={`/deals/${invoice.dealId}`}
                className="text-[13px] text-accent-text hover:text-accent font-mono transition-colors duration-150"
              >
                {invoice.dealId}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
