import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDeal, getActiveConfig, getProposal } from '@/lib/deals'
import { logEvent, getProposalViewStats } from '@/lib/supabase/events'
import { formatCurrency, formatNumber } from '@/lib/format'
import { PLANS, ADDONS, HARDWARE } from '@/lib/pricing/catalog'
import { ProposalEditor } from '@/components/propuesta/proposal-editor'
import { CopyLinkButton } from '@/components/propuesta/copy-link-button'
import { SendForSignatureButton } from '@/components/propuesta/send-for-signature-button'
import type { Deal, DealConfiguration, ProposalSections } from '@/types'

// =========================================
// Page
// =========================================

export default async function PropuestaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const deal = await getDeal(id)
  if (!deal) notFound()
  void logEvent('deal_opened', id)

  const cfg = getActiveConfig(deal)

  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Load proposal + view stats in parallel
  const [saved, viewStats] = await Promise.all([
    cfg ? getProposal(deal.id, cfg.id) : Promise.resolve(null),
    cfg ? getProposalViewStats(deal.id) : Promise.resolve({ count: 0, lastAt: null }),
  ])
  const sections: ProposalSections | null = cfg
    ? (saved?.sections ?? buildDefaultSections(deal, cfg))
    : null

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Nav strip */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-zinc-200 bg-white print:hidden">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Link href="/deals" className="hover:text-zinc-700 transition-colors">Deals</Link>
          <span>/</span>
          <Link href={`/deals/${deal.id}`} className="hover:text-zinc-700 transition-colors">
            {deal.company.name}
          </Link>
          <span>/</span>
          <span className="text-zinc-700 font-medium">Propuesta</span>
          {cfg && (
            <>
              <span>/</span>
              <span className="text-[11px] font-mono bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">
                v{cfg.version}{cfg.label ? ` · ${cfg.label}` : ''}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {cfg && (
            <span className="text-xs text-zinc-400 hidden md:block">
              {viewStats.count === 0
                ? 'No abierta aún'
                : `Vista ${viewStats.count} ${viewStats.count === 1 ? 'vez' : 'veces'} · Última: ${formatTimeAgo(viewStats.lastAt!)}`}
            </span>
          )}
          {cfg && viewStats.count > 0 && (
            <div className="w-px h-4 bg-zinc-200 hidden md:block" />
          )}
          {cfg && (
            <SendForSignatureButton
              dealId={deal.id}
              configId={cfg.id}
              sentAt={saved?.sentForSignatureAt ?? null}
              docusealStatus={saved?.docusealStatus ?? null}
              signedAt={saved?.signedAt ?? null}
              signerName={deal.contact.name}
              signerEmail={deal.contact.email}
            />
          )}
          {cfg && (
            <CopyLinkButton
              path={`/deals/${deal.id}/propuesta/view`}
              label="Reenviar propuesta"
            />
          )}
          <CopyLinkButton path={`/deals/${deal.id}/propuesta/view`} />
          <Link
            href={`/deals/${deal.id}/propuesta/view`}
            className="text-xs font-medium border border-zinc-200 text-zinc-600 px-3 py-1.5 rounded-lg hover:border-zinc-400 hover:text-zinc-900 transition-colors"
          >
            Ver modo cliente →
          </Link>
          <Link
            href={`/deals/${deal.id}/configurador`}
            className="text-xs text-zinc-400 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            Editar en Simulator →
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {cfg && sections ? (
          <ProposalEditor
            deal={deal}
            cfg={cfg}
            today={today}
            initialSections={sections}
          />
        ) : (
          <EmptyState dealId={deal.id} companyName={deal.company.name} />
        )}
      </div>
    </div>
  )
}

// =========================================
// Default section generator
// Produces filled-in text from deal + config data.
// Called server-side only when no saved proposal exists.
// =========================================

function buildDefaultSections(deal: Deal, cfg: DealConfiguration): ProposalSections {
  const plan = PLANS[cfg.plan]
  const eco = cfg.economics

  const addonsText =
    cfg.activeAddons.length > 0
      ? cfg.activeAddons.map((id) => ADDONS[id].label).join(', ')
      : null

  const hwText =
    cfg.hardware
      .filter((h) => h.quantity > 0)
      .map((h) => `${h.quantity} ${HARDWARE[h.hardwareId].label}`)
      .join(', ') || null

  return {
    executiveSummary: [
      `Platomico propone a ${deal.company.name} una solución completa de gestión de pedidos en hostelería basada en el plan ${plan.label}.`,
      `Con ${cfg.locations} local${cfg.locations > 1 ? 'es' : ''} y un volumen estimado de ${formatNumber(cfg.dailyOrdersPerLocation)} pedidos mensuales por local, la plataforma digitaliza y optimiza toda la operación.`,
      `El impacto económico estimado es de ${formatCurrency(eco.totalMonthlyRevenue)}/mes (${formatCurrency(eco.annualRevenue)}/año).`,
    ].join(' '),

    solution: [
      `La solución incluye el plan ${plan.label} con acceso completo a la plataforma Platomico.`,
      addonsText ? `Módulos adicionales contratados: ${addonsText}.` : null,
      hwText ? `Hardware incluido: ${hwText}.` : null,
      'La implementación contempla formación completa del equipo y soporte técnico dedicado durante el arranque.',
    ]
      .filter(Boolean)
      .join(' '),

    economicsSummary: [
      `Ingresos recurrentes estimados: ${formatCurrency(eco.totalMonthlyRevenue)}/mes · ${formatCurrency(eco.annualRevenue)}/año.`,
      eco.hardwareCostTotal > 0
        ? `Inversión en hardware: ${formatCurrency(eco.hardwareCostTotal)}${eco.paybackMonths !== null ? `. Payback estimado: ${eco.paybackMonths} meses.` : '.'}`
        : 'Sin inversión en hardware adicional.',
      `Margen bruto estimado: ${eco.grossMarginPercent.toFixed(0)}% (${formatCurrency(eco.grossMarginMonthly)}/mes).`,
    ].join(' '),

    nextSteps: [
      '1. Revisión y aprobación de la propuesta.',
      '2. Firma del contrato de servicios.',
      '3. Planificación de la instalación y formación del equipo.',
      '4. Fecha de arranque: a confirmar.',
    ].join('\n'),
  }
}

// =========================================
// Empty state
// =========================================

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  if (mins < 60) return `hace ${mins}m`
  if (hours < 24) return `hace ${hours}h`
  return `hace ${days}d`
}

function EmptyState({ dealId, companyName }: { dealId: string; companyName: string }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 px-10 py-16 text-center shadow-sm">
      <p className="text-3xl mb-4">📋</p>
      <h2 className="text-lg font-semibold text-zinc-800 mb-2">Sin configuración activa</h2>
      <p className="text-sm text-zinc-400 mb-6 max-w-xs mx-auto">
        {companyName} no tiene ninguna configuración guardada todavía. Configura el deal en el
        simulador y guarda una versión para generar la propuesta.
      </p>
      <Link
        href={`/deals/${dealId}/configurador`}
        className="inline-flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors"
      >
        Abrir Simulator →
      </Link>
    </div>
  )
}
