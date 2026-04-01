import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDeal, getActiveConfig, getProposal } from '@/lib/deals'
import { logEvent } from '@/lib/supabase/events'
import { formatCurrency, formatNumber } from '@/lib/format'
import { PLANS, ADDONS, HARDWARE, HARDWARE_MODE_LABELS } from '@/lib/pricing/catalog'
import { PrintButton } from '@/components/propuesta/print-button'
import type { Deal, DealConfiguration, ProposalSections } from '@/types'

export default async function PropuestaViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const deal = await getDeal(id)
  if (!deal) notFound()
  void logEvent('proposal_viewed', id)

  const cfg = getActiveConfig(deal)
  if (!cfg) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-zinc-400 text-sm mb-4">Sin configuración activa para este deal.</p>
          <Link
            href={`/deals/${deal.id}/configurador`}
            className="text-sm font-medium bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Abrir Simulator →
          </Link>
        </div>
      </div>
    )
  }

  const saved = await getProposal(deal.id, cfg.id)
  const sections: ProposalSections = saved?.sections ?? buildDefaultSections(deal, cfg)

  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-zinc-50 proposal-print-wrapper">
      <PrintButton variant="fab" dealId={deal.id} configId={cfg.id} />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <ProposalView deal={deal} cfg={cfg} sections={sections} today={today} />
      </div>
    </div>
  )
}

// =========================================
// ProposalView — read-only, clean
// =========================================

function ProposalView({
  deal,
  cfg,
  sections,
  today,
}: {
  deal: Deal
  cfg: DealConfiguration
  sections: ProposalSections
  today: string
}) {
  const eco = cfg.economics
  const plan = PLANS[cfg.plan]
  const hardwareItems = cfg.hardware.filter((h) => h.quantity > 0)

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm proposal-print-card">

      {/* ── Header ── */}
      <div className="px-10 pt-10 pb-8 border-b border-zinc-100">
        <div className="flex items-start justify-between mb-8">
          {/* Logo mark */}
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <rect width="32" height="32" rx="8" fill="#09090b"/>
              <rect x="9" y="9" width="6" height="14" rx="1.5" fill="white"/>
              <rect x="9" y="9" width="10" height="7" rx="1.5" fill="white"/>
              <circle cx="23" cy="22" r="3" fill="#10b981"/>
            </svg>
            <div>
              <span className="text-base font-bold text-zinc-900 tracking-tight leading-none block">Platomico</span>
              <p className="text-[10px] text-zinc-400 mt-0.5 leading-none">Gestión de pedidos · Hostelería</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              Propuesta Comercial
            </span>
            <p className="text-xs text-zinc-400 mt-1.5">{today}</p>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Preparada para</p>
            <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">
              {deal.company.name}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              {deal.company.city && (
                <span className="text-sm text-zinc-500">{deal.company.city}</span>
              )}
              {deal.company.cif && (
                <span className="text-sm font-mono text-zinc-400">CIF {deal.company.cif}</span>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-zinc-500 space-y-0.5">
            <p className="font-medium text-zinc-700">{deal.contact.name}</p>
            <p className="text-zinc-400">{deal.contact.email}</p>
            {deal.contact.phone && (
              <p className="text-zinc-400 font-mono text-xs">{deal.contact.phone}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded">
            v{cfg.version}{cfg.label ? ` · ${cfg.label}` : ''}
          </span>
          <span className="text-[10px] text-zinc-400">Preparada por {deal.owner}</span>
        </div>
      </div>

      {/* ── Resumen ejecutivo ── */}
      {sections.executiveSummary && (
        <div className="px-10 py-8 border-b border-zinc-100">
          <SectionLabel>Resumen ejecutivo</SectionLabel>
          <p className="mt-3 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
            {sections.executiveSummary}
          </p>

          <div className="flex flex-wrap gap-2 mt-5">
            <Pill label="Plan" value={plan.label} strong />
            <Pill label="Locales" value={String(cfg.locations)} />
            <Pill label="Pedidos/mes" value={`${formatNumber(cfg.dailyOrdersPerLocation)} por local`} />
            <Pill label="GMV mensual" value={formatCurrency(eco.totalMonthlyGMV)} />
            {eco.paybackMonths !== null && (
              <Pill
                label="Payback"
                value={`${eco.paybackMonths} meses`}
                color={eco.paybackMonths <= 12 ? 'green' : eco.paybackMonths <= 24 ? 'amber' : 'red'}
              />
            )}
          </div>

          {cfg.activeAddons.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {cfg.activeAddons.map((id) => (
                <span key={id} className="text-xs bg-zinc-50 border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full">
                  {ADDONS[id].label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Impacto económico ── */}
      <div className="px-10 py-8 border-b border-zinc-100">
        <SectionLabel>Impacto económico</SectionLabel>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-100 rounded-xl overflow-hidden mt-4">
          <Metric label="MRR" value={formatCurrency(eco.totalMonthlyRevenue)} sub="ingresos recurrentes/mes" primary />
          <Metric label="ARR" value={formatCurrency(eco.annualRevenue)} sub="ingresos recurrentes/año" />
          <Metric
            label="Hardware"
            value={eco.hardwareCostTotal > 0 ? formatCurrency(eco.hardwareCostTotal) : '—'}
            sub={eco.hardwareCostTotal > 0 ? 'total dispositivos' : 'sin hardware'}
          />
          <Metric
            label="Payback"
            value={eco.paybackMonths !== null ? `${eco.paybackMonths}m` : '—'}
            sub={eco.paybackMonths !== null ? 'recuperación inversión' : 'sin inversión neta'}
            color={
              eco.paybackMonths === null ? undefined :
              eco.paybackMonths <= 12 ? 'green' :
              eco.paybackMonths <= 24 ? 'amber' : 'red'
            }
          />
        </div>

        <div className="mt-4 flex items-center justify-between bg-zinc-50 rounded-xl px-5 py-3.5">
          <div>
            <p className="text-xs text-zinc-500">Margen bruto estimado</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Software al 80%{eco.hardwareCostTotal > 0 ? ', hardware a coste' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold font-mono text-zinc-900">
              {formatCurrency(eco.grossMarginMonthly)}/mes
            </p>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">
              {eco.grossMarginPercent.toFixed(0)}% sobre MRR
            </p>
          </div>
        </div>

        {sections.economicsSummary && (
          <p className="mt-5 text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
            {sections.economicsSummary}
          </p>
        )}
      </div>

      {/* ── Solución propuesta ── */}
      {sections.solution && (
        <div className="px-10 py-8 border-b border-zinc-100">
          <SectionLabel>Solución propuesta</SectionLabel>
          <p className="mt-3 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
            {sections.solution}
          </p>
        </div>
      )}

      {/* ── Configuración comercial ── */}
      <div className="px-10 py-8 border-b border-zinc-100">
        <SectionLabel>Configuración comercial</SectionLabel>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-5">
          {/* Software */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Software</p>
            <div className="space-y-2">
              <InfoRow label="Plan" value={plan.label} />
              <InfoRow
                label="Precio base"
                value={
                  plan.priceMonthly === 0
                    ? `Gratis + ${plan.variableFee}€/pedido`
                    : plan.variableFee > 0
                    ? `${plan.priceMonthly}€/mes + ${plan.variableFee}€/pedido`
                    : `${plan.priceMonthly}€/mes`
                }
              />
              <InfoRow label="Locales" value={String(cfg.locations)} />
              <InfoRow label="Pedidos/mes/local" value={formatNumber(cfg.dailyOrdersPerLocation)} />
              <InfoRow label="Ticket medio" value={formatCurrency(cfg.averageTicket)} />
              <InfoRow label="Fee mensual" value={formatCurrency(eco.softwareRevenueMonthly)} highlight />
            </div>

            {cfg.activeAddons.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-100">
                <p className="text-xs text-zinc-400 mb-2">Add-ons</p>
                <div className="space-y-1.5">
                  {cfg.activeAddons.map((id) => {
                    const addon = ADDONS[id]
                    return (
                      <div key={id} className="flex justify-between text-xs text-zinc-600">
                        <span>{addon.label}</span>
                        <span className="font-mono text-zinc-400">
                          {id === 'datafono' ? `${addon.feePercent}% GMV` : addon.perConsumption ? 'por consumo' : addon.priceMonthly != null ? `${formatCurrency(addon.priceMonthly * cfg.locations)}/mes` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Hardware */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Hardware</p>
            {hardwareItems.length > 0 ? (
              <div className="space-y-3">
                {hardwareItems.map((item) => {
                  const hw = HARDWARE[item.hardwareId]
                  const lineTotal = item.unitPrice * item.quantity
                  return (
                    <div key={item.hardwareId} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-800 font-medium">{hw.label}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {item.quantity} ud. · {HARDWARE_MODE_LABELS[item.mode]}
                          {item.mode === 'financed' && item.financeMonths ? ` ${item.financeMonths} meses` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono font-medium text-zinc-800">
                          {item.mode === 'financed' && item.financeMonths
                            ? `${formatCurrency(lineTotal / item.financeMonths)}/mes`
                            : formatCurrency(lineTotal)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div className="pt-3 border-t border-zinc-100">
                  <InfoRow label="Total hardware" value={formatCurrency(eco.hardwareCostTotal)} highlight />
                  {eco.paybackMonths !== null && (
                    <InfoRow label="Payback estimado" value={`${eco.paybackMonths} meses`} />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400 italic">Sin hardware configurado</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Próximos pasos ── */}
      {sections.nextSteps && (
        <div className="px-10 py-8 border-b border-zinc-100">
          <SectionLabel>Próximos pasos</SectionLabel>
          <p className="mt-3 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
            {sections.nextSteps}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="px-10 py-6 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#09090b"/>
              <rect x="9" y="9" width="6" height="14" rx="1.5" fill="white"/>
              <rect x="9" y="9" width="10" height="7" rx="1.5" fill="white"/>
              <circle cx="23" cy="22" r="3" fill="#10b981"/>
            </svg>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Propuesta preparada por Platomico · {deal.company.name} · Los datos son proyecciones.
            </p>
          </div>
          <p className="text-[10px] font-mono text-zinc-400 shrink-0 ml-4">v{cfg.version} · {today}</p>
        </div>
      </div>
    </div>
  )
}

// =========================================
// Sub-components
// =========================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">{children}</p>
  )
}

function Pill({ label, value, strong, color }: {
  label: string; value: string; strong?: boolean
  color?: 'green' | 'amber' | 'red'
}) {
  const cls =
    color === 'green' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    color === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-700' :
    color === 'red'   ? 'bg-red-50 border-red-200 text-red-700' :
    'bg-white border-zinc-200 text-zinc-700'
  return (
    <div className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${cls}`}>
      <span className="text-[10px] text-zinc-400">{label}</span>
      <span className={`text-xs font-mono ${strong ? 'font-semibold text-zinc-900' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  )
}

function Metric({ label, value, sub, primary, color }: {
  label: string; value: string; sub?: string
  primary?: boolean; color?: 'green' | 'amber' | 'red'
}) {
  const vc =
    color === 'green' ? 'text-emerald-600' :
    color === 'amber' ? 'text-amber-600' :
    color === 'red'   ? 'text-red-600' :
    primary ? 'text-zinc-900' : 'text-zinc-700'
  return (
    <div className="bg-white px-5 py-5">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-semibold font-mono ${vc}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{sub}</p>}
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className={`font-mono ${highlight ? 'font-semibold text-zinc-900' : 'text-zinc-600'}`}>
        {value}
      </span>
    </div>
  )
}

// =========================================
// Default sections (same logic as editor page)
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
    ].filter(Boolean).join(' '),

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
