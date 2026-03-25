// =========================================
// PRICING CATALOG
// Source: platomico.com/pricing + internal hardware data
// =========================================

import type { PlanTier, AddonId, HardwareId } from '@/types'

// ---- PLANS ----

export interface PlanConfig {
  tier: PlanTier
  label: string
  description: string
  volumeRange: { min: number; max: number } // pedidos/día/local
  priceMonthly: number                       // € fijo por local
  variableFee: number                        // € por pedido
  highlight?: boolean
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  starter: {
    tier: 'starter',
    label: 'Starter',
    description: 'Hasta 120 pedidos/día',
    volumeRange: { min: 0, max: 120 },
    priceMonthly: 0,
    variableFee: 0.05,
  },
  growth: {
    tier: 'growth',
    label: 'Growth',
    description: '121–500 pedidos/día',
    volumeRange: { min: 121, max: 500 },
    priceMonthly: 149,
    variableFee: 0.02,
    highlight: true,
  },
  pro: {
    tier: 'pro',
    label: 'Pro',
    description: 'Más de 500 pedidos/día',
    volumeRange: { min: 501, max: Infinity },
    priceMonthly: 299,
    variableFee: 0,
  },
}

export const PLAN_ORDER: PlanTier[] = ['starter', 'growth', 'pro']

// ---- ADD-ONS ----

export interface AddonConfig {
  id: AddonId
  label: string
  description: string
  priceMonthly?: number   // € por local/mes (o plano)
  feePercent?: number     // % de GMV (solo datafono)
  perLocation: boolean
}

export const ADDONS: Record<AddonId, AddonConfig> = {
  kds: {
    id: 'kds',
    label: 'KDS',
    description: 'Kitchen Display System',
    priceMonthly: 19,
    perLocation: true,
  },
  kiosk: {
    id: 'kiosk',
    label: 'Kiosk',
    description: 'Self-ordering kiosk',
    priceMonthly: 39,
    perLocation: true,
  },
  loyalty: {
    id: 'loyalty',
    label: 'Loyalty',
    description: 'Programa de fidelización',
    priceMonthly: 29,
    perLocation: true,
  },
  analytics_premium: {
    id: 'analytics_premium',
    label: 'Analytics Premium',
    description: 'Analítica avanzada',
    priceMonthly: 49,
    perLocation: false, // nivel cuenta, no por local
  },
  delivery_integrations: {
    id: 'delivery_integrations',
    label: 'Delivery Integrations',
    description: 'Glovo, Uber Eats, Just Eat...',
    priceMonthly: 25,
    perLocation: true,
  },
  datafono: {
    id: 'datafono',
    label: 'Datáfono',
    description: '0.8% sobre GMV procesado',
    feePercent: 0.8,
    perLocation: false, // % del GMV total
  },
}

export const ADDON_ORDER: AddonId[] = [
  'kds',
  'kiosk',
  'loyalty',
  'analytics_premium',
  'delivery_integrations',
  'datafono',
]

// ---- HARDWARE ----
// Precios reales confirmados.
// unitCost = coste interno (Platomico)
// unitPrice = precio venta al cliente
// perLocation = true → default qty = nº de locales

export interface HardwareConfig {
  id: HardwareId
  label: string
  description: string
  unitCost: number    // € — coste interno Platomico
  unitPrice: number   // € — precio venta cliente
  perLocation: boolean
}

export const HARDWARE: Record<HardwareId, HardwareConfig> = {
  ipad: {
    id: 'ipad',
    label: 'iPad 10th Gen',
    description: 'Terminal POS táctil',
    unitCost: 399,
    unitPrice: 399,
    perLocation: true,
  },
  bouncepad_kiosk: {
    id: 'bouncepad_kiosk',
    label: 'Bouncepad Kiosk',
    description: 'Soporte self-ordering kiosk',
    unitCost: 200,
    unitPrice: 200,
    perLocation: false,
  },
  counter_stand: {
    id: 'counter_stand',
    label: 'Counter Stand',
    description: 'Soporte para mostrador',
    unitCost: 120,
    unitPrice: 120,
    perLocation: true,
  },
}

export const HARDWARE_ORDER: HardwareId[] = [
  'ipad',
  'bouncepad_kiosk',
  'counter_stand',
]

export const HARDWARE_MODE_LABELS: Record<import('@/types').HardwareMode, string> = {
  included: 'Incluido',
  sold: 'Vendido',
  financed: 'Financiado',
}
