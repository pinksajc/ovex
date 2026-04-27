'use client'

import Image from 'next/image'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { PLANS, ADDONS, HARDWARE, HARDWARE_MODE_LABELS } from '@/lib/pricing/catalog'
import { calculateMonthlyTotals } from '@/lib/pricing/totals'
import { formatCurrency, formatNumber } from '@/lib/format'
import { saveProposalAction } from '@/app/actions/save-proposal'
import type { Deal, DealConfiguration, ProposalSections, DeliveryPlanId } from '@/types'

// =========================================
// Types
// =========================================

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface ProposalEditorProps {
  deal: Deal
  cfg: DealConfiguration
  today: string
  initialSections: ProposalSections
}

// =========================================
// ProposalEditor
// =========================================

export function ProposalEditor({ deal, cfg, today, initialSections }: ProposalEditorProps) {
  const [sections, setSections] = useState<ProposalSections>(initialSections)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialSections))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [persisted, setPersisted] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasUnsavedChanges = JSON.stringify(sections) !== savedSnapshot

  // Reset "saved" banner after 4s
  useEffect(() => {
    if (saveState === 'saved') {
      const t = setTimeout(() => setSaveState('idle'), 4000)
      return () => clearTimeout(t)
    }
  }, [saveState])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    function guard(e: BeforeUnloadEvent) { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [hasUnsavedChanges])

  function set(key: keyof ProposalSections, value: string) {
    setSections((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = useCallback(() => {
    setSaveState('saving')
    startTransition(async () => {
      const result = await saveProposalAction(
        deal.id,
        cfg.id,
        sections
      )
      if (result.ok) {
        setSaveState('saved')
        setPersisted(result.persisted)
        setSavedSnapshot(JSON.stringify(sections))
        setSavedAt(
          result.updatedAt
            ? new Date(result.updatedAt).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        )
      } else {
        setSaveState('error')
      }
    })
  }, [deal.id, cfg.id, sections])

  const activeSaveState: SaveState = isPending ? 'saving' : saveState
  const eco = cfg.economics as typeof cfg.economics & {
    deliveryFixedFee?: number
    deliveryExtraFeePerOrder?: number
    deliveryIncludedOrders?: number
    deliveryPlanKey?: string
  }
  const plan = PLANS[cfg.plan]
  const hardwareItems = cfg.hardware.filter((h) => h.quantity > 0)

  const deliveryPlanId = (cfg.deliveryPlan ?? 'start') as DeliveryPlanId

  // REN calculations
  const renEnabled = (cfg.renEnabled === true) && ((cfg.renVenues ?? 0) > 0)
  const renFeePerOrder = cfg.renFeePerOrder ?? 0.10
  const renVenues = cfg.renVenues ?? 0
  const deliveryPerVenue = cfg.deliveryOrdersPerVenue ?? 0
  const renMonthly = renEnabled ? renFeePerOrder * deliveryPerVenue * renVenues : 0

  // Unified monthly totals (planFee ceiled, delivery from persisted sub-plan fee)
  const totals = calculateMonthlyTotals({
    economics: eco,
    locations: cfg.locations,
    activeAddons: cfg.activeAddons,
    deliveryPlan: deliveryPlanId,
    deliveryFixedFeePerLoc: eco.deliveryFixedFee,
  })
  const deliveryFixedFee = totals.deliveryFee
  // Add-ons row: engine addonFee + delivery (excludes datafono, shown separately)
  const totalAddonFee = totals.addonFee + totals.deliveryFee

  // Discount + IVA
  const discountPercent = cfg.discountPercent ?? 0
  const totalNet = totals.netTotal + renMonthly
  const discountAmount = totalNet * (discountPercent / 100)
  const netAfterDiscount = totalNet - discountAmount
  const ivaAmount = netAfterDiscount * 0.21
  const totalWithIva = netAfterDiscount * 1.21

  return (
    <>
      {/* ── Save bar (sticky, above document) ── */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs">
          {activeSaveState === 'saving' && (
            <span className="text-zinc-400">Guardando...</span>
          )}
          {activeSaveState === 'error' && (
            <span className="text-red-500">Error al guardar. Inténtalo de nuevo.</span>
          )}
          {activeSaveState !== 'saving' && activeSaveState !== 'error' && hasUnsavedChanges && (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              Cambios sin guardar
            </span>
          )}
          {activeSaveState !== 'saving' && activeSaveState !== 'error' && !hasUnsavedChanges && savedAt && (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              {persisted ? `Guardado a las ${savedAt}` : 'Guardado (modo local)'}
            </span>
          )}
        </div>
        <SaveButton state={activeSaveState} onSave={handleSave} />
      </div>

      {/* ── Document ── */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">

        {/* Document Header — static */}
        <div className="px-10 pt-10 pb-8 border-b border-zinc-100">
          <div className="flex items-start justify-between mb-8">
            <div>
              <Image
                src="/logo_platomico.png"
                alt="Platomico"
                width={140}
                height={36}
                className="h-8 w-auto object-contain"
              />
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

        {/* ── Solución propuesta ── */}
        <div className="px-10 py-8 border-b border-zinc-100">
          <SectionLabel>Solución propuesta</SectionLabel>
          <EditableTextarea
            value={sections.solution}
            onChange={(v) => set('solution', v)}
            placeholder="Describe qué incluye la solución y cómo resuelve los problemas del cliente..."
            className="mt-3"
          />
        </div>

        {/* ── Plan ── */}
        <div className="px-10 py-8 border-b border-zinc-100">
          <SectionLabel>Plan</SectionLabel>
          <table className="w-full text-sm mt-4">
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
              <ConfigRow label="Pedidos/mes/local" value={formatNumber(cfg.dailyOrdersPerLocation)} />
              <ConfigRow label="Ticket medio" value={formatCurrency(cfg.averageTicket)} mono />
              <ConfigRow label="Fee plan/mes" value={formatCurrency(eco.planFeeMonthly)} mono />
            </tbody>
          </table>
        </div>

        {/* ── Add-ons ── */}
        {cfg.activeAddons.length > 0 && (
          <div className="px-10 py-8 border-b border-zinc-100">
            <SectionLabel>Add-ons</SectionLabel>
            <div className="mt-4 space-y-2">
              {cfg.activeAddons.map((id) => {
                const addon = ADDONS[id]
                // Delivery: use persisted deliveryFixedTotal (engine priceMonthly is 0)
                const monthlyFee =
                  id === 'delivery_integrations' ? deliveryFixedFee
                  : id === 'datafono' ? eco.datafonoFeeMonthly
                  : addon.perLocation && addon.priceMonthly != null
                  ? addon.priceMonthly * cfg.locations
                  : addon.priceMonthly ?? 0
                return (
                  <div key={id} className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0">
                    <div>
                      <span className="text-sm text-zinc-800">{addon.label}</span>
                      {addon.description && (
                        <span className="ml-2 text-xs text-zinc-400">{addon.description}</span>
                      )}
                    </div>
                    <span className="text-sm font-mono text-zinc-600">
                      {id === 'datafono'
                        ? `${addon.feePercent}% GMV`
                        : addon.perConsumption
                        ? 'por consumo'
                        : `${formatCurrency(monthlyFee)}/mes`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── REN — Logística propia ── */}
        {renEnabled && (
          <div className="px-10 py-8 border-b border-zinc-100">
            <SectionLabel>REN — Logística propia</SectionLabel>
            <table className="w-full text-sm mt-4">
              <tbody className="divide-y divide-zinc-100">
                <ConfigRow label="Fee por pedido" value={`${renFeePerOrder.toFixed(2).replace('.', ',')}€/pedido`} mono />
                <ConfigRow label="Pedidos/mes con REN" value={formatNumber(deliveryPerVenue * renVenues)} />
                <ConfigRow label="Locales con REN" value={String(renVenues)} />
                <ConfigRow label="Coste variable total" value={`${formatCurrency(renMonthly)}/mes`} mono />
              </tbody>
            </table>
          </div>
        )}

        {/* ── Hardware ── */}
        {hardwareItems.length > 0 && (
          <div className="px-10 py-8 border-b border-zinc-100">
            <SectionLabel>Hardware</SectionLabel>
            <div className="mt-4 space-y-3">
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
                          ? `${formatCurrency(Math.ceil(lineTotal / item.financeMonths))}/mes`
                          : item.mode === 'included'
                          ? 'Incluido'
                          : formatCurrency(lineTotal)}
                      </p>
                      {item.mode !== 'included' && (
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {formatCurrency(item.unitPrice)}/ud.
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
              {eco.hardwareCostTotal > 0 && (
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
              )}
            </div>
          </div>
        )}

        {/* ── Resumen económico ── */}
        <div className="px-10 py-8 border-b border-zinc-100">
          <SectionLabel>Resumen económico</SectionLabel>
          <div className="mt-4 space-y-0 divide-y divide-zinc-100 border border-zinc-100 rounded-xl overflow-hidden">
            <SummaryRow label="Plan" value={`${formatCurrency(totals.planFee)}/mes`} />
            {totalAddonFee > 0 && (
              <SummaryRow label="Add-ons" value={`${formatCurrency(totalAddonFee)}/mes`} />
            )}
            {eco.datafonoFeeMonthly > 0 && (
              <SummaryRow label="Datáfono" value={`${formatCurrency(eco.datafonoFeeMonthly)}/mes`} />
            )}
            {renEnabled && (
              <SummaryRow label="REN — Logística propia" value={`${formatCurrency(renMonthly)}/mes`} />
            )}
            {eco.hardwareRevenueMonthly > 0 && (
              <SummaryRow label="Hardware (cuotas)" value={`${formatCurrency(eco.hardwareRevenueMonthly)}/mes`} />
            )}
            <SummaryRow label="Total NETO" value={`${formatCurrency(totalNet)}/mes`} bold />
            {discountPercent > 0 && (
              <SummaryRow
                label={`Descuento aplicado: ${discountPercent}%`}
                value={`−${formatCurrency(discountAmount)}/mes`}
                red
              />
            )}
            {discountPercent > 0 && (
              <SummaryRow label="NETO con descuento" value={`${formatCurrency(netAfterDiscount)}/mes`} bold />
            )}
            <SummaryRow label="IVA 21%" value={`${formatCurrency(ivaAmount)}/mes`} muted />
            <div className="flex items-center justify-between px-4 py-3.5 bg-zinc-900">
              <span className="text-sm font-semibold text-white">TOTAL / MES</span>
              <span className="text-lg font-bold font-mono text-white">{formatCurrency(totalWithIva)}</span>
            </div>
          </div>
        </div>

        {/* ── Impacto económico ── */}
        <div className="px-10 py-8 border-b border-zinc-100">
          <SectionLabel>Impacto económico</SectionLabel>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-zinc-100 rounded-xl overflow-hidden mt-4">
            <EcoMetric label="MRR" value={formatCurrency(totalWithIva)} sub="ingresos recurrentes/mes" primary />
            <EcoMetric label="ARR" value={formatCurrency(totalWithIva * 12)} sub="ingresos recurrentes/año" />
            <EcoMetric label="GMV mensual" value={formatCurrency(eco.totalMonthlyGMV)} sub="volumen de negocio gestionado" />
            <EcoMetric
              label="Margen bruto"
              value={`${eco.grossMarginPercent.toFixed(0)}%`}
              sub={`${formatCurrency(eco.grossMarginMonthly)}/mes`}
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
            <EcoMetric
              label="Inversión hardware"
              value={eco.hardwareCostTotal > 0 ? formatCurrency(eco.hardwareCostTotal) : '—'}
              sub={eco.hardwareCostTotal > 0 ? 'total dispositivos' : 'sin hardware'}
            />
          </div>
        </div>

        {/* ── Impacto estimado ── */}
        <div className="px-10 py-8 border-b border-zinc-100">
          <SectionLabel>Impacto estimado</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <ImpactMetric
              label="Pedidos/mes"
              value={formatNumber(eco.totalMonthlyVolume)}
              sub={`${formatNumber(eco.monthlyVolumePerLocation)} por local`}
            />
            <ImpactMetric
              label="Locales"
              value={String(cfg.locations)}
              sub="puntos operativos"
            />
            <ImpactMetric
              label="Ticket medio"
              value={formatCurrency(cfg.averageTicket)}
              sub="por pedido"
            />
            <ImpactMetric
              label="GMV mensual"
              value={formatCurrency(eco.totalMonthlyGMV)}
              sub="volumen gestionado"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-zinc-50/50">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-400 leading-relaxed max-w-sm">
              Propuesta preparada por Platomico para {deal.company.name}.
              Los datos económicos son proyecciones basadas en la configuración acordada.
            </p>
            <p className="text-xs font-mono text-zinc-400">v{cfg.version} · {today}</p>
          </div>
        </div>
      </div>
    </>
  )
}

// =========================================
// Save button
// =========================================

function SaveButton({ state, onSave }: { state: SaveState; onSave: () => void }) {
  if (state === 'saving') {
    return (
      <button disabled className="flex items-center gap-2 bg-zinc-100 text-zinc-400 text-sm font-medium px-4 py-2 rounded-lg cursor-not-allowed">
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
        </svg>
        Guardando...
      </button>
    )
  }
  if (state === 'saved') {
    return (
      <button disabled className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium px-4 py-2 rounded-lg cursor-default">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Guardado
      </button>
    )
  }
  if (state === 'error') {
    return (
      <button onClick={onSave} className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-100 transition-colors">
        Error · Reintentar
      </button>
    )
  }
  return (
    <button onClick={onSave} className="bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors">
      Guardar propuesta
    </button>
  )
}

// =========================================
// EditableTextarea
// =========================================

function EditableTextarea({
  value,
  onChange,
  placeholder,
  className = '',
  rows = 4,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  rows?: number
}) {
  return (
    <div className={`group relative ${className}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none bg-transparent text-sm text-zinc-700 leading-relaxed
          placeholder:text-zinc-300 outline-none
          border border-transparent rounded-lg px-3 py-2
          hover:border-zinc-200 hover:bg-zinc-50/50
          focus:border-zinc-300 focus:bg-zinc-50
          transition-colors"
      />
      <span className="absolute top-2 right-2 text-[10px] text-zinc-300 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">
        editar
      </span>
    </div>
  )
}

// =========================================
// Sub-components (self-contained)
// =========================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
      {children}
    </p>
  )
}

function EcoMetric({ label, value, sub, primary, color }: {
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

function ConfigRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr>
      <td className="py-1.5 text-xs text-zinc-400 pr-4 w-1/2">{label}</td>
      <td className={`py-1.5 text-xs text-zinc-800 text-right ${mono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </td>
    </tr>
  )
}

function SummaryRow({ label, value, bold, red, muted }: {
  label: string; value: string; bold?: boolean; red?: boolean; muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white">
      <span className={`text-xs ${red ? 'text-red-600 font-medium' : muted ? 'text-zinc-400' : 'text-zinc-600'}`}>
        {label}
      </span>
      <span className={`text-xs font-mono ${red ? 'text-red-600 font-semibold' : bold ? 'text-zinc-900 font-semibold' : muted ? 'text-zinc-400' : 'text-zinc-700'}`}>
        {value}
      </span>
    </div>
  )
}

function ImpactMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-50 rounded-xl px-5 py-4 border border-zinc-100">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-semibold font-mono text-zinc-900">{value}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-1">{sub}</p>}
    </div>
  )
}
