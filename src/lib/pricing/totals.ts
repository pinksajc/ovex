// =========================================
// PRICING TOTALS — Shared monthly total calculator
// Pure function — no side effects, no UI dependencies
// =========================================

import type { AddonId, DeliveryPlanId } from '@/types'
import { DELIVERY_PLANS } from './catalog'

// ---- Input / Output types ----

export interface MonthlyTotalsInput {
  economics: {
    planFeeMonthly: number
    addonFeeMonthly: number      // from engine — excludes datafono & delivery
    datafonoFeeMonthly?: number  // optional, defaults to 0
    hardwareRevenueMonthly: number
  }
  locations: number
  activeAddons: AddonId[] | ReadonlyArray<AddonId> | Set<AddonId>
  deliveryPlan: DeliveryPlanId
  /** Per-location delivery fee override. Falls back to DELIVERY_PLANS[deliveryPlan].priceMonthly. */
  deliveryFixedFeePerLoc?: number
  /** KDS venue count — defaults to locations if omitted. */
  kdsVenues?: number
  /** Kiosk venue count — defaults to locations if omitted. */
  kioskVenues?: number
}

export interface MonthlyTotals {
  planFee: number          // Math.ceil(planFeeMonthly) — billing unit
  addonFee: number         // addonFeeMonthly + kds/kiosk venue adj (excludes datafono & delivery)
  datafonoFee: number      // datafonoFeeMonthly (shown separately in UI)
  deliveryFee: number      // delivery sub-plan fixed fee × locations
  hardwareMonthly: number  // hardwareRevenueMonthly — already ceil'd by engine
  netTotal: number         // planFee + addonFee + datafonoFee + deliveryFee + hardwareMonthly
  iva: number              // netTotal × 0.21
  totalWithIva: number     // netTotal × 1.21
  mrr: number              // = totalWithIva
  arr: number              // = totalWithIva × 12
}

// ---- Helpers ----

const KDS_PRICE_MONTHLY = 19    // € per additional KDS venue/month
const KIOSK_PRICE_MONTHLY = 19  // € per additional Kiosk venue/month

function hasAddon(
  active: AddonId[] | ReadonlyArray<AddonId> | Set<AddonId>,
  id: AddonId,
): boolean {
  return Array.isArray(active)
    ? (active as AddonId[]).includes(id)
    : (active as Set<AddonId>).has(id)
}

// ---- Main function ----

/**
 * Calculate unified monthly totals for a deal configuration.
 *
 * - planFee is Math.ceil'd to match billing amounts.
 * - addonFee includes KDS/Kiosk venue overrides but excludes datafono and delivery.
 * - datafonoFee is returned separately for display (datafono is variable / % GMV).
 * - deliveryFee is the Order Hub fixed sub-plan fee multiplied by locations.
 * - hardwareMonthly is taken directly from the engine (already ceil'd for financed items).
 * - netTotal = planFee + addonFee + datafonoFee + deliveryFee + hardwareMonthly.
 * - IVA (21%) is applied to netTotal. Discounts and REN are NOT included here — apply them after.
 * - mrr = totalWithIva; arr = mrr × 12.
 */
export function calculateMonthlyTotals(input: MonthlyTotalsInput): MonthlyTotals {
  const {
    economics,
    locations,
    activeAddons,
    deliveryPlan,
    deliveryFixedFeePerLoc,
  } = input
  const kdsVenues = input.kdsVenues ?? locations
  const kioskVenues = input.kioskVenues ?? locations

  // Plan fee — ceil to whole euros for billing
  const planFee = Math.ceil(economics.planFeeMonthly)

  // Add-on fee = engine result + per-venue overrides for KDS/Kiosk
  // (engine computes kds/kiosk at cfg.locations venues; adjust for configured venue counts)
  const kdsAdj = hasAddon(activeAddons, 'kds') ? KDS_PRICE_MONTHLY * (kdsVenues - locations) : 0
  const kioskAdj = hasAddon(activeAddons, 'kiosk') ? KIOSK_PRICE_MONTHLY * (kioskVenues - locations) : 0
  const addonFee = economics.addonFeeMonthly + kdsAdj + kioskAdj

  // Datafono (% of GMV — variable; shown separately in UI)
  const datafonoFee = economics.datafonoFeeMonthly ?? 0

  // Delivery fee (catalog priceMonthly = 0; computed from sub-plan or persisted override)
  const deliveryFee = hasAddon(activeAddons, 'delivery_integrations')
    ? (deliveryFixedFeePerLoc ?? DELIVERY_PLANS[deliveryPlan].priceMonthly) * locations
    : 0

  // Hardware monthly (already Math.ceil'd by engine for financed items)
  const hardwareMonthly = economics.hardwareRevenueMonthly

  // Totals — caller applies discounts and REN on top
  const netTotal = planFee + addonFee + datafonoFee + deliveryFee + hardwareMonthly
  const iva = netTotal * 0.21
  const totalWithIva = netTotal * 1.21
  const mrr = totalWithIva
  const arr = totalWithIva * 12

  return { planFee, addonFee, datafonoFee, deliveryFee, hardwareMonthly, netTotal, iva, totalWithIva, mrr, arr }
}
