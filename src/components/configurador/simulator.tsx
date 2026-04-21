'use client'

import { useState, useMemo, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS, ADDONS, ADDON_ORDER, PLAN_ORDER, HARDWARE, HARDWARE_ORDER, HARDWARE_MODE_LABELS, RENTAL_MONTHLY_PRICE, PLAN_FEATURES } from '@/lib/pricing/catalog'
import { calculateEconomics, suggestPlan } from '@/lib/pricing/engine'
import { formatCurrency, formatNumber } from '@/lib/format'
import { saveConfigAction } from '@/app/actions/save-config'
import { saveNewVersionAction } from '@/app/actions/save-version'
import { VersionList } from './version-list'
import type { Deal, DealConfiguration, DealEconomics, PlanTier, AddonId, HardwareId, HardwareMode, HardwareLineItem } from '@/types'

// =========================================
// Types & helpers
// =========================================

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface HardwareItemState {
  quantity: number
  mode: HardwareMode
  financeMonths: number
}

type HardwareState = Record<HardwareId, HardwareItemState>

// Hardware items that have an auto-included portion based on plan.
// state.quantity for these IDs = EXTRA units beyond the auto-included ones.
const AUTO_INCLUDED_HARDWARE: ReadonlySet<HardwareId> = new Set(['bouncepad_kiosk', 'counter_stand'])

// In Starter, only 1 unit total is included (user picks which item).
type StarterIncluded = 'bouncepad_kiosk' | 'counter_stand'

// Modes available for extra units ('included' is only for auto-included rows)
const EXTRA_MODES: HardwareMode[] = ['sold', 'financed', 'rented']

/**
 * Returns how many units of `id` are auto-included given the plan and locations.
 * - no plan: 0 (nothing included)
 * - starter: 1 total for the chosen item, 0 for the other
 * - growth/pro: locations units for each
 */
function includedQty(
  id: HardwareId,
  plan: PlanTier | null,
  locations: number,
  starterIncluded: StarterIncluded
): number {
  if (!plan) return 0
  if (!AUTO_INCLUDED_HARDWARE.has(id)) return 0
  if (plan === 'starter') return id === starterIncluded ? 1 : 0
  return locations // growth / pro
}

function initHardwareState(locations: number, saved?: HardwareLineItem[]): HardwareState {
  void locations
  const defaults: HardwareState = {
    ipad: { quantity: 0, mode: 'sold', financeMonths: 12 },
    tablet_lenovo_m11: { quantity: 0, mode: 'sold', financeMonths: 12 },
    bouncepad_kiosk: { quantity: 0, mode: 'sold', financeMonths: 12 }, // extra qty only
    counter_stand: { quantity: 0, mode: 'sold', financeMonths: 12 },  // extra qty only
  }
  if (!saved || saved.length === 0) return defaults
  const state = { ...defaults }
  for (const id of HARDWARE_ORDER as HardwareId[]) {
    if (AUTO_INCLUDED_HARDWARE.has(id)) {
      const extra = saved.find((s) => s.hardwareId === id && s.mode !== 'included')
      if (extra) {
        state[id] = { quantity: extra.quantity, mode: extra.mode, financeMonths: extra.financeMonths ?? 12 }
      }
    } else {
      const item = saved.find((s) => s.hardwareId === id)
      if (item) {
        state[id] = { quantity: item.quantity, mode: item.mode, financeMonths: item.financeMonths ?? 12 }
      }
    }
  }
  return state
}

function initStarterIncluded(saved?: HardwareLineItem[]): StarterIncluded {
  // If saved config had a counter_stand included row, that was the starter choice
  if (saved?.find((s) => s.hardwareId === 'counter_stand' && s.mode === 'included')) {
    return 'counter_stand'
  }
  return 'bouncepad_kiosk'
}

function hardwareStateToLineItems(
  hw: HardwareState,
  locations: number,
  plan: PlanTier | null,
  starterIncluded: StarterIncluded
): HardwareLineItem[] {
  const items: HardwareLineItem[] = []
  for (const id of HARDWARE_ORDER as HardwareId[]) {
    const state = hw[id]
    if (AUTO_INCLUDED_HARDWARE.has(id)) {
      const qty = includedQty(id, plan, locations, starterIncluded)
      if (qty > 0) {
        items.push({
          hardwareId: id,
          quantity: qty,
          mode: 'included',
          unitCost: HARDWARE[id].unitCost,
          unitPrice: HARDWARE[id].unitPrice,
          financeMonths: undefined,
        })
      }
      if (state.quantity > 0) {
        items.push({
          hardwareId: id,
          quantity: state.quantity,
          mode: state.mode,
          unitCost: HARDWARE[id].unitCost,
          unitPrice: HARDWARE[id].unitPrice,
          financeMonths: state.mode === 'financed' ? state.financeMonths : undefined,
        })
      }
    } else if (state.quantity > 0) {
      items.push({
        hardwareId: id,
        quantity: state.quantity,
        mode: state.mode,
        unitCost: HARDWARE[id].unitCost,
        unitPrice: HARDWARE[id].unitPrice,
        financeMonths: state.mode === 'financed' ? state.financeMonths : undefined,
      })
    }
  }
  return items
}

function serializeSimState(
  dailyOrders: number,
  deliveryOrders: number,
  locations: number,
  avgTicket: number,
  planOverride: PlanTier | null,
  activeAddons: Set<AddonId>,
  hardware: HardwareState,
  renEnabled: boolean,
  renFeePerOrder: number,
  renVenues: number,
  kdsVenues: number,
  kioskVenues: number,
  discountPercent: number,
  starterIncluded: StarterIncluded
): string {
  return JSON.stringify({
    dailyOrders,
    deliveryOrders,
    locations,
    avgTicket,
    planOverride,
    addons: [...activeAddons].sort(),
    hardware,
    renEnabled,
    renFeePerOrder,
    renVenues,
    kdsVenues,
    kioskVenues,
    discountPercent,
    starterIncluded,
  })
}

// =========================================
// Simulator
// =========================================

interface SimulatorProps {
  deal: Deal
  initialConfig?: DealConfiguration
  loadedConfigId?: string
}

export function Simulator({ deal, initialConfig, loadedConfigId }: SimulatorProps) {
  const init = initialConfig

  // ---- State ----
  const [dailyOrders, setDailyOrders] = useState(init?.dailyOrdersPerLocation ?? 4500)
  const [deliveryOrders, setDeliveryOrders] = useState(init?.deliveryOrdersPerVenue ?? 500)
  const [locations, setLocations] = useState(init?.locations ?? 1)
  const [avgTicket, setAvgTicket] = useState(init?.averageTicket ?? 18)
  const [planOverride, setPlanOverride] = useState<PlanTier | null>(
    init?.planOverridden ? (init.plan ?? null) : null
  )
  const [activeAddons, setActiveAddons] = useState<Set<AddonId>>(
    new Set(init?.activeAddons ?? [])
  )
  const [hardware, setHardware] = useState<HardwareState>(() =>
    initHardwareState(init?.locations ?? 1, init?.hardware)
  )
  const [renEnabled, setRenEnabled] = useState(init?.renEnabled ?? false)
  const [renFeePerOrder, setRenFeePerOrder] = useState(init?.renFeePerOrder ?? 0.10)
  const [renVenues, setRenVenues] = useState(init?.renVenues ?? 1)
  const [kdsVenues, setKdsVenues] = useState(init?.kdsVenues ?? (init?.locations ?? 1))
  const [kioskVenues, setKioskVenues] = useState(init?.kioskVenues ?? (init?.locations ?? 1))
  const [discountPercent, setDiscountPercent] = useState(init?.discountPercent ?? 0)
  const [starterIncluded, setStarterIncluded] = useState<StarterIncluded>(() =>
    initStarterIncluded(init?.hardware)
  )

  const router = useRouter()

  // ---- Save state (overwrite active) ----
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavePersisted, setLastSavePersisted] = useState(false)

  useEffect(() => {
    if (saveState === 'saved') {
      const t = setTimeout(() => setSaveState('idle'), 3000)
      return () => clearTimeout(t)
    }
  }, [saveState])

  // ---- Save new version state ----
  const [isNewVersionPending, startNewVersionTransition] = useTransition()
  const [saveNewState, setSaveNewState] = useState<SaveState>('idle')
  const [lastNewVersion, setLastNewVersion] = useState<number | undefined>()
  const [lastNewVersionPersisted, setLastNewVersionPersisted] = useState(false)

  // ---- Unsaved changes detection ----
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    serializeSimState(
      init?.dailyOrdersPerLocation ?? 4500,
      init?.deliveryOrdersPerVenue ?? 500,
      init?.locations ?? 1,
      init?.averageTicket ?? 18,
      init?.planOverridden ? (init.plan ?? null) : null,
      new Set(init?.activeAddons ?? []),
      initHardwareState(init?.locations ?? 1, init?.hardware),
      init?.renEnabled ?? false,
      init?.renFeePerOrder ?? 0.10,
      init?.renVenues ?? 1,
      init?.kdsVenues ?? (init?.locations ?? 1),
      init?.kioskVenues ?? (init?.locations ?? 1),
      init?.discountPercent ?? 0,
      initStarterIncluded(init?.hardware)
    )
  )

  const hasUnsavedChanges = useMemo(
    () => serializeSimState(dailyOrders, deliveryOrders, locations, avgTicket, planOverride, activeAddons, hardware, renEnabled, renFeePerOrder, renVenues, kdsVenues, kioskVenues, discountPercent, starterIncluded) !== savedSnapshot,
    [dailyOrders, deliveryOrders, locations, avgTicket, planOverride, activeAddons, hardware, renEnabled, renFeePerOrder, renVenues, kdsVenues, kioskVenues, discountPercent, starterIncluded, savedSnapshot]
  )

  useEffect(() => {
    if (!hasUnsavedChanges) return
    function guard(e: BeforeUnloadEvent) { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (saveNewState === 'saved') {
      const t = setTimeout(() => setSaveNewState('idle'), 4000)
      return () => clearTimeout(t)
    }
  }, [saveNewState])

  // ---- Derived ----
  const suggestedPlan = suggestPlan(dailyOrders) // null when dailyOrders === 0
  const activePlan = planOverride ?? suggestedPlan // null when no override and no suggestion
  const planChanged = planOverride !== null && suggestedPlan !== null && planOverride !== suggestedPlan

  // ---- Auto-reset counter_stand extras on plan change ----
  const prevPlanRef = useRef<PlanTier | null | undefined>(undefined)
  useEffect(() => {
    if (prevPlanRef.current === undefined) {
      prevPlanRef.current = activePlan
      return // skip initial mount
    }
    if (prevPlanRef.current !== activePlan) {
      prevPlanRef.current = activePlan
      setHardware(prev => ({
        ...prev,
        counter_stand: { ...prev.counter_stand, quantity: 0, mode: 'sold' as HardwareMode },
      }))
    }
  }, [activePlan])

  const hardwareLineItems = useMemo(
    () => hardwareStateToLineItems(hardware, locations, activePlan, starterIncluded),
    [hardware, locations, activePlan, starterIncluded]
  )

  const economics: DealEconomics = useMemo(
    () =>
      calculateEconomics({
        dailyOrdersPerLocation: dailyOrders,
        locations,
        averageTicket: avgTicket,
        plan: activePlan,
        activeAddons: Array.from(activeAddons),
        hardware: hardwareLineItems,
      }),
    [dailyOrders, locations, avgTicket, activePlan, activeAddons, hardwareLineItems]
  )

  // ---- Handlers ----
  function toggleAddon(id: AddonId) {
    setActiveAddons((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function setHardwareQty(id: HardwareId, qty: number) {
    setHardware((prev) => ({ ...prev, [id]: { ...prev[id], quantity: Math.max(0, qty) } }))
  }

  function setHardwareMode(id: HardwareId, mode: HardwareMode) {
    setHardware((prev) => ({ ...prev, [id]: { ...prev[id], mode } }))
  }

  function setHardwareFinanceMonths(id: HardwareId, months: number) {
    setHardware((prev) => ({ ...prev, [id]: { ...prev[id], financeMonths: Math.max(1, months) } }))
  }

  function handleSave() {
    setSaveState('saving')
    startTransition(async () => {
      const result = await saveConfigAction({
        dealId: deal.id,
        dailyOrdersPerLocation: dailyOrders,
        deliveryOrdersPerVenue: deliveryOrders,
        locations,
        averageTicket: avgTicket,
        plan: activePlan ?? 'starter',
        planOverridden: planOverride !== null,
        activeAddons: Array.from(activeAddons),
        hardware: hardwareLineItems,
        discountPercent,
        renEnabled,
        renFeePerOrder,
        renVenues,
        kdsVenues,
        kioskVenues,
      })
      if (result.ok) {
        setSaveState('saved')
        setLastSavePersisted(result.persisted)
        setSavedSnapshot(serializeSimState(dailyOrders, deliveryOrders, locations, avgTicket, planOverride, activeAddons, hardware, renEnabled, renFeePerOrder, renVenues, kdsVenues, kioskVenues, discountPercent, starterIncluded))
        router.refresh()
      } else {
        setSaveState('error')
      }
    })
  }

  function handleSaveNew() {
    setSaveNewState('saving')
    startNewVersionTransition(async () => {
      const result = await saveNewVersionAction({
        dealId: deal.id,
        dailyOrdersPerLocation: dailyOrders,
        deliveryOrdersPerVenue: deliveryOrders,
        locations,
        averageTicket: avgTicket,
        plan: activePlan ?? 'starter',
        planOverridden: planOverride !== null,
        activeAddons: Array.from(activeAddons),
        hardware: hardwareLineItems,
        discountPercent,
        renEnabled,
        renFeePerOrder,
        renVenues,
        kdsVenues,
        kioskVenues,
      })
      if (result.ok) {
        setSaveNewState('saved')
        setLastNewVersion(result.version)
        setLastNewVersionPersisted(result.persisted)
        setSavedSnapshot(serializeSimState(dailyOrders, deliveryOrders, locations, avgTicket, planOverride, activeAddons, hardware, renEnabled, renFeePerOrder, renVenues, kdsVenues, kioskVenues, discountPercent, starterIncluded))
        router.refresh()
      } else {
        setSaveNewState('error')
      }
    })
  }

  return (
    <>
    {deal.configurations.length > 0 && (
      <VersionList
        deal={deal}
        loadedConfigId={loadedConfigId ?? initialConfig?.id}
        hasUnsavedChanges={hasUnsavedChanges}
      />
    )}
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
      {/* ============================================================
          LEFT — Inputs
      ============================================================ */}
      <div className="space-y-5">

        {/* —— Volumen & Escala —— */}
        <Section title="Volumen & Escala">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-600">
                  Pedidos/mes por local
                </label>
                <span className="text-xs font-mono font-semibold text-zinc-900">
                  {formatNumber(dailyOrders)}
                </span>
              </div>
              <input
                type="range" min={0} max={10000} step={100} value={dailyOrders}
                onChange={(e) => setDailyOrders(Number(e.target.value))}
                className="w-full accent-zinc-900"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                <span>0</span><span>10.000</span>
              </div>
            </div>

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
                type="range" min={1} max={50} step={1} value={locations}
                onChange={(e) => setLocations(Number(e.target.value))}
                className="w-full accent-zinc-900"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                <span>1</span><span>50</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <NumberInput
              label="Ticket medio (€)" value={avgTicket}
              onChange={setAvgTicket} min={1} step={0.5} suffix="€"
            />
          </div>

          <div className="mt-3 flex gap-4 flex-wrap">
            <Pill label="Vol. mensual total" value={`${formatNumber(economics.totalMonthlyVolume)} pedidos`} />
            <Pill label="GMV mensual" value={formatCurrency(economics.totalMonthlyGMV)} />
          </div>
        </Section>

        {/* —— Volumen Delivery —— */}
        <Section title="Volumen Delivery">
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-600">
                Pedidos delivery/mes por local
              </label>
              <span className="text-xs font-mono font-semibold text-zinc-900">
                {formatNumber(deliveryOrders)}
              </span>
            </div>
            <input
              type="range" min={0} max={5000} step={50} value={deliveryOrders}
              onChange={(e) => setDeliveryOrders(Number(e.target.value))}
              className="w-full accent-zinc-900"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
              <span>0</span><span>5.000</span>
            </div>
          </div>
          <div className="mt-3">
            <Pill label="Vol. delivery total" value={`${formatNumber(deliveryOrders * locations)} pedidos`} />
          </div>
        </Section>

        {/* —— Plan —— */}
        <Section title="Plan">
          {planChanged && (
            <div className="mb-3 flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700">
                Sugerido <strong>{PLANS[suggestedPlan].label}</strong> para{' '}
                {formatNumber(dailyOrders)} pedidos/mes. Plan actual:{' '}
                <strong>{PLANS[activePlan!].label}</strong> (manual)
              </p>
              <button
                onClick={() => setPlanOverride(null)}
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
              const isSuggested = suggestedPlan !== null && suggestedPlan === tier

              return (
                <button
                  key={tier}
                  onClick={() => {
                    if (planOverride === tier) {
                      setPlanOverride(null) // deselect active override
                    } else if (tier === suggestedPlan) {
                      setPlanOverride(null) // use suggested = no override
                    } else {
                      setPlanOverride(tier)
                    }
                  }}
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
                  <p className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-zinc-900'}`}>
                    {plan.label}
                  </p>
                  <p className={`text-xs mt-1 ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {plan.description}
                  </p>
                  <p className={`text-xs mt-2 font-mono ${isActive ? 'text-zinc-200' : 'text-zinc-600'}`}>
                    {plan.priceMonthly === 0 ? 'Gratis' : `${plan.priceMonthly}€/mes`}
                    {plan.variableFee > 0 && ` + ${plan.variableFee}€ × ${formatNumber(economics.totalMonthlyVolume)} tickets/mes`}
                  </p>
                </button>
              )
            })}
          </div>

          {activePlan ? (
            <div className="mt-3 bg-zinc-50 rounded-lg px-4 py-3">
              <p className="text-xs font-mono text-zinc-500">
                {PLANS[activePlan].priceMonthly > 0 && `${PLANS[activePlan].priceMonthly}€ × ${locations} local${locations > 1 ? 'es' : ''}`}
                {PLANS[activePlan].priceMonthly > 0 && PLANS[activePlan].variableFee > 0 && ' + '}
                {PLANS[activePlan].variableFee > 0 && `${PLANS[activePlan].variableFee}€ × ${formatNumber(economics.totalMonthlyVolume)} tickets/mes`}
                {' = '}
                <span className="font-semibold text-zinc-800">{formatCurrency(economics.planFeeMonthly)}/mes</span>
              </p>
            </div>
          ) : (
            <div className="mt-3 bg-zinc-50 rounded-lg px-4 py-3">
              <p className="text-xs text-zinc-400">Sin plan seleccionado · Ajusta el volumen o selecciona un plan manualmente</p>
            </div>
          )}

          {/* —— Incluido en el plan —— */}
          {activePlan && (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
              Incluido en el plan
              <span className="ml-2 font-normal text-zinc-400 normal-case tracking-normal">· Por localización</span>
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {PLAN_FEATURES[activePlan].map(feature => (
                <li key={feature} className="flex items-center gap-2 text-xs text-zinc-700">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          )}
        </Section>

        {/* —— Add-ons + REN —— */}
        <Section title="Add-ons">
          {/* ADD-ONS subsection */}
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Add-ons</p>
          <div className="grid grid-cols-2 gap-2.5">
            {ADDON_ORDER.filter((id) => id !== 'kds').map((id) => {
              const addon = ADDONS[id]
              const active = activeAddons.has(id)
              const isKiosk = id === 'kiosk'
              const venueCount = isKiosk ? kioskVenues : null
              const setVenueCount = isKiosk ? setKioskVenues : null
              const venueLabel = isKiosk ? 'Locales con Kiosk' : null

              const price =
                id === 'datafono'
                  ? `${addon.feePercent}% GMV`
                  : addon.perConsumption
                  ? 'por consumo'
                  : isKiosk && active && venueCount != null
                  ? `${addon.priceMonthly ?? 19}€ × ${venueCount} local${venueCount > 1 ? 'es' : ''} con Kiosk`
                  : addon.perLocation
                  ? `${addon.priceMonthly}€ × ${locations} local${locations > 1 ? 'es' : ''}`
                  : `${addon.priceMonthly}€/mes`

              const monthlyImpact: number =
                id === 'datafono'
                  ? economics.datafonoFeeMonthly
                  : isKiosk && venueCount != null
                  ? (addon.priceMonthly ?? 19) * venueCount
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
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{addon.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{addon.description}</p>
                    <p className="text-xs font-mono text-zinc-600 mt-1">{price}</p>
                    {active && !addon.perConsumption && (
                      <p className="text-xs font-mono font-semibold text-emerald-700 mt-0.5">
                        +{formatCurrency(monthlyImpact)}/mes
                      </p>
                    )}
                    {active && isKiosk && venueCount != null && setVenueCount && venueLabel && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <label className="text-xs font-medium text-zinc-600 block mb-1">{venueLabel}</label>
                        <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-zinc-900 w-24">
                          <input
                            type="number"
                            min={1}
                            max={999}
                            step={1}
                            value={venueCount}
                            onChange={(e) => setVenueCount(Math.max(1, Number(e.target.value)))}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 px-2 py-1.5 text-sm font-mono text-zinc-900 outline-none bg-white"
                          />
                          <span className="px-2 text-xs text-zinc-400 bg-zinc-50 border-l border-zinc-200 py-1.5">ud.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* REN separator */}
          <div className="mt-5 mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-100" />
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest whitespace-nowrap">
              REN — Logística propia
            </span>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>

          {/* REN card */}
          <button
            onClick={() => setRenEnabled((v) => !v)}
            className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
              renEnabled
                ? 'border-zinc-900 bg-zinc-50'
                : 'border-zinc-200 bg-white hover:border-zinc-300'
            }`}
          >
            <div
              className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                renEnabled ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-300'
              }`}
            >
              {renEnabled && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900">REN</p>
              <p className="text-xs text-zinc-500 mt-0.5">Marketplace logístico</p>
              {renEnabled && (
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-4 mb-2">
                    <div>
                      <label className="text-xs font-medium text-zinc-600 block mb-1">
                        Fee por pedido al restaurante (€)
                      </label>
                      <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-zinc-900 w-28">
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={renFeePerOrder}
                          onChange={(e) => setRenFeePerOrder(Math.max(0.01, Number(e.target.value)))}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-1.5 text-sm font-mono text-zinc-900 outline-none bg-white"
                        />
                        <span className="px-2 text-xs text-zinc-400 bg-zinc-50 border-l border-zinc-200 py-1.5">€</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-600 block mb-1">
                        Locales con REN
                      </label>
                      <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-zinc-900 w-24">
                        <input
                          type="number"
                          min={1}
                          max={999}
                          step={1}
                          value={renVenues}
                          onChange={(e) => setRenVenues(Math.max(1, Number(e.target.value)))}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-1.5 text-sm font-mono text-zinc-900 outline-none bg-white"
                        />
                        <span className="px-2 text-xs text-zinc-400 bg-zinc-50 border-l border-zinc-200 py-1.5 whitespace-nowrap">ud.</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-zinc-500">
                    {renFeePerOrder.toFixed(2).replace('.', ',')}€ × {formatNumber(deliveryOrders)} pedidos × {renVenues} local{renVenues > 1 ? 'es' : ''} con REN ={' '}
                    <span className="font-semibold text-emerald-700">
                      {formatCurrency(renFeePerOrder * deliveryOrders * renVenues)}/mes
                    </span>
                  </p>
                </div>
              )}
            </div>
          </button>
        </Section>

        {/* —— Hardware —— */}
        <Section title="Hardware">
          <div className="space-y-4">
            {HARDWARE_ORDER.map((id) => {
              const item = HARDWARE[id]
              const state = hardware[id]
              const rentalUnitPrice = item.rentalMonthlyPrice ?? RENTAL_MONTHLY_PRICE
              const isAutoIncluded = AUTO_INCLUDED_HARDWARE.has(id)

              if (isAutoIncluded) {
                const incQty = includedQty(id as HardwareId, activePlan, locations, starterIncluded)
                const isStarterSelected = activePlan === 'starter' && id === starterIncluded
                const isStarterOther = activePlan === 'starter' && id !== starterIncluded
                const extraQty = state.quantity
                const extraLineTotal = state.mode === 'rented'
                  ? rentalUnitPrice * extraQty
                  : item.unitPrice * extraQty

                return (
                  <div key={id} className="border border-zinc-200 rounded-xl p-4 bg-white">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900">{item.label}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>
                      </div>
                      {incQty > 0 && (
                        <span className="text-xs font-mono text-emerald-600 font-semibold shrink-0 mt-0.5">Incluido</span>
                      )}
                    </div>

                    {/* Starter: toggle which one is included */}
                    {activePlan === 'starter' && (
                      <div className="mb-3">
                        <button
                          onClick={() => setStarterIncluded(id as StarterIncluded)}
                          className={`w-full flex items-center justify-between py-2 px-3 rounded-lg border text-xs transition-all ${
                            isStarterSelected
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-zinc-300'
                          }`}
                        >
                          <span>
                            {isStarterSelected
                              ? '1 ud. incluida · Plan Starter'
                              : 'No incluido en Starter'}
                          </span>
                          <span className="font-mono font-semibold">
                            {isStarterSelected ? 'Incluido en el plan' : '0 incluidas'}
                          </span>
                        </button>
                        {isStarterOther && (
                          <p className="text-[10px] text-zinc-400 mt-1 px-1">
                            Toca para incluir este en su lugar
                          </p>
                        )}
                      </div>
                    )}

                    {/* Growth/Pro: auto-included per local */}
                    {activePlan !== 'starter' && incQty > 0 && (
                      <div className="flex items-center justify-between py-2 px-3 bg-emerald-50 rounded-lg border border-emerald-100 mb-3">
                        <span className="text-xs text-emerald-700">
                          {incQty} ud. incluida{incQty > 1 ? 's' : ''} · 1 por local
                        </span>
                        <span className="text-xs font-mono text-emerald-600 font-semibold">Incluido en el plan</span>
                      </div>
                    )}

                    {/* Extra units */}
                    <div>
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
                        + Adicionales
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setHardwareQty(id, extraQty - 1)}
                            disabled={extraQty === 0}
                            className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-mono text-zinc-900">{extraQty}</span>
                          <button
                            onClick={() => setHardwareQty(id, extraQty + 1)}
                            className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 text-sm font-medium"
                          >
                            +
                          </button>
                        </div>

                        <select
                          value={state.mode}
                          onChange={(e) => setHardwareMode(id, e.target.value as HardwareMode)}
                          disabled={extraQty === 0}
                          className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 bg-white disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        >
                          {EXTRA_MODES.map((m) => (
                            <option key={m} value={m}>{HARDWARE_MODE_LABELS[m]}</option>
                          ))}
                        </select>

                        {extraQty > 0 && (
                          <span className="text-xs font-mono text-zinc-500">
                            {state.mode === 'rented'
                              ? `${formatCurrency(rentalUnitPrice)}/mes`
                              : `${formatCurrency(item.unitPrice)}/ud.`}
                          </span>
                        )}
                      </div>

                      {state.mode === 'financed' && extraQty > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-zinc-500">Plazo:</span>
                          <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setHardwareFinanceMonths(id, state.financeMonths - 1)}
                              disabled={state.financeMonths <= 1}
                              className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 text-sm"
                            >
                              −
                            </button>
                            <span className="px-2 text-xs font-mono text-zinc-900">{state.financeMonths} meses</span>
                            <button
                              onClick={() => setHardwareFinanceMonths(id, state.financeMonths + 1)}
                              className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 text-sm"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs font-mono text-zinc-500">
                            = {formatCurrency((item.unitPrice * extraQty) / state.financeMonths)}/mes
                          </span>
                        </div>
                      )}

                      {extraQty > 0 && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-zinc-400">
                            {extraQty} adicional{extraQty > 1 ? 'es' : ''} ·{' '}
                            {state.mode === 'sold' ? 'cliente paga upfront' : HARDWARE_MODE_LABELS[state.mode]}
                          </span>
                          <span className={`text-xs font-mono font-semibold ${
                            state.mode === 'rented' ? 'text-blue-600' :
                            state.mode === 'financed' ? 'text-amber-600' : 'text-zinc-700'
                          }`}>
                            {state.mode === 'financed'
                              ? `${formatCurrency(extraLineTotal / state.financeMonths)}/mes`
                              : state.mode === 'rented'
                              ? `${formatCurrency(extraLineTotal)}/mes`
                              : formatCurrency(extraLineTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              // Standard hardware item
              const lineTotal = (state.mode === 'rented' ? rentalUnitPrice : item.unitPrice) * state.quantity

              return (
                <div
                  key={id}
                  className={`border rounded-xl p-4 transition-colors ${
                    state.quantity > 0 ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: label + price */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">{item.label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>
                      <p className="text-xs font-mono text-zinc-400 mt-0.5">
                        {state.mode === 'rented'
                          ? `${formatCurrency(rentalUnitPrice)}/mes`
                          : `${formatCurrency(item.unitPrice)}/ud.`}
                      </p>
                    </div>

                    {/* Right: qty stepper + mode selector */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setHardwareQty(id, state.quantity - 1)}
                          disabled={state.quantity === 0}
                          className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-mono text-zinc-900">
                          {state.quantity}
                        </span>
                        <button
                          onClick={() => setHardwareQty(id, state.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 text-sm font-medium"
                        >
                          +
                        </button>
                      </div>

                      <select
                        value={state.mode}
                        onChange={(e) => setHardwareMode(id, e.target.value as HardwareMode)}
                        disabled={state.quantity === 0}
                        className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 bg-white disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      >
                        {(Object.keys(HARDWARE_MODE_LABELS) as HardwareMode[]).map((m) => (
                          <option key={m} value={m}>{HARDWARE_MODE_LABELS[m]}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Finance months row */}
                  {state.mode === 'financed' && state.quantity > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Plazo:</span>
                      <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setHardwareFinanceMonths(id, state.financeMonths - 1)}
                          disabled={state.financeMonths <= 1}
                          className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 text-sm"
                        >
                          −
                        </button>
                        <span className="px-2 text-xs font-mono text-zinc-900">
                          {state.financeMonths} meses
                        </span>
                        <button
                          onClick={() => setHardwareFinanceMonths(id, state.financeMonths + 1)}
                          className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 text-sm"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs font-mono text-zinc-500">
                        = {formatCurrency((item.unitPrice * state.quantity) / state.financeMonths)}/mes
                      </span>
                    </div>
                  )}

                  {/* Line total */}
                  {state.quantity > 0 && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">
                        {state.mode === 'rented'
                          ? `${state.quantity} × ${formatCurrency(rentalUnitPrice)}/mes · mensualidad`
                          : <>
                              {state.quantity} × {formatCurrency(item.unitPrice)}
                              {state.mode === 'sold' && ' · cliente paga upfront'}
                              {state.mode === 'financed' && ` · ${state.financeMonths} meses`}
                            </>
                        }
                      </span>
                      <span className={`text-xs font-mono font-semibold ${
                        state.mode === 'rented' ? 'text-blue-600' :
                        state.mode === 'financed' ? 'text-amber-600' :
                        'text-zinc-700'
                      }`}>
                        {state.mode === 'financed'
                          ? `${formatCurrency(lineTotal / state.financeMonths)}/mes`
                          : state.mode === 'rented'
                          ? `${formatCurrency(lineTotal)}/mes`
                          : formatCurrency(lineTotal)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Hardware summary */}
          {(() => {
            const rentedMonthly = HARDWARE_ORDER.reduce((sum, id) => {
              const s = hardware[id]
              return s.mode === 'rented' ? sum + (HARDWARE[id].rentalMonthlyPrice ?? RENTAL_MONTHLY_PRICE) * s.quantity : sum
            }, 0)
            const purchasedCostTotal = HARDWARE_ORDER.reduce((sum, id) => {
              const s = hardware[id]
              if (s.mode === 'rented' || s.mode === 'included') return sum
              return sum + HARDWARE[id].unitPrice * s.quantity
            }, 0)
            if (purchasedCostTotal === 0 && rentedMonthly === 0) return null
            return (
              <div className="mt-4 bg-zinc-50 rounded-lg px-4 py-3 space-y-1.5">
                {purchasedCostTotal > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-xs text-zinc-500">Inversión total hardware</span>
                      <span className="text-xs font-mono font-semibold text-zinc-800">
                        {formatCurrency(purchasedCostTotal)}
                      </span>
                    </div>
                    {locations > 1 && (
                      <div className="flex justify-between">
                        <span className="text-xs text-zinc-500">Coste por local</span>
                        <span className="text-xs font-mono text-zinc-600">
                          {formatCurrency(purchasedCostTotal / locations)}
                        </span>
                      </div>
                    )}
                    {economics.hardwareNetInvestment > 0 && economics.hardwareNetInvestment !== economics.hardwareCostTotal && (
                      <div className="flex justify-between pt-1.5 border-t border-zinc-200">
                        <span className="text-xs text-zinc-500">Inversión neta Platomico</span>
                        <span className="text-xs font-mono font-semibold text-red-600">
                          {formatCurrency(economics.hardwareNetInvestment)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {rentedMonthly > 0 && (
                  <div className={`flex justify-between ${purchasedCostTotal > 0 ? 'pt-1.5 border-t border-zinc-200' : ''}`}>
                    <span className="text-xs text-zinc-500">Mensualidad de hardware</span>
                    <span className="text-xs font-mono font-semibold text-blue-600">
                      {formatCurrency(rentedMonthly)}/mes
                    </span>
                  </div>
                )}
              </div>
            )
          })()}
        </Section>
      </div>

      {/* ============================================================
          RIGHT — Economics panel (sticky)
      ============================================================ */}
      <div className="xl:sticky xl:top-6">
        <EconomicsPanel
          economics={economics}
          locations={locations}
          deliveryOrders={deliveryOrders}
          renEnabled={renEnabled}
          renFeePerOrder={renFeePerOrder}
          renVenues={renVenues}
          kdsVenues={kdsVenues}
          kioskVenues={kioskVenues}
          discountPercent={discountPercent}
          onDiscountChange={setDiscountPercent}
          activeAddons={activeAddons}
          hardware={hardware}
          hasUnsavedChanges={hasUnsavedChanges}
          saveState={isPending ? 'saving' : saveState}
          lastSavePersisted={lastSavePersisted}
          onSave={handleSave}
          saveNewState={isNewVersionPending ? 'saving' : saveNewState}
          lastNewVersion={lastNewVersion}
          lastNewVersionPersisted={lastNewVersionPersisted}
          onSaveNew={handleSaveNew}
        />
      </div>
    </div>
    </>
  )
}

// =========================================
// Economics Panel
// =========================================

function EconomicsPanel({
  economics,
  locations,
  deliveryOrders,
  renEnabled,
  renFeePerOrder,
  renVenues,
  kdsVenues,
  kioskVenues,
  discountPercent,
  onDiscountChange,
  activeAddons,
  hardware,
  hasUnsavedChanges,
  saveState,
  lastSavePersisted,
  onSave,
  saveNewState,
  lastNewVersion,
  lastNewVersionPersisted,
  onSaveNew,
}: {
  economics: DealEconomics
  locations: number
  deliveryOrders: number
  renEnabled: boolean
  renFeePerOrder: number
  renVenues: number
  kdsVenues: number
  kioskVenues: number
  discountPercent: number
  onDiscountChange: (v: number) => void
  activeAddons: Set<AddonId>
  hardware: HardwareState
  hasUnsavedChanges: boolean
  saveState: SaveState
  lastSavePersisted: boolean
  onSave: () => void
  saveNewState: SaveState
  lastNewVersion: number | undefined
  lastNewVersionPersisted: boolean
  onSaveNew: () => void
}) {
  const hasDatafono = activeAddons.has('datafono')
  const renMonthly = renEnabled ? renFeePerOrder * deliveryOrders * renVenues : 0
  // Adjust addon fee for KDS/Kiosk venue overrides (calculateEconomics uses locations for all per-location addons)
  const kdsAdj = activeAddons.has('kds') ? 19 * (kdsVenues - locations) : 0
  const kioskAdj = activeAddons.has('kiosk') ? 19 * (kioskVenues - locations) : 0
  const softwareFee = economics.softwareRevenueMonthly + kdsAdj + kioskAdj
  const discountAmount = softwareFee * (discountPercent / 100)
  const adjustedMRR = softwareFee - discountAmount + renMonthly + economics.hardwareRevenueMonthly
  const rentedMonthly = HARDWARE_ORDER.reduce((sum, id) => {
    const s = hardware[id]
    return s.mode === 'rented' ? sum + (HARDWARE[id].rentalMonthlyPrice ?? RENTAL_MONTHLY_PRICE) * s.quantity : sum
  }, 0)
  const purchasedCostTotal = HARDWARE_ORDER.reduce((sum, id) => {
    const s = hardware[id]
    if (s.mode === 'rented' || s.mode === 'included') return sum
    return sum + HARDWARE[id].unitPrice * s.quantity
  }, 0)
  const hasHardware = purchasedCostTotal > 0 || rentedMonthly > 0

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* MRR hero */}
      <div className="px-5 py-5 border-b border-zinc-100">
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">MRR estimado</p>
        <p className="text-3xl font-semibold font-mono text-zinc-900">
          {formatCurrency(adjustedMRR)}
        </p>
        <p className="text-sm text-zinc-400 mt-0.5 font-mono">
          {formatCurrency(adjustedMRR * 12)}/año
        </p>
      </div>

      {/* Revenue breakdown */}
      <div className="px-5 py-4 border-b border-zinc-100">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Desglose ingresos
        </p>
        <div className="space-y-2">
          <BreakdownRow label="Plan" value={formatCurrency(economics.planFeeMonthly)} />
          {economics.addonFeeMonthly > 0 && (
            <BreakdownRow label="Add-ons" value={formatCurrency(economics.addonFeeMonthly)} />
          )}
          {hasDatafono && economics.datafonoFeeMonthly > 0 && (
            <BreakdownRow label="Datáfono (0.8% GMV)" value={formatCurrency(economics.datafonoFeeMonthly)} />
          )}
          {/* Discount input */}
          <div className="pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-zinc-600">Descuento ROS</label>
              <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-zinc-900 w-24">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={discountPercent}
                  onChange={(e) => onDiscountChange(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="flex-1 px-2 py-1 text-xs font-mono text-zinc-900 outline-none bg-white w-0"
                />
                <span className="px-2 text-xs text-zinc-400 bg-zinc-50 border-l border-zinc-200 py-1">%</span>
              </div>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-xs text-red-500">Descuento</span>
                <span className="text-xs font-mono text-red-500">−{formatCurrency(discountAmount)}/mes</span>
              </div>
            )}
          </div>
          {renMonthly > 0 && (
            <BreakdownRow label="REN" value={`+${formatCurrency(renMonthly)}/mes`} />
          )}
          {economics.hardwareRevenueMonthly > 0 && (
            <BreakdownRow label="Hardware (financiado)" value={formatCurrency(economics.hardwareRevenueMonthly)} />
          )}
          <div className="pt-2 border-t border-zinc-100">
            <BreakdownRow label="Total mensual" value={formatCurrency(adjustedMRR)} bold />
          </div>
        </div>
      </div>

      {/* Per location */}
      {locations > 1 && (
        <div className="px-5 py-4 border-b border-zinc-100">
          <BreakdownRow label="MRR por local" value={formatCurrency(economics.revenuePerLocation)} />
        </div>
      )}

      {/* GMV */}
      {hasDatafono && (
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">GMV</p>
          <BreakdownRow label="GMV/mes" value={formatCurrency(economics.totalMonthlyGMV)} />
          <BreakdownRow label="GMV/año" value={formatCurrency(economics.totalMonthlyGMV * 12)} />
        </div>
      )}

      {/* REN */}
      {renEnabled && (
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
            REN — Logística propia
          </p>
          <BreakdownRow
            label={`${renFeePerOrder.toFixed(2).replace('.', ',')}€ × ${formatNumber(deliveryOrders)} ped. × ${locations} local${locations > 1 ? 'es' : ''}`}
            value={`${formatCurrency(renMonthly)}/mes`}
          />
        </div>
      )}

      {/* Hardware investment */}
      {hasHardware && (
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
            Inversión hardware
          </p>
          {purchasedCostTotal > 0 && (
            <>
              <BreakdownRow
                label="Coste total (compra/financiado)"
                value={formatCurrency(purchasedCostTotal)}
              />
              {economics.hardwareRevenueUpfront > 0 && (
                <BreakdownRow
                  label="Pago cliente (upfront)"
                  value={formatCurrency(economics.hardwareRevenueUpfront)}
                />
              )}
              {economics.hardwareNetInvestment > 0 && (
                <div className="pt-2 border-t border-zinc-100 mt-2">
                  <BreakdownRow
                    label="Inversión neta Platomico"
                    value={formatCurrency(economics.hardwareNetInvestment)}
                    highlight
                  />
                </div>
              )}
            </>
          )}
          {rentedMonthly > 0 && (
            <div className={purchasedCostTotal > 0 ? 'pt-2 border-t border-zinc-100 mt-2' : ''}>
              <BreakdownRow
                label="Mensualidad de hardware"
                value={`${formatCurrency(rentedMonthly)}/mes`}
              />
            </div>
          )}
        </div>
      )}

      {/* Margin */}
      <div className="px-5 py-4 border-b border-zinc-100">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Margen bruto
        </p>
        <BreakdownRow
          label={`${economics.grossMarginPercent.toFixed(0)}% margen`}
          value={`${formatCurrency(economics.grossMarginMonthly)}/mes`}
          muted={economics.grossMarginMonthly < 0}
        />
        <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">
          ROS al 80%
          {economics.hardwareCostTotal > 0 && ', hardware a coste'}
          {economics.hardwareNetInvestment > 0 && ' · incluye amortización 24 meses'}
        </p>
      </div>

      {/* Payback */}
      <div className="px-5 py-4 border-b border-zinc-100">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Payback hardware
        </p>
        {economics.paybackMonths !== null ? (
          <>
            <p className={`text-2xl font-semibold font-mono ${
              economics.paybackMonths <= 12 ? 'text-emerald-600' :
              economics.paybackMonths <= 24 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {economics.paybackMonths} meses
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Inversión neta {formatCurrency(economics.hardwareNetInvestment)} ÷ {formatCurrency(economics.totalMonthlyRevenue)}/mes
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-400">
            {hasHardware ? 'Sin inversión neta (hardware vendido)' : 'Sin hardware configurado'}
          </p>
        )}
      </div>

      {/* Save */}
      <div className="px-5 py-4 space-y-2">
        {hasUnsavedChanges && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Cambios sin guardar
          </p>
        )}
        {/* Primary: save as new version */}
        <SaveNewButton
          saveState={saveNewState}
          version={lastNewVersion}
          persisted={lastNewVersionPersisted}
          onSave={onSaveNew}
        />
        {/* Secondary: overwrite active */}
        <SaveButton
          saveState={saveState}
          persisted={lastSavePersisted}
          onSave={onSave}
        />
      </div>
    </div>
  )
}

// =========================================
// Save Buttons
// =========================================

function SaveNewButton({
  saveState,
  version,
  persisted,
  onSave,
}: {
  saveState: SaveState
  version: number | undefined
  persisted: boolean
  onSave: () => void
}) {
  if (saveState === 'saving') {
    return (
      <button disabled className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg cursor-not-allowed opacity-70">
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
        </svg>
        Guardando versión...
      </button>
    )
  }

  if (saveState === 'saved') {
    return (
      <button disabled className={`w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg cursor-default ${
        persisted
          ? 'bg-emerald-600 text-white'
          : 'bg-zinc-700 text-white'
      }`}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {persisted && version ? `v.${version} guardada` : 'Guardada (sin persistencia)'}
      </button>
    )
  }

  if (saveState === 'error') {
    return (
      <button onClick={onSave} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-red-100 transition-colors">
        Error · Reintentar nueva versión
      </button>
    )
  }

  return (
    <button onClick={onSave} className="w-full bg-zinc-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 3v10M3 8h10" strokeLinecap="round" />
      </svg>
      Guardar nueva versión
    </button>
  )
}

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
      <button disabled className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-400 text-sm font-medium px-4 py-2.5 rounded-lg cursor-not-allowed">
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
        </svg>
        Guardando...
      </button>
    )
  }

  if (saveState === 'saved') {
    return (
      <button disabled className={`w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg cursor-default transition-colors ${
        persisted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-zinc-50 text-zinc-600 border border-zinc-200'
      }`}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {persisted ? 'Guardado' : 'Guardado (sin persistencia)'}
      </button>
    )
  }

  if (saveState === 'error') {
    return (
      <button onClick={onSave} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-red-100 transition-colors">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3.5M8 11v.5" strokeLinecap="round" />
        </svg>
        Error al guardar · Reintentar
      </button>
    )
  }

  return (
    <button onClick={onSave} className="w-full text-zinc-500 text-xs font-medium px-4 py-2 rounded-lg hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-colors">
      Actualizar versión activa
    </button>
  )
}

// =========================================
// Sub-components
// =========================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
  label, value, onChange, min, step, suffix,
}: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; step?: number; suffix?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-600 block mb-1.5">{label}</label>
      <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-transparent">
        <input
          type="number" min={min} step={step} value={value}
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
  label, value, bold, muted, highlight,
}: {
  label: string; value: string
  bold?: boolean; muted?: boolean; highlight?: boolean
}) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className={`text-xs ${muted ? 'text-red-400' : 'text-zinc-600'}`}>{label}</span>
      <span className={`text-xs font-mono ${
        bold ? 'font-semibold text-zinc-900' :
        highlight ? 'font-semibold text-red-600' :
        muted ? 'text-red-400' :
        'text-zinc-800'
      }`}>
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
