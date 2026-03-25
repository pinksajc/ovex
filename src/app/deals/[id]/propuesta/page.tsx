import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDeal, getActiveConfig, getProposal } from '@/lib/deals'
import { formatCurrency, formatNumber } from '@/lib/format'
import { PLANS, ADDONS, HARDWARE } from '@/lib/pricing/catalog'
import { ProposalEditor } from '@/components/propuesta/proposal-editor'
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

  const cfg = getActiveConfig(deal)

  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Nav strip — static Server Component */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Link href="/deals" className="hover:text-zinc-700 transition-colors">Deals</Link>
          <span>/</span>
          <Link href={`/deals/${deal.id}`} className="hover:text-zinc-700 transition-colors">
            {deal.company.name}
          </Link>
          <span>/</span>
          <span className="text-zinc-700 font-medium">Propuesta</span>
        </div>
        <Link
          href={`/deals/${deal.id}/configurador`}
          className="text-xs text-zinc-400 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          Editar en Simulator →
        </Link>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {cfg ? (
          <ProposalContent deal={deal} cfg={cfg} today={today} />
        ) : (
          <EmptyState dealId={deal.id} companyName={deal.company.name} />
        )}
      </div>
    </div>
  )
}

// =========================================
// ProposalContent — async, loads saved proposal then renders editor
// =========================================

async function ProposalContent({
  deal,
  cfg,
  today,
}: {
  deal: Deal
  cfg: DealConfiguration
  today: string
}) {
  // Load saved proposal (null if none or mock mode)
  const saved = await getProposal(deal.id)

  // Use saved sections or build defaults from deal + cfg
  const sections: ProposalSections =
    saved?.sections ?? buildDefaultSections(deal, cfg)

  return (
    <ProposalEditor
      deal={deal}
      cfg={cfg}
      today={today}
      initialSections={sections}
    />
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
      `Con ${cfg.locations} local${cfg.locations > 1 ? 'es' : ''} y un volumen estimado de ${formatNumber(cfg.dailyOrdersPerLocation)} pedidos diarios por local, la plataforma digitaliza y optimiza toda la operación.`,
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
