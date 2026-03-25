import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDeal, getActiveConfig } from '@/lib/deals'
import { formatCurrency, formatNumber } from '@/lib/format'
import { PLANS, ADDONS, HARDWARE, HARDWARE_MODE_LABELS } from '@/lib/pricing/catalog'
import type { DealConfiguration } from '@/types'

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
      {/* Nav strip — outside document */}
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

      {/* Document */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {cfg ? (
          <ProposalDocument deal={deal} cfg={cfg} today={today} />
        ) : (
          <EmptyState dealId={deal.id} companyName={deal.company.name} />
        )}
      </div>
    </div>
  )
}

// =========================================
// Proposal Document
// =========================================

function ProposalDocument({
  deal,
  cfg,
  today,
}: {
  deal: Awaited<ReturnType<typeof getDeal>> & object
  cfg: DealConfiguration
  today: string
}) {
  const eco = cfg.economics
  const plan = PLANS[cfg.plan]
  const hardwareItems = cfg.hardware.filter((h) => h.quantity > 0)

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">

      {/* ── Document Header ── */}
      <div className="px-10 pt-10 pb-8 border-b border-zinc-100">
        <div className="flex items-start justify-between mb-8">
          {/* Brand */}
          <div>
            <span className="text-xl font-semibold text-zinc-900 tracking-tight">Orvex</span>
            <p className="text-xs text-zinc-400 mt-0.5">Sales Operating System · Platomico</p>
          </div>
          {/* Badge + date */}
          <div className="text-right">
            <span className="inline-block bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              Propuesta Comercial
            </span>
            <p className="text-xs text-zinc-400 mt-1.5">{today}</p>
          </div>
        </div>

        {/* Client */}
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

        {/* Config version tag */}
        <div className="mt-5 flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded">
            v{cfg.version}{cfg.label ? ` · ${cfg.label}` : ''}
          </span>
          <span className="text-[10px] text-zinc-400">
            Preparada por {deal.owner}
          </span>
        </div>
      </div>

      {/* ── Executive Snapshot ── */}
      <div className="px-10 py-8 border-b border-zinc-100 bg-zinc-50/50">
        <SectionLabel>Resumen ejecutivo</SectionLabel>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          <SnapPill label="Plan" value={plan.label} strong />
          <SnapPill label="Locales" value={String(cfg.locations)} />
          <SnapPill
            label="Pedidos/día"
            value={`${formatNumber(cfg.dailyOrdersPerLocation)} por local`}
          />
          <SnapPill
            label="GMV mensual"
            value={formatCurrency(eco.totalMonthlyGMV)}
          />
          {eco.paybackMonths !== null && (
            <SnapPill
              label="Payback"
              value={`${eco.paybackMonths} meses`}
              color={
                eco.paybackMonths <= 12 ? 'green' :
                eco.paybackMonths <= 24 ? 'amber' : 'red'
              }
            />
          )}
        </div>

        {/* Add-ons */}
        {cfg.activeAddons.length > 0 && (
          <div className="mt-5">
            <p className="text-xs text-zinc-400 mb-2">Add-ons incluidos</p>
            <div className="flex flex-wrap gap-1.5">
              {cfg.activeAddons.map((id) => (
                <span
                  key={id}
                  className="text-xs bg-white border border-zinc-200 text-zinc-700 px-2.5 py-1 rounded-full"
                >
                  {ADDONS[id].label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hardware */}
        {hardwareItems.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-zinc-400 mb-2">Hardware</p>
            <div className="flex flex-wrap gap-1.5">
              {hardwareItems.map((item) => (
                <span
                  key={item.hardwareId}
                  className="text-xs bg-white border border-zinc-200 text-zinc-700 px-2.5 py-1 rounded-full"
                >
                  {item.quantity} × {HARDWARE[item.hardwareId].label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Economics ── */}
      <div className="px-10 py-8 border-b border-zinc-100">
        <SectionLabel>Impacto económico</SectionLabel>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-100 rounded-xl overflow-hidden mt-4">
          <EcoMetric
            label="MRR"
            value={formatCurrency(eco.totalMonthlyRevenue)}
            sub="ingresos recurrentes/mes"
            primary
          />
          <EcoMetric
            label="ARR"
            value={formatCurrency(eco.annualRevenue)}
            sub="ingresos recurrentes/año"
          />
          <EcoMetric
            label="Inversión hardware"
            value={eco.hardwareCostTotal > 0 ? formatCurrency(eco.hardwareCostTotal) : '—'}
            sub={
              eco.hardwareNetInvestment > 0 && eco.hardwareNetInvestment !== eco.hardwareCostTotal
                ? `${formatCurrency(eco.hardwareNetInvestment)} neta Platomico`
                : eco.hardwareCostTotal > 0 ? 'total dispositivos' : 'sin hardware'
            }
          />
          <EcoMetric
            label="Payback"
            value={eco.paybackMonths !== null ? `${eco.paybackMonths} meses` : '—'}
            sub={eco.paybackMonths !== null ? 'recuperación inversión' : 'sin inversión neta'}
            color={
              eco.paybackMonths === null ? undefined :
              eco.paybackMonths <= 12 ? 'green' :
              eco.paybackMonths <= 24 ? 'amber' : 'red'
            }
          />
        </div>

        {/* Margen */}
        <div className="mt-4 flex items-center justify-between bg-zinc-50 rounded-xl px-5 py-3.5">
          <div>
            <p className="text-xs text-zinc-500">Margen bruto estimado</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Software al 80%
              {eco.hardwareCostTotal > 0 ? ', hardware a coste' : ''}
              {eco.hardwareNetInvestment > 0 ? ' · amortización 24 meses' : ''}
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

        {/* Per location — only when >1 */}
        {cfg.locations > 1 && (
          <p className="mt-3 text-xs text-zinc-400 text-right">
            {formatCurrency(eco.revenuePerLocation)}/mes por local ·{' '}
            {formatNumber(eco.monthlyVolumePerLocation)} pedidos/mes por local
          </p>
        )}
      </div>

      {/* ── Commercial Configuration ── */}
      <div className="px-10 py-8 border-b border-zinc-100">
        <SectionLabel>Configuración comercial</SectionLabel>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
          {/* Software */}
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Software
            </p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                <ConfigRow label="Plan" value={plan.label} />
                <ConfigRow
                  label="Precio base"
                  value={
                    plan.priceMonthly === 0
                      ? `Gratis + ${plan.variableFee}€/pedido`
                      : plan.variableFee > 0
                      ? `${plan.priceMonthly}€/mes + ${plan.variableFee}€/pedido`
                      : `${plan.priceMonthly}€/mes`
                  }
                  mono
                />
                <ConfigRow label="Locales" value={String(cfg.locations)} />
                <ConfigRow
                  label="Pedidos/día/local"
                  value={formatNumber(cfg.dailyOrdersPerLocation)}
                />
                <ConfigRow
                  label="Ticket medio"
                  value={formatCurrency(cfg.averageTicket)}
                  mono
                />
                <ConfigRow
                  label="Fee plan/mes"
                  value={formatCurrency(eco.planFeeMonthly)}
                  mono
                />
                {eco.addonFeeMonthly > 0 && (
                  <ConfigRow
                    label="Fee add-ons/mes"
                    value={formatCurrency(eco.addonFeeMonthly)}
                    mono
                  />
                )}
                {eco.datafonoFeeMonthly > 0 && (
                  <ConfigRow
                    label="Fee datáfono/mes"
                    value={formatCurrency(eco.datafonoFeeMonthly)}
                    mono
                  />
                )}
              </tbody>
            </table>

            {cfg.activeAddons.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-zinc-400 mb-2">Add-ons activos</p>
                <div className="space-y-1.5">
                  {cfg.activeAddons.map((id) => {
                    const addon = ADDONS[id]
                    const monthlyFee =
                      id === 'datafono'
                        ? eco.datafonoFeeMonthly
                        : addon.perLocation && addon.priceMonthly != null
                        ? addon.priceMonthly * cfg.locations
                        : addon.priceMonthly ?? 0
                    return (
                      <div
                        key={id}
                        className="flex justify-between text-xs text-zinc-600"
                      >
                        <span>{addon.label}</span>
                        <span className="font-mono text-zinc-500">
                          {id === 'datafono'
                            ? `${addon.feePercent}% GMV`
                            : `${formatCurrency(monthlyFee)}/mes`}
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
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Hardware
            </p>
            {hardwareItems.length > 0 ? (
              <div className="space-y-3">
                {hardwareItems.map((item) => {
                  const hw = HARDWARE[item.hardwareId]
                  const lineTotal = item.unitPrice * item.quantity
                  return (
                    <div
                      key={item.hardwareId}
                      className="flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm text-zinc-800 font-medium">{hw.label}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {item.quantity} ud. ·{' '}
                          {HARDWARE_MODE_LABELS[item.mode]}
                          {item.mode === 'financed' && item.financeMonths
                            ? ` ${item.financeMonths} meses`
                            : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono font-medium text-zinc-800">
                          {item.mode === 'financed' && item.financeMonths
                            ? `${formatCurrency(lineTotal / item.financeMonths)}/mes`
                            : formatCurrency(lineTotal)}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {formatCurrency(item.unitPrice)}/ud.
                        </p>
                      </div>
                    </div>
                  )
                })}

                {/* Hardware totals */}
                <div className="pt-3 border-t border-zinc-100 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Inversión total</span>
                    <span className="font-mono font-semibold text-zinc-800">
                      {formatCurrency(eco.hardwareCostTotal)}
                    </span>
                  </div>
                  {eco.hardwareRevenueUpfront > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Pago cliente upfront</span>
                      <span className="font-mono text-zinc-500">
                        {formatCurrency(eco.hardwareRevenueUpfront)}
                      </span>
                    </div>
                  )}
                  {eco.hardwareRevenueMonthly > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Cuotas mensuales</span>
                      <span className="font-mono text-zinc-500">
                        {formatCurrency(eco.hardwareRevenueMonthly)}/mes
                      </span>
                    </div>
                  )}
                  {eco.hardwareNetInvestment > 0 && (
                    <div className="flex justify-between text-xs pt-1 border-t border-zinc-100">
                      <span className="text-zinc-500 font-medium">Inversión neta Platomico</span>
                      <span className="font-mono font-semibold text-red-600">
                        {formatCurrency(eco.hardwareNetInvestment)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400 italic">Sin hardware configurado</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-10 py-6 bg-zinc-50/50">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-zinc-400 leading-relaxed max-w-sm">
            Documento de uso interno. Generado por Orvex · Platomico.
            Los datos económicos son estimaciones basadas en la configuración activa.
          </p>
          <div className="text-right">
            <p className="text-xs font-mono text-zinc-400">
              v{cfg.version} · {today}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================
// Empty state
// =========================================

function EmptyState({
  dealId,
  companyName,
}: {
  dealId: string
  companyName: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 px-10 py-16 text-center shadow-sm">
      <p className="text-3xl mb-4">📋</p>
      <h2 className="text-lg font-semibold text-zinc-800 mb-2">
        Sin configuración activa
      </h2>
      <p className="text-sm text-zinc-400 mb-6 max-w-xs mx-auto">
        {companyName} no tiene ninguna configuración guardada todavía. Configura el
        deal en el simulador y guarda una versión para generar la propuesta.
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

// =========================================
// Sub-components
// =========================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
      {children}
    </p>
  )
}

function SnapPill({
  label,
  value,
  strong,
  color,
}: {
  label: string
  value: string
  strong?: boolean
  color?: 'green' | 'amber' | 'red'
}) {
  const colorClass =
    color === 'green' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    color === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-700' :
    color === 'red'   ? 'bg-red-50 border-red-200 text-red-700' :
    'bg-white border-zinc-200 text-zinc-700'

  return (
    <div className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${colorClass}`}>
      <span className="text-[10px] text-zinc-400">{label}</span>
      <span className={`text-xs font-mono ${strong ? 'font-semibold text-zinc-900' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  )
}

function EcoMetric({
  label,
  value,
  sub,
  primary,
  color,
}: {
  label: string
  value: string
  sub?: string
  primary?: boolean
  color?: 'green' | 'amber' | 'red'
}) {
  const valueColor =
    color === 'green' ? 'text-emerald-600' :
    color === 'amber' ? 'text-amber-600' :
    color === 'red'   ? 'text-red-600' :
    primary ? 'text-zinc-900' : 'text-zinc-700'

  return (
    <div className="bg-white px-5 py-5">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-semibold font-mono ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{sub}</p>}
    </div>
  )
}

function ConfigRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <tr>
      <td className="py-1.5 text-xs text-zinc-400 pr-4 w-1/2">{label}</td>
      <td className={`py-1.5 text-xs text-zinc-800 text-right ${mono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </td>
    </tr>
  )
}
