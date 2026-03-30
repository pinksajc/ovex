// =========================================
// PRICING ENGINE
// Funciones puras — sin side effects, sin UI
// =========================================

import { PLANS, ADDONS } from './catalog'
import type { PlanTier, AddonId, HardwareLineItem, DealEconomics } from '@/types'

// ---- PLAN SUGGESTION ----

export function suggestPlan(monthlyOrdersPerLocation: number): PlanTier {
  if (monthlyOrdersPerLocation <= 500) return 'starter'
  if (monthlyOrdersPerLocation <= 1000) return 'growth'
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
  const monthlyVolumePerLocation = dailyOrdersPerLocation  // input is already monthly
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

  const softwareRevenueMonthly = planFeeMonthly + addonFeeMonthly + datafonoFeeMonthly

  // ---- Hardware ----
  // sold     → client pays unitPrice upfront. Platomico: no ongoing revenue, net cost = 0 (sold at cost)
  // financed → client pays unitPrice / financeMonths monthly. Platomico pays upfront.
  // included → Platomico bears full unitCost. No client payment.

  let hardwareCostTotal = 0
  let hardwareRevenueUpfront = 0
  let hardwareRevenueMonthly = 0
  let hardwareIncludedCost = 0
  let hardwareFinancedCost = 0

  for (const item of hardware) {
    const itemCost = item.unitCost * item.quantity
    const itemRevenue = item.unitPrice * item.quantity
    hardwareCostTotal += itemCost

    switch (item.mode) {
      case 'sold':
        hardwareRevenueUpfront += itemRevenue
        break
      case 'financed': {
        const months = item.financeMonths ?? 12
        hardwareRevenueMonthly += itemRevenue / months
        hardwareFinancedCost += itemCost
        break
      }
      case 'included':
        hardwareIncludedCost += itemCost
        break
    }
  }

  // Net investment = what Platomico must eventually recover from recurring revenue
  // • sold items: cost fully offset by upfront client payment → 0 net
  // • financed items: Platomico paid upfront, collects monthly → full cost counts
  // • included items: pure subsidy, recover from software revenue
  const hardwareNetInvestment = hardwareFinancedCost + hardwareIncludedCost

  // ---- Revenue total ----
  const totalMonthlyRevenue = softwareRevenueMonthly + hardwareRevenueMonthly
  const annualRevenue = totalMonthlyRevenue * 12
  const revenuePerLocation = locations > 0 ? totalMonthlyRevenue / locations : 0

  // ---- Margin ----
  // Software: 80% gross (SaaS assumption — server, support, infra ≈ 20%)
  // Hardware sold/financed: 0% (priced at cost in catalog)
  // Hardware included: monthly burden = full cost amortized over 24 months
  const HARDWARE_AMORT_MONTHS = 24
  const includedHardwareMonthlyBurden = hardwareIncludedCost / HARDWARE_AMORT_MONTHS
  const grossMarginMonthly =
    softwareRevenueMonthly * 0.8 +
    hardwareRevenueMonthly * 0 -
    includedHardwareMonthlyBurden
  const grossMarginPercent =
    totalMonthlyRevenue > 0
      ? (grossMarginMonthly / totalMonthlyRevenue) * 100
      : 0

  // ---- Payback ----
  // How many months of full MRR to recover net hardware investment
  const paybackMonths =
    hardwareNetInvestment > 0 && totalMonthlyRevenue > 0
      ? Math.ceil(hardwareNetInvestment / totalMonthlyRevenue)
      : null

  return {
    monthlyVolumePerLocation,
    totalMonthlyVolume,
    monthlyGMVPerLocation,
    totalMonthlyGMV,
    planFeeMonthly,
    addonFeeMonthly,
    datafonoFeeMonthly,
    softwareRevenueMonthly,
    hardwareRevenueUpfront,
    hardwareRevenueMonthly,
    totalMonthlyRevenue,
    annualRevenue,
    revenuePerLocation,
    hardwareCostTotal,
    hardwareNetInvestment,
    grossMarginPercent,
    grossMarginMonthly,
    paybackMonths,
    // backward compat
    hardwareRevenueTotal: hardwareRevenueUpfront,
    hasReviewManualItems: false,
  }
}
