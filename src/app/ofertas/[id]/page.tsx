import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPresupuesto, getPresupuestosByDeal } from '@/lib/supabase/presupuestos'
import { getInvoicesByDeal } from '@/lib/supabase/invoices'
import { getDealById } from '@/lib/supabase/deals'
import { listLocationsByDeal } from '@/lib/supabase/company-locations'
import { getCurrentUser } from '@/lib/auth'
import { OfertaActions } from './actions'
import { RequiresSignatureToggle } from './requires-signature-toggle'
import { ContractSection } from './contract-section'
import { NuevaVersionButton } from './nueva-version-button'
import { ClientHistoryCard } from '@/components/deals/client-history-card'
import { OfertaPageShell } from './oferta-page-shell'
import { GenerarContratoButton } from './generar-contrato-button'
import { APPROVAL_CHIP, isDownloadBlocked } from '@/lib/approvals'
import { DEAL_TYPE_LABELS, DEAL_TYPE_COLORS } from '@/lib/deal-type'
import { DealSummary } from '@/components/ofertas/deal-summary'
import type { PresupuestoStatus } from '@/types'

const PROB_BADGE_COLORS: Record<number, string> = {
  0:   'bg-zinc-100 text-zinc-500',
  25:  'bg-red-50 text-red-600',
  50:  'bg-orange-50 text-orange-600',
  75:  'bg-blue-50 text-blue-700',
  100: 'bg-emerald-50 text-emerald-700',
}

const STATUS_LABELS: Record<PresupuestoStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Expirado',
}

const STATUS_COLORS: Record<PresupuestoStatus, string> = {
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

export default async function OfertaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [presupuesto, currentUser] = await Promise.all([
    getPresupuesto(id).catch(() => null),
    getCurrentUser(),
  ])
  if (!presupuesto) notFound()

  const vatAmount = presupuesto.amountNet * (presupuesto.vatRate / 100)
  const canEdit = presupuesto.status === 'draft' || presupuesto.status === 'sent'

  // Approval
  const approvalChip  = APPROVAL_CHIP[presupuesto.approvalStatus]
  const downloadBlock = isDownloadBlocked(presupuesto.status, presupuesto.approvalStatus, currentUser?.role ?? 'sales')

  // Fetch deal-level data when linked to a deal
  const [dealPresupuestos, dealFacturas, deal, dealLocations] = presupuesto.dealId
    ? await Promise.all([
        getPresupuestosByDeal(presupuesto.dealId).catch(() => []),
        getInvoicesByDeal(presupuesto.dealId).catch(() => []),
        getDealById(presupuesto.dealId).catch(() => null),
        listLocationsByDeal(presupuesto.dealId).catch(() => []),
      ])
    : [[], [], null, []]

  const locationCount = dealLocations.length

  const pdfDownloadUrl = `/api/presupuestos/generate-pdf?id=${presupuesto.id}`

  /* ── Slots passed to the client shell ─────────────────────────────────── */

  const topSlot = (
    <>
      {/* Back */}
      <Link
        href="/ofertas"
        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 mb-6 transition-colors"
      >
        ← Ofertas
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-semibold text-zinc-900 font-mono tracking-tight">{presupuesto.number}</h1>
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${STATUS_COLORS[presupuesto.status]}`}>
              {STATUS_LABELS[presupuesto.status]}
            </span>
            {presupuesto.dealType && (
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${DEAL_TYPE_COLORS[presupuesto.dealType]}`}>
                {DEAL_TYPE_LABELS[presupuesto.dealType]}
              </span>
            )}
            {deal?.closeProbability != null && (
              <>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${PROB_BADGE_COLORS[deal.closeProbability] ?? 'bg-zinc-100 text-zinc-500'}`}>
                  {deal.closeProbability}%
                </span>
                <Link
                  href={`/deals/${presupuesto.dealId}`}
                  className="text-[10px] font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
                  title="Editar probabilidad en el deal"
                >
                  Editar en deal →
                </Link>
              </>
            )}
            {approvalChip && (
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${approvalChip.cls}`}>
                {approvalChip.label}
              </span>
            )}
          </div>
          {/* Approval notes banner */}
          {(presupuesto.approvalStatus === 'rejected' || presupuesto.approvalStatus === 'changes_requested') && presupuesto.approvalNotes && (
            <div className={`mt-2 text-xs px-3 py-2 rounded-lg border ${
              presupuesto.approvalStatus === 'rejected'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <strong>Motivo:</strong> {presupuesto.approvalNotes}
            </div>
          )}
          <p className="text-sm text-zinc-500">
            {deal?.company?.brandName ?? presupuesto.clientName}
            {deal?.company?.brandName && deal.company.brandName !== presupuesto.clientName && (
              <span className="ml-2 text-xs text-zinc-400">· {presupuesto.clientName}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <NuevaVersionButton presupuestoId={presupuesto.id} />
          {presupuesto.status === 'accepted' && (
            <GenerarContratoButton
              presupuestoId={presupuesto.id}
              dealId={presupuesto.dealId ?? null}
              clientName={presupuesto.clientName}
              clientCif={presupuesto.clientCif}
              clientAddress={presupuesto.clientAddress}
              lineItems={presupuesto.lineItems ?? []}
            />
          )}
          {canEdit && (
            <Link
              href={`/ofertas/${presupuesto.id}/editar`}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Editar
            </Link>
          )}
          {downloadBlock ? (
            <span
              title="Pendiente de aprobación — un admin u owner debe aprobar antes de descargar"
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-100 text-zinc-300 px-3 py-1.5 rounded-lg cursor-not-allowed select-none"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11h10" strokeLinecap="round" />
              </svg>
              Descargar oferta
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
              Descargar oferta
            </a>
          )}
          <a
            href={`/api/ofertas/generate-pdf?id=${presupuesto.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 11h10" strokeLinecap="round" />
            </svg>
            Descargar Sales Deck
          </a>
        </div>
      </div>
    </>
  )

  const bottomSlot = (
    <>
      {/* Client history — show whenever linked to a deal */}
      {presupuesto.dealId && (
        <ClientHistoryCard
          facturas={dealFacturas}
          title="Historial con este cliente"
        />
      )}

      {/* Deal summary — fixed / variable / mixed breakdown */}
      <DealSummary
        lineItems={presupuesto.lineItems}
        dealType={presupuesto.dealType ?? null}
        locationCount={locationCount}
      />

      <div className="grid grid-cols-2 gap-5">
        {/* Left */}
        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Cliente</h2>
            <p className="text-sm font-semibold text-zinc-900">{presupuesto.clientName}</p>
            {presupuesto.clientCif && <p className="text-xs text-zinc-500 mt-0.5">NIF/CIF: {presupuesto.clientCif}</p>}
            {presupuesto.clientAddress && <p className="text-xs text-zinc-500 mt-0.5">{presupuesto.clientAddress}</p>}
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Concepto</h2>
            <p className="text-sm text-zinc-800">{presupuesto.concept}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Fechas</h2>
            <Row label="Válido hasta" value={formatDate(presupuesto.validUntil)} />
            <Row label="Creado" value={formatDate(presupuesto.createdAt)} />
          </div>

          {presupuesto.notes && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Notas</h2>
              <p className="text-xs text-zinc-700 whitespace-pre-wrap">{presupuesto.notes}</p>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Importes</h2>
            <div className="space-y-1">
              <Row label="Base imponible" value={<span className="font-mono">{formatEur(presupuesto.amountNet)}</span>} />
              <Row label={`IVA (${presupuesto.vatRate}%)`} value={<span className="font-mono">{formatEur(vatAmount)}</span>} />
              <div className="flex items-start justify-between pt-2.5 border-t border-zinc-200">
                <span className="text-xs font-semibold text-zinc-700">Total oferta</span>
                <span className="text-base font-mono font-semibold text-zinc-900">{formatEur(presupuesto.amountTotal)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Cambiar estado</h2>
            <OfertaActions presupuestoId={presupuesto.id} currentStatus={presupuesto.status} />
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">PDF</h2>
            <RequiresSignatureToggle
              presupuestoId={presupuesto.id}
              initialValue={presupuesto.requiresSignature}
            />
          </div>

          {/* Contract management — only for accepted offers */}
          {presupuesto.status === 'accepted' && (
            <ContractSection
              presupuestoId={presupuesto.id}
              initialContractStartDate={presupuesto.contractStartDate}
              initialSignedContractUrl={presupuesto.signedContractUrl}
              initialSignedContractFilename={presupuesto.signedContractFilename}
              initialSignedAt={presupuesto.signedAt}
            />
          )}

          {/* Deal vinculado */}
          {presupuesto.dealId && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Deal vinculado</h2>
              <Link
                href={`/deals/${presupuesto.dealId}`}
                className="text-xs text-blue-700 hover:underline"
              >
                {deal?.company?.name ?? presupuesto.clientName} →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <OfertaPageShell
      presupuestos={dealPresupuestos}
      facturas={dealFacturas}
      activePresupuestoId={presupuesto.id}
      showTimeline={dealPresupuestos.length > 0}
      top={topSlot}
      bottom={bottomSlot}
    />
  )
}
