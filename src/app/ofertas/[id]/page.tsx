import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPresupuesto } from '@/lib/supabase/presupuestos'
import { OfertaActions } from './actions'
import { RequiresSignatureToggle } from './requires-signature-toggle'
import type { PresupuestoStatus } from '@/types'

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

export default async function OfertaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const presupuesto = await getPresupuesto(id).catch(() => null)
  if (!presupuesto) notFound()

  const vatAmount = presupuesto.amountNet * (presupuesto.vatRate / 100)
  const canEdit = presupuesto.status === 'draft' || presupuesto.status === 'sent'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link
        href="/facturas?tab=ofertas"
        className="inline-flex items-center gap-1 text-[13px] text-text-tertiary hover:text-text-secondary mb-6 transition-colors duration-150"
      >
        ← Ofertas
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-text-primary font-mono tracking-tight">{presupuesto.number}</h1>
            <span className={`text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-[4px] ${STATUS_COLORS[presupuesto.status]}`}>
              {STATUS_LABELS[presupuesto.status]}
            </span>
          </div>
          <p className="text-[13px] text-text-secondary">{presupuesto.clientName}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <Link
              href={`/ofertas/${presupuesto.id}/editar`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border-subtle text-text-secondary hover:bg-hover hover:border-border-strong px-3 h-9 rounded-[6px] transition-colors duration-150"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Editar
            </Link>
          )}
          <a
            href={`/api/presupuestos/generate-pdf?id=${presupuesto.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border-subtle text-text-secondary hover:bg-hover hover:border-border-strong px-3 h-9 rounded-[6px] transition-colors duration-150"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 11h10" strokeLinecap="round" />
            </svg>
            Descargar oferta
          </a>
          <a
            href={`/api/ofertas/generate-pdf?id=${presupuesto.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border-subtle text-text-secondary hover:bg-hover hover:border-border-strong px-3 h-9 rounded-[6px] transition-colors duration-150"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 11h10" strokeLinecap="round" />
            </svg>
            Descargar Sales Deck
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left */}
        <div className="space-y-5">
          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Cliente</h2>
            <p className="text-[14px] font-semibold text-text-primary">{presupuesto.clientName}</p>
            {presupuesto.clientCif && <p className="text-[13px] text-text-secondary mt-0.5">NIF/CIF: {presupuesto.clientCif}</p>}
            {presupuesto.clientAddress && <p className="text-[13px] text-text-secondary mt-0.5">{presupuesto.clientAddress}</p>}
          </div>

          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Concepto</h2>
            <p className="text-[13px] text-text-primary">{presupuesto.concept}</p>
          </div>

          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Fechas</h2>
            <Row label="Válido hasta" value={<span className="font-mono">{formatDate(presupuesto.validUntil)}</span>} />
            <Row label="Creado" value={<span className="font-mono">{formatDate(presupuesto.createdAt)}</span>} />
          </div>

          {presupuesto.notes && (
            <div className="bg-surface border border-border-subtle rounded-lg p-5">
              <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Notas</h2>
              <p className="text-[13px] text-text-secondary whitespace-pre-wrap">{presupuesto.notes}</p>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="space-y-5">
          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Importes</h2>
            <div className="space-y-1">
              <Row label="Base imponible" value={<span className="font-mono">{formatEur(presupuesto.amountNet)}</span>} />
              <Row label={`IVA (${presupuesto.vatRate}%)`} value={<span className="font-mono">{formatEur(vatAmount)}</span>} />
              <div className="flex items-start justify-between pt-2.5 border-t border-border-subtle">
                <span className="text-[13px] font-semibold text-text-secondary">Total oferta</span>
                <span className="text-[16px] font-mono font-semibold text-text-primary">{formatEur(presupuesto.amountTotal)}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">Cambiar estado</h2>
            <OfertaActions presupuestoId={presupuesto.id} currentStatus={presupuesto.status} />
          </div>

          <div className="bg-surface border border-border-subtle rounded-lg p-5">
            <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">PDF</h2>
            <RequiresSignatureToggle
              presupuestoId={presupuesto.id}
              initialValue={presupuesto.requiresSignature}
            />
          </div>

          {presupuesto.dealId && (
            <div className="bg-surface border border-border-subtle rounded-lg p-5">
              <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Deal vinculado</h2>
              <Link
                href={`/deals/${presupuesto.dealId}`}
                className="text-[13px] text-accent-text hover:text-accent font-mono transition-colors duration-150"
              >
                Ver deal →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
