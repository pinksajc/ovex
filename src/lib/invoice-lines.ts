// =========================================
// INVOICE LINE GENERATOR
// Generates invoice lines from a location + deal configuration.
// =========================================

import { PLANS, ADDONS, DELIVERY_PLANS } from '@/lib/pricing/catalog'
import type { CompanyLocation, DealConfiguration, InvoiceLineItem } from '@/types'

function newId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

/**
 * Generates invoice line items for a single location based on the deal's active config.
 * Skips: analytics_premium (consumption-based), datafono (% GMV, not per-line).
 */
export function generateLinesForLocation(
  loc: CompanyLocation,
  config: DealConfiguration,
): InvoiceLineItem[] {
  const lines: InvoiceLineItem[] = []
  const plan = PLANS[config.plan]

  const group = {
    locationGroupId: loc.id,
    locationGroupName: loc.name,
    locationGroupAddress: loc.address ?? undefined,
  }

  // 1 — Fixed plan fee (Starter = €0, no line generated)
  if (plan.priceMonthly > 0) {
    lines.push({
      id: newId(),
      type: 'line',
      description: `ROS ${plan.label}`,
      quantity: 1,
      unitPrice: plan.priceMonthly,
      amount: plan.priceMonthly,
      serviceId: `ros_${config.plan}_fixed`,
      unit: 'mes',
      ...group,
    })
  }

  // 2 — Variable fee (only if deliveryOrdersPerVenue > 0)
  const deliveryOrders = config.deliveryOrdersPerVenue ?? 0
  if (deliveryOrders > 0 && plan.variableFee > 0) {
    lines.push({
      id: newId(),
      type: 'line',
      description: `Cuota variable ROS`,
      quantity: deliveryOrders,
      unitPrice: plan.variableFee,
      amount: deliveryOrders * plan.variableFee,
      serviceId: `ros_${config.plan}_variable`,
      unit: 'pedidos',
      ...group,
    })
  }

  // 3 — Active add-ons (per-location ones only)
  for (const addonId of config.activeAddons) {
    // Skip consumption/GMV-based add-ons
    if (addonId === 'analytics_premium' || addonId === 'datafono') continue

    if (addonId === 'delivery_integrations') {
      const planKey = config.deliveryPlan ?? 'start'
      const dp = DELIVERY_PLANS[planKey]
      const periodNote = dp.unlimited
        ? `${dp.label} · Pedidos ilimitados`
        : `${dp.label} · ${dp.includedOrders} ped. incl. · ${dp.extraOrderFee.toFixed(2).replace('.', ',')}€/ped. adic.`
      lines.push({
        id: newId(),
        type: 'line',
        description: dp.label,
        quantity: 1,
        unitPrice: dp.priceMonthly,
        amount: dp.priceMonthly,
        serviceId: `addon_delivery_${planKey}`,
        unit: 'mes',
        period: periodNote,
        ...group,
      })
      continue
    }

    const addon = ADDONS[addonId]
    if (!addon.priceMonthly || addon.priceMonthly === 0) continue

    lines.push({
      id: newId(),
      type: 'line',
      description: addon.label,
      quantity: 1,
      unitPrice: addon.priceMonthly,
      amount: addon.priceMonthly,
      serviceId: `addon_${addonId}`,
      unit: 'mes',
      ...group,
    })
  }

  return lines
}
