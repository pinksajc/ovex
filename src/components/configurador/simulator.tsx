'use client'

import { useState, useMemo, useTransition, useEffect } from 'react'
import { PLANS, ADDONS, ADDON_ORDER, PLAN_ORDER } from '@/lib/pricing/catalog'
import { calculateEconomics, suggestPlan } from '@/lib/pricing/engine'
import { formatCurrency, formatNumber } from '@/lib/format'
import { saveConfigAction } from '@/app/actions/save-config'
import type { Deal, DealConfiguration, DealEconomics, PlanTier, AddonId } from '@/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SimulatorProps {
  deal: Deal
  initialConfig?: DealConfiguration
}

export function Simulator({ deal, initialConfig }: SimulatorProps) {
  const init = initialConfig

  // ---- State ----
  const [dailyOrders, setDailyOrders] = useState(
    init?.dailyOrdersPerLocation ?? 150
  )
  const [locations, setLocations] = useState(init?.locations ?? 1)
  const [avgTicket, setAvgTicket] = useState(init?.averageTicket ?? 18)
  const [planOverride, setPlanOverride] = useState<PlanTier | null>(
    init?.planOverridden ? (init.plan ?? null) : null
  )
  const [activeAddons, setActiveAddons] = useState<Set<AddonId>>(
    new Set(init?.activeAddons ?? [])
  )

  // ---- Save state ----
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavePersisted, setLastSavePersisted] = useState(false)

  // Reset "saved" back to "idle" after 3s
  useEffect(() => {
    if (saveState === 'saved') {
      const t = setTimeout(() => setSaveState('idle'), 3000)
      return () => clearTimeout(t)
    }
  }, [saveState])

  // ---- Derived ----
  const suggestedPlan = suggestPlan(dailyOrders)
  const activePlan = planOverride ?? suggestedPlan
  const planChanged = planOverride !== null && planOverride !== suggestedPlan

  const economics: DealEconomics = useMemo(
    () =>
      calculateEconomics({
        dailyOrdersPerLocation: dailyOrders,
        locations,
        averageTicket: avgTicket,
        plan: activePlan,
        activeAddons: Array.from(activeAddons),
        hardware: [],
      }),
    [dailyOrders, locations, avgTicket, activePlan, activeAddons]
  )

  function toggleAddon(id: AddonId) {
    setActiveAddons((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function resetPlanOverride() {
    setPlanOverride(null)
  }

  function handleSave() {
    setSaveState('saving')
    startTransition(async () => {
      const result = await saveConfigAction({
        dealId: deal.id,
        dailyOrdersPerLocation: dailyOrders,
        locations,
        averageTicket: avgTicket,
        plan: activePlan,
        planOverridden: planOverride !== null,
        activeAddons: Array.from(activeAddons),
      })

      if (result.ok) {
        setSaveState('saved')
        setLastSavePersisted(result.persisted)
      } else {
        setSaveState('error')
      }
    })
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
      {/* ============================================================
          LEFT — Inputs
      ============================================================ */}
      <div className="space-y-5">

        {/* —— Volumen & Escala —— */}
        <Section title="Volumen & Escala">
          <div className="grid grid-cols-2 gap-4">
            {/* Daily orders */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-600">
                  Pedidos/día por local
                </label>
                <span className="text-xs font-mono font-semibold text-zinc-900">
                  {formatNumber(dailyOrders)}
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={1000}
                step={10}
                value={dailyOrders}
                onChange={(e) => setDailyOrders(Number(e.target.value))}
                className="w-full accent-zinc-900"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                <span>10</span>
                <span>1.000</span>
              </div>
            </div>

            {/* Locations */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-600">
                  Número de locales
                </label>
                <span className="text-xs font-mono font-semibold text-zinc-900">
                  {locations}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={locations}
                onChange={(e) => setLocations(Number(e.target.value))}
                className="w-full accent-zinc-900"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                <span>1</span>
                <span>50</span>
              </div>
            </div>
          </div>

          {/* Avg ticket */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <NumberInput
              label="Ticket medio (€)"
              value={avgTicket}
              onChange={setAvgTicket}
              min={1}
              step={0.5}
              suffix="€"
            />
          </div>

          {/* Volume summary — usa economics, no recalcula */}
          <div className="mt-3 flex gap-4 flex-wrap">
            <Pill
              label="Vol. mensual total"
              value={`${formatNumber(economics.totalMonthlyVolume)} pedidos`}
            />
            <Pill
              label="GMV mensual"
              value={formatCurrency(economics.totalMonthlyGMV)}
            />
          </div>
        </Section>

        {/* —— Plan —— */}
        <Section title="Plan">
          {/* Suggestion notice */}
          {planChanged && (
            <div className="mb-3 flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700">
                Sugerido <strong>{PLANS[suggestedPlan].label}</strong> para{' '}
                {formatNumber(dailyOrders)} pedidos/día. Plan actual:{' '}
                <strong>{PLANS[activePlan].label}</strong> (manual)
              </p>
              <button
                onClick={resetPlanOverride}
                className="text-xs text-amber-600 hover:text-amber-900 font-medium ml-3 whitespace-nowrap"
              >
                Usar sugerido
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {PLAN_ORDER.map((tier) => {
              const plan = PLANS[tier]
              const isActive = activePlan === tier
              const isSuggested = suggestedPlan === tier

              return (
                <button
                  key={tier}
                  onClick={() => setPlanOverride(tier === suggestedPlan ? null : tier)}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                    isActive
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white hover:border-zinc-400 text-zinc-700'
                  }`}
                >
                  {isSuggested && !planChanged && (
                    <span className="absolute -top-2 left-3 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      Sugerido
                    </span>
                  )}
                  <p
                    className={`font-semibold text-sm ${
                      isActive ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    {plan.label}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      isActive ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {plan.description}
                  </p>
                  <p
                    className={`text-xs mt-2 font-mono ${
                      isActive ? 'text-zinc-200' : 'text-zinc-600'
                    }`}
                  >
                    {plan.priceMonthly === 0 ? 'Gratis' : `${plan.priceMonthly}€/mes`}
                    {plan.variableFee > 0 && ` + ${plan.variableFee}€/pedido`}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Plan fee detail */}
          <div className="mt-3 bg-zinc-50 rounded-lg px-4 py-3">
            <p className="text-xs text-zinc-500">
              Fee plan ({PLANS[activePlan].label}) ={' '}
              <span className="font-mono font-semibold text-zinc-800">
                {formatCurrency(economics.planFeeMonthly)}/mes
              </span>
              {locations > 1 && (
                <span className="text-zinc-400">
                  {' '}
                  ({formatCurrency(economics.planFeeMonthly / locations)}/local)
                </span>
              )}
            </p>
          </div>
        </Section>

        {/* —— Add-ons —— */}
        <Section title="Add-ons">
          <div className="grid grid-cols-2 gap-2.5">
            {ADDON_ORDER.map((id) => {
              const addon = ADDONS[id]
              const active = activeAddons.has(id)
              const price =
                id === 'datafono'
                  ? `${addon.feePercent}% GMV`
                  : addon.perLocation
                  ? `${addon.priceMonthly}€ × ${locations} local${locations > 1 ? 'es' : ''}`
                  : `${addon.priceMonthly}€/mes`

              // Impacto mensual — derivado de economics (sin recalcular)
              const monthlyImpact: number =
                id === 'datafono'
                  ? economics.datafonoFeeMonthly
                  : addon.perLocation && addon.priceMonthly != null
                  ? addon.priceMonthly * locations
                  : addon.priceMonthly ?? 0

              return (
                <button
                  key={id}
                  onClick={() => toggleAddon(id)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                    active
                      ? 'border-zinc-900 bg-zinc-50'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                      active ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-300'
                    }`}
                  >
                    {active && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        viewBox="0 0 10 10"
                        fill="currentColor"
                      >
                        <path
                          d="M1.5 5L4 7.5L8.5 2.5"
                          stroke="white"
                          strokeWidth="1.5"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{addon.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{addon.description}</p>
                    <p className="text-xs font-mono text-zinc-600 mt-1">{price}</p>
                    {active && (
                      <p className="text-xs font-mono font-semibold text-emerald-700 mt-0.5">
                        +{formatCurrency(monthlyImpact)}/mes
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* —— Hardware —— ⚠️ review_manual */}
        <Section title="Hardware">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 text-base shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-medium text-amber-800">Pendiente de definir</p>
                <p className="text-xs text-amber-700 mt-1">
                  Los precios de hardware (terminales POS, KDS, kiosks, impresoras) no están
                  publicados en platomico.com. Se necesitan datos internos para incluirlo en
                  el cálculo de inversión y payback.
                </p>
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  Marcado como{' '}
                  <code className="bg-amber-100 px-1 rounded">review_manual</code>
                </p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ============================================================
          RIGHT — Economics panel (sticky)
      ============================================================ */}
      <div className="xl:sticky xl:top-6">
        <EconomicsPanel
          economics={economics}
          locations={locations}
          activeAddons={activeAddons}
          saveState={isPending ? 'saving' : saveState}
          lastSavePersisted={lastSavePersisted}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}

// ---- Economics Panel ----

function EconomicsPanel({
  economics,
  locations,
  activeAddons,
  saveState,
  lastSavePersisted,
  onSave,
}: {
  economics: DealEconomics
  locations: number
  activeAddons: Set<AddonId>
  saveState: SaveState
  lastSavePersisted: boolean
  onSave: () => void
}) {
  const hasDatafono = activeAddons.has('datafono')

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* MRR hero */}
      <div className="px-5 py-5 border-b border-zinc-100">
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">MRR estimado</p>
        <p className="text-3xl font-semibold font-mono text-zinc-900">
          {formatCurrency(economics.totalMonthlyRevenue)}
        </p>
        <p className="text-sm text-zinc-400 mt-0.5 font-mono">
          {formatCurrency(economics.annualRevenue)}/año
        </p>
      </div>

      {/* Breakdown */}
      <div className="px-5 py-4 border-b border-zinc-100">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Desglose
        </p>
        <div className="space-y-2">
          <BreakdownRow
            label="Plan"
            value={formatCurrency(economics.planFeeMonthly)}
          />
          {economics.addonFeeMonthly > 0 && (
            <BreakdownRow
              label="Add-ons"
              value={formatCurrency(economics.addonFeeMonthly)}
            />
          )}
          {hasDatafono && economics.datafonoFeeMonthly > 0 && (
            <BreakdownRow
              label="Datáfono (0.8% GMV)"
              value={formatCurrency(economics.datafonoFeeMonthly)}
            />
          )}
          {economics.totalMonthlyRevenue > 0 && (
            <div className="pt-2 border-t border-zinc-100">
              <BreakdownRow
                label="Total"
                value={formatCurrency(economics.totalMonthlyRevenue)}
                bold
              />
            </div>
          )}
        </div>
      </div>

      {/* Per location */}
      {locations > 1 && (
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
            Por local
          </p>
          <BreakdownRow
            label="MRR/local"
            value={formatCurrency(economics.revenuePerLocation)}
          />
        </div>
      )}

      {/* GMV (solo si tiene datáfono) */}
      {hasDatafono && (
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
            GMV
          </p>
          <BreakdownRow
            label="GMV/mes"
            value={formatCurrency(economics.totalMonthlyGMV)}
          />
          <BreakdownRow
            label="GMV/año"
            value={formatCurrency(economics.totalMonthlyGMV * 12)}
          />
        </div>
      )}

      {/* Margin — review_manual */}
      <div className="px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Margen estimado
          </p>
          <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded font-medium">
            review_manual
          </span>
        </div>
        <BreakdownRow
          label="Margen (~80%)"
          value={`${economics.grossMarginPercent.toFixed(0)}% · ${formatCurrency(economics.grossMarginMonthly)}/mes`}
          muted
        />
        <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">
          Basado en 20% coste estimado. Revisar con coste interno real.
        </p>
      </div>

      {/* Hardware notice */}
      <div className="px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Inversión / Payback
          </p>
          <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded font-medium">
            review_manual
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Pendiente de hardware. Añadir coste de equipos para calcular payback.
        </p>
      </div>

      {/* Save button */}
      <div className="px-5 py-4">
        <SaveButton
          saveState={saveState}
          persisted={lastSavePersisted}
          onSave={onSave}
        />
      </div>
    </div>
  )
}

// ---- Save Button ----

function SaveButton({
  saveState,
  persisted,
  onSave,
}: {
  saveState: SaveState
  persisted: boolean
  onSave: () => void
}) {
  if (saveState === 'saving') {
    return (
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-400 text-sm font-medium px-4 py-2.5 rounded-lg cursor-not-allowed"
      >
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
        </svg>
        Guardando...
      </button>
    )
  }

  if (saveState === 'saved') {
    return (
      <button
        disabled
        className={`w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg cursor-default transition-colors ${
          persisted
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-zinc-50 text-zinc-600 border border-zinc-200'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {persisted ? 'Guardado' : 'Guardado (sin persistencia)'}
      </button>
    )
  }

  if (saveState === 'error') {
    return (
      <button
        onClick={onSave}
        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-red-100 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3.5M8 11v.5" strokeLinecap="round" />
        </svg>
        Error al guardar · Reintentar
      </button>
    )
  }

  return (
    <button
      onClick={onSave}
      className="w-full bg-zinc-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors"
    >
      Guardar configuración
    </button>
  )
}

// ---- Sub-components ----

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
        {title}
      </h3>
      {children}
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  step,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
  suffix?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-600 block mb-1.5">{label}</label>
      <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-transparent">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 px-3 py-2 text-sm font-mono text-zinc-900 outline-none bg-white"
        />
        {suffix && (
          <span className="px-3 text-xs text-zinc-400 bg-zinc-50 border-l border-zinc-200 py-2">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className={`text-xs ${muted ? 'text-zinc-400' : 'text-zinc-600'}`}>
        {label}
      </span>
      <span
        className={`text-xs font-mono ${
          bold ? 'font-semibold text-zinc-900' : muted ? 'text-zinc-400' : 'text-zinc-800'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-zinc-100 rounded-full px-3 py-1">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className="text-[10px] font-mono font-semibold text-zinc-800">{value}</span>
    </div>
  )
}
