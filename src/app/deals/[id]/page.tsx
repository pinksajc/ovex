import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDeal, getActiveConfig } from '@/lib/deals'
import { formatCurrency } from '@/lib/format'
import { ContactEditor } from '@/components/contact-editor'
import { CompanyEditor } from '@/components/company-editor'
import { OwnerSelector } from '@/components/owner-selector'
import { getWorkspaceMembers } from '@/lib/auth'
import { getPresupuestosByDeal } from '@/lib/supabase/presupuestos'
import type { DealStage, PresupuestoStatus } from '@/types'

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
  const [deal, members, presupuestos] = await Promise.all([
    getDeal(id),
    getWorkspaceMembers(),
    getPresupuestosByDeal(id).catch(() => []),
  ])

  if (!deal) notFound()

  const cfg = getActiveConfig(deal)

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
          {cfg && (
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
            cif={deal.company.cif}
            address={deal.company.address}
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
            email={deal.contact.email}
            phone={deal.contact.phone}
          />
        </div>
      </div>

      {/* Presupuestos */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Presupuestos</h3>
          <Link
            href={`/presupuestos/nuevo?dealId=${deal.id}`}
            className="text-xs font-medium text-zinc-700 border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nuevo presupuesto
          </Link>
        </div>
        {presupuestos.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">No hay presupuestos vinculados a este deal.</p>
        ) : (
          <div className="divide-y divide-zinc-50">
            {presupuestos.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <Link href={`/presupuestos/${p.id}`} className="text-xs font-mono font-semibold text-zinc-800 hover:text-blue-700 transition-colors">
                    {p.number}
                  </Link>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${PRESUPUESTO_STATUS_COLORS[p.status]}`}>
                    {PRESUPUESTO_STATUS_LABELS[p.status]}
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-600">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(p.amountTotal)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configuración activa */}
      {cfg && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Configuración activa · v{cfg.version}
              {cfg.label && ` · ${cfg.label}`}
            </h3>
            <Link
              href={`/deals/${deal.id}/configurador`}
              className="text-xs text-zinc-400 hover:text-zinc-900 font-medium transition-colors"
            >
              Editar →
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Metric
              label="MRR"
              value={formatCurrency(cfg.economics.totalMonthlyRevenue)}
              highlight
            />
            <Metric label="ARR" value={formatCurrency(cfg.economics.annualRevenue)} />
            <Metric label="Plan" value={cfg.plan.charAt(0).toUpperCase() + cfg.plan.slice(1)} />
            <Metric label="Locales" value={String(cfg.locations)} />
            <Metric
              label="€/local/mes"
              value={formatCurrency(cfg.economics.revenuePerLocation)}
            />
            <Metric
              label="Vol. total/mes"
              value={`${cfg.economics.totalMonthlyVolume.toLocaleString('es-ES')} pedidos`}
            />
            <Metric
              label="GMV/mes"
              value={formatCurrency(cfg.economics.totalMonthlyGMV)}
            />
            <Metric
              label="Margen est."
              value={`${cfg.economics.grossMarginPercent.toFixed(0)}% ⚠️`}
              muted
            />
          </div>

          {cfg.economics.hasReviewManualItems && (
            <p className="mt-4 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              ⚠️ Esta configuración tiene items marcados como{' '}
              <strong>review_manual</strong>. Revisar hardware y margen con datos
              internos antes de enviar propuesta.
            </p>
          )}
        </div>
      )}
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
