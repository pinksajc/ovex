import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDeal } from '@/lib/deals'
import { getCurrentUser } from '@/lib/auth'
import { formatCurrency } from '@/lib/format'
import { ContactEditor } from '@/components/contact-editor'
import { CompanyEditor } from '@/components/company-editor'
import { OwnerSelector } from '@/components/owner-selector'
import { getWorkspaceMembers } from '@/lib/auth'
import { getPresupuestosByDeal } from '@/lib/supabase/presupuestos'
import { getInvoicesByDeal } from '@/lib/supabase/invoices'
import { listLocationsByDeal } from '@/lib/supabase/company-locations'
import { DealLocationsPanel } from '@/components/deals/deal-locations-panel'
import { DealTimeline } from '@/components/deals/deal-timeline'
import { ClientHistoryCard } from '@/components/deals/client-history-card'
import { getApprovalEventsByDeal } from '@/lib/supabase/events'
import { CloseProbabilitySelector } from '@/components/deals/close-probability-selector'
import { DealCommentsPanel } from '@/components/deals/deal-comments-panel'
import { getCommentsByDeal } from '@/lib/supabase/deal-comments'
import { getGmailToken } from '@/lib/supabase/gmail-tokens'
import type { DealStage, PresupuestoStatus, InvoiceStatus } from '@/types'

const PRESUPUESTO_STATUS_LABELS: Record<PresupuestoStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Expirado',
}

const PRESUPUESTO_STATUS_COLORS: Record<PresupuestoStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
}

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

const STAGE_LABELS: Record<DealStage, string> = {
  prospecting: 'Prospecting',
  qualified: 'Qualified',
  proposal_sent: 'Propuesta enviada',
  negotiation: 'Negociación',
  closed_won: 'Cerrado ganado',
  closed_lost: 'Cerrado perdido',
  rejected: 'Rechazado',
}

const STAGE_COLORS: Record<DealStage, string> = {
  prospecting: 'bg-zinc-100 text-zinc-600',
  qualified: 'bg-blue-50 text-blue-700',
  proposal_sent: 'bg-violet-50 text-violet-700',
  negotiation: 'bg-amber-50 text-amber-700',
  closed_won: 'bg-emerald-50 text-emerald-700',
  closed_lost: 'bg-red-50 text-red-600',
  rejected: 'bg-red-100 text-red-700',
}

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  const [deal, members, presupuestos, facturas, locations, approvalEvents, comments, gmailToken] = await Promise.all([
    getDeal(id, user ?? undefined),
    getWorkspaceMembers(),
    getPresupuestosByDeal(id).catch(() => []),
    getInvoicesByDeal(id).catch(() => []),
    listLocationsByDeal(id).catch(() => []),
    getApprovalEventsByDeal(id).catch(() => []),
    getCommentsByDeal(id).catch(() => []),
    user ? getGmailToken(user.id).catch(() => null) : Promise.resolve(null),
  ])

  if (!deal) notFound()


  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <Link href="/deals" className="hover:text-zinc-700 transition-colors">
          Deals
        </Link>
        <span>/</span>
        <span className="text-zinc-700 font-medium">{deal.company.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            {deal.company.name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[deal.stage]}`}
            >
              {STAGE_LABELS[deal.stage]}
            </span>
            {deal.company.city && (
              <span className="text-sm text-zinc-400">{deal.company.city}</span>
            )}
            <OwnerSelector
              dealId={deal.id}
              currentOwnerId={deal.ownerId ?? null}
              members={members}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deal.configurations.length > 0 && (
            <Link
              href={`/deals/${deal.id}/propuesta`}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors"
            >
              Ver propuesta
            </Link>
          )}
          <Link
            href={`/deals/${deal.id}/configurador`}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Abrir Simulador →
          </Link>
        </div>
      </div>

      {/* Probabilidad de cierre */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Probabilidad de cierre
        </h3>
        <CloseProbabilitySelector dealId={deal.id} initialValue={deal.closeProbability} />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Empresa */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">
            Empresa
          </h3>
          <CompanyEditor
            dealId={deal.id}
            name={deal.company.name}
            brandName={deal.company.brandName}
            cif={deal.company.cif}
            address={deal.company.address}
            city={deal.company.city}
          />
        </div>

        {/* Contacto */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">
            Contacto
          </h3>
          <ContactEditor
            dealId={deal.id}
            name={deal.contact.name}
            emails={deal.contact.emails}
            phone={deal.contact.phone}
          />
        </div>
      </div>

      {/* Ofertas */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Ofertas</h3>
          <Link
            href={`/ofertas/nuevo?dealId=${deal.id}`}
            className="text-xs font-medium text-zinc-700 border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nueva oferta
          </Link>
        </div>
        {presupuestos.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">No hay ofertas vinculadas a este deal.</p>
        ) : (
          <div className="divide-y divide-zinc-50">
            {presupuestos.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <Link href={`/ofertas/${p.id}`} className="text-xs font-mono font-semibold text-zinc-800 hover:text-blue-700 transition-colors shrink-0">
                    {p.number}
                  </Link>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${PRESUPUESTO_STATUS_COLORS[p.status]}`}>
                    {PRESUPUESTO_STATUS_LABELS[p.status]}
                  </span>
                  {p.concept && (
                    <span className="text-[10px] text-zinc-500 truncate" title={p.concept}>
                      {p.concept}
                    </span>
                  )}
                  {/* Contract indicator — only shown for accepted offers */}
                  {p.status === 'accepted' && (
                    <span
                      title={p.signedContractUrl
                        ? `Contrato firmado · inicio ${p.contractStartDate ?? '—'}`
                        : 'Sin contrato firmado'}
                      className={`w-2 h-2 rounded-full shrink-0 ${p.signedContractUrl ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                    />
                  )}
                  {p.status === 'accepted' && p.contractStartDate && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      desde {p.contractStartDate}
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-zinc-600">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(p.amountTotal)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Localizaciones */}
      <DealLocationsPanel dealId={deal.id} initialLocations={locations} />

      {/* Timeline */}
      {(presupuestos.length > 0 || facturas.length > 0 || approvalEvents.length > 0) && (
        <DealTimeline presupuestos={presupuestos} facturas={facturas} approvalEvents={approvalEvents} />
      )}

      {/* Historial de facturación */}
      {facturas.length > 0 && (
        <ClientHistoryCard
          facturas={facturas}
        />
      )}

      {/* Facturas */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Facturas</h3>
          <Link
            href={`/facturas/nueva?deal_id=${deal.id}`}
            className="text-xs font-medium text-zinc-700 border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nueva factura
          </Link>
        </div>
        {facturas.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">No hay facturas vinculadas a este deal.</p>
        ) : (
          <div className="divide-y divide-zinc-50">
            {facturas.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <Link href={`/facturas/${f.id}`} className="text-xs font-mono font-semibold text-zinc-800 hover:text-blue-700 transition-colors">
                    {f.number}
                  </Link>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${INVOICE_STATUS_COLORS[f.status]}`}>
                    {INVOICE_STATUS_LABELS[f.status]}
                  </span>
                  {f.issuedAt && (
                    <span className="text-[10px] text-zinc-400">
                      {new Date(f.issuedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-zinc-600">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(f.amountTotal)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Simulador link — keep access to simulator but don't show config economics */}
      {deal.configurations.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Configuración activa disponible en el simulador
          </p>
          <Link
            href={`/deals/${deal.id}/configurador`}
            className="text-xs text-zinc-400 hover:text-zinc-900 font-medium transition-colors"
          >
            Abrir simulador →
          </Link>
        </div>
      )}

      {/* Seguimiento */}
      <div className="mt-6">
        <DealCommentsPanel
          dealId={deal.id}
          currentUserId={user?.id ?? ''}
          initialComments={comments}
          gmailConnected={!!gmailToken}
          contactEmail={deal.contact.email || null}
        />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <dt className="text-xs text-zinc-400 shrink-0">{label}</dt>
      <dd className={`text-sm text-zinc-800 text-right ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

function Metric({
  label,
  value,
  highlight,
  muted,
}: {
  label: string
  value: string
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
      <p
        className={`text-base font-semibold font-mono ${
          highlight ? 'text-zinc-900' : muted ? 'text-zinc-400' : 'text-zinc-700'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
