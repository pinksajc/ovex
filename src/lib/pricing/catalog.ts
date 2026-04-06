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
    description: 'Hasta 500 tickets/mes',
    volumeRange: { min: 0, max: 500 },
    priceMonthly: 0,
    variableFee: 0.08,
  },
  growth: {
    tier: 'growth',
    label: 'Growth',
    description: '501–1.000 tickets/mes',
    volumeRange: { min: 501, max: 1000 },
    priceMonthly: 15,
    variableFee: 0.05,
    highlight: true,
  },
  pro: {
    tier: 'pro',
    label: 'Pro',
    description: 'Más de 1.000 tickets/mes',
    volumeRange: { min: 1001, max: Infinity },
    priceMonthly: 35,
    variableFee: 0.03,
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
  perConsumption?: boolean  // true → precio variable, no fijo (mostrar "por consumo")
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
    priceMonthly: 19,
    perLocation: true,
  },
  stock: {
    id: 'stock',
    label: 'Stock',
    description: 'Gestión de inventario',
    priceMonthly: 9,
    perLocation: true,
  },
  analytics_premium: {
    id: 'analytics_premium',
    label: 'Analítica IA',
    description: 'Por consumo',
    priceMonthly: 0,
    perLocation: false,
    perConsumption: true,
  },
  delivery_integrations: {
    id: 'delivery_integrations',
    label: 'Delivery',
    description: 'Glovo, Uber Eats, Just Eat...',
    priceMonthly: 45,
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
  'stock',
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
  tablet_lenovo_m11: {
    id: 'tablet_lenovo_m11',
    label: 'Tablet Lenovo M11',
    description: 'Terminal POS táctil',
    unitCost: 218,
    unitPrice: 218,
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
  'tablet_lenovo_m11',
  'bouncepad_kiosk',
  'counter_stand',
]

export const HARDWARE_MODE_LABELS: Record<import('@/types').HardwareMode, string> = {
  included: 'Incluido',
  sold: 'Vendido',
  financed: 'Financiado',
}
