// =========================================
// PRICING ENGINE
// Funciones puras — sin side effects, sin UI
// =========================================

import { PLANS, ADDONS } from './catalog'
import type { PlanTier, AddonId, HardwareLineItem, DealEconomics } from '@/types'

// ---- PLAN SUGGESTION ----

export function suggestPlan(dailyOrdersPerLocation: number): PlanTier {
  if (dailyOrdersPerLocation <= 120) return 'starter'
  if (dailyOrdersPerLocation <= 500) return 'growth'
  return 'pro'
}

// ---- CORE CALCULATION ----

export interface CalculateInput {
  dailyOrdersPerLocation: number
  locations: number
  averageTicket: number  // € por pedido
  plan: PlanTier
  activeAddons: AddonId[]
  hardware: HardwareLineItem[]
}

export function calculateEconomics(input: CalculateInput): DealEconomics {
  const {
    dailyOrdersPerLocation,
    locations,
    averageTicket,
    plan,
    activeAddons,
    hardware,
  } = input

  const planConfig = PLANS[plan]

  // ---- Volumen ----
  const monthlyVolumePerLocation = dailyOrdersPerLocation * 30
  const totalMonthlyVolume = monthlyVolumePerLocation * locations

  // ---- GMV ----
  const monthlyGMVPerLocation = monthlyVolumePerLocation * averageTicket
  const totalMonthlyGMV = monthlyGMVPerLocation * locations

  // ---- Fee del plan ----
  const planFeePerLocation =
    planConfig.priceMonthly + planConfig.variableFee * monthlyVolumePerLocation
  const planFeeMonthly = planFeePerLocation * locations

  // ---- Add-ons ----
  let addonFeeMonthly = 0
  let datafonoFeeMonthly = 0

  for (const addonId of activeAddons) {
    const addon = ADDONS[addonId]

    if (addonId === 'datafono') {
      datafonoFeeMonthly = ((addon.feePercent ?? 0) / 100) * totalMonthlyGMV
    } else if (addon.priceMonthly !== undefined) {
      addonFeeMonthly += addon.perLocation
        ? addon.priceMonthly * locations
        : addon.priceMonthly
    }
  }

  // ---- Revenue total ----
  const totalMonthlyRevenue = planFeeMonthly + addonFeeMonthly + datafonoFeeMonthly
  const annualRevenue = totalMonthlyRevenue * 12
  const revenuePerLocation = locations > 0 ? totalMonthlyRevenue / locations : 0

  // ---- Hardware ---- ⚠️ review_manual
  let hardwareCostTotal = 0
  let hardwareRevenueTotal = 0
  const hasReviewManualItems = hardware.length > 0

  for (const item of hardware) {
    hardwareCostTotal += (item.unitCost ?? 0) * item.quantity
    if (item.mode === 'sell' && item.unitPrice != null) {
      hardwareRevenueTotal += item.unitPrice * item.quantity
    }
  }

  // ---- Margen ---- ⚠️ review_manual
  // Placeholder 20% hasta confirmar coste interno real
  const ESTIMATED_COST_PERCENT = 20
  const estimatedCostMonthly = totalMonthlyRevenue * (ESTIMATED_COST_PERCENT / 100)
  const grossMarginMonthly = totalMonthlyRevenue - estimatedCostMonthly
  const grossMarginPercent =
    totalMonthlyRevenue > 0
      ? (grossMarginMonthly / totalMonthlyRevenue) * 100
      : 0

  // ---- Payback ----
  const paybackMonths =
    hardwareCostTotal > 0 && totalMonthlyRevenue > 0
      ? Math.ceil(hardwareCostTotal / totalMonthlyRevenue)
      : null

  return {
    monthlyVolumePerLocation,
    totalMonthlyVolume,
    monthlyGMVPerLocation,
    totalMonthlyGMV,
    planFeeMonthly,
    addonFeeMonthly,
    datafonoFeeMonthly,
    totalMonthlyRevenue,
    annualRevenue,
    revenuePerLocation,
    hardwareCostTotal,
    hardwareRevenueTotal,
    grossMarginPercent,
    grossMarginMonthly,
    paybackMonths,
    hasReviewManualItems,
  }
}
