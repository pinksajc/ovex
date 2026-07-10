// =========================================
// DEAL TYPE DETECTION
// Derives Fijo / Variable / Mixto from line_items
// =========================================

import type { InvoiceLineItem } from '@/types'

export type DealType = 'fixed' | 'variable' | 'mixed'

/**
 * Service IDs that represent per-order (variable) fees.
 * Source: invoice-catalog.ts — unit: 'pedidos' or '% GMV'
 */
export const VARIABLE_IDS = new Set([
  'ros_starter_variable',
  'ros_growth_variable',
  'ros_pro_variable',
  'ren',
  'addon_delivery_adic_start',
  'addon_delivery_adic_go',
  'addon_delivery_adic_pro',
  'datafono',
])

/**
 * Subset of VARIABLE_IDS that represent optional overage fees (only charged
 * when a delivery volume threshold is exceeded). These are NOT shown as
 * "+ variable" in the pipeline — they are conditional, not structural.
 */
export const OVERAGE_IDS = new Set([
  'addon_delivery_adic_start',
  'addon_delivery_adic_go',
  'addon_delivery_adic_pro',
  'datafono',
])

/**
 * True variable IDs: per-order fees that are a core structural part of pricing.
 * Only these trigger the "+ variable" indicator in the pipeline.
 */
export const CORE_VARIABLE_IDS = new Set([
  'ros_starter_variable',
  'ros_growth_variable',
  'ros_pro_variable',
  'ren',
])

/**
 * Service IDs that should be excluded from classification
 * (one-off travel costs, fully custom lines with no inherent nature).
 */
export const IGNORE_IDS = new Set(['travel', 'custom'])

/**
 * Derives the deal type from a presupuesto's line items.
 * Returns null when there are no classifiable service lines
 * (e.g. only custom lines or no lines at all).
 */
export function detectDealType(lineItems: InvoiceLineItem[]): DealType | null {
  const relevant = lineItems.filter(
    (l) => l.type === 'line' && l.serviceId && !IGNORE_IDS.has(l.serviceId),
  )
  if (relevant.length === 0) return null

  const hasFixed    = relevant.some((l) => !VARIABLE_IDS.has(l.serviceId!))
  const hasVariable = relevant.some((l) =>  VARIABLE_IDS.has(l.serviceId!))

  if (hasFixed && hasVariable) return 'mixed'
  if (hasVariable) return 'variable'
  return 'fixed'
}

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  fixed:    'Fijo',
  variable: 'Variable',
  mixed:    'Mixto',
}

export const DEAL_TYPE_COLORS: Record<DealType, string> = {
  fixed:    'bg-blue-50 text-blue-700',
  variable: 'bg-orange-50 text-orange-700',
  mixed:    'bg-violet-50 text-violet-700',
}
