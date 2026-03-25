// =========================================
// PRICING CATALOG
// Source: platomico.com/pricing
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
// ⚠️ review_manual: precios no publicados en platomico.com
// Rellenar con datos internos antes de usar en propuestas

export interface HardwareConfig {
  id: HardwareId
  label: string
  description: string
  reviewManual: true // siempre true hasta confirmar
}

export const HARDWARE: Record<HardwareId, HardwareConfig> = {
  terminal_pos: {
    id: 'terminal_pos',
    label: 'Terminal POS',
    description: 'Terminal táctil para TPV',
    reviewManual: true,
  },
  kds_screen: {
    id: 'kds_screen',
    label: 'Pantalla KDS',
    description: 'Pantalla cocina',
    reviewManual: true,
  },
  kiosk_unit: {
    id: 'kiosk_unit',
    label: 'Kiosk Completo',
    description: 'Kiosk self-ordering',
    reviewManual: true,
  },
  printer: {
    id: 'printer',
    label: 'Impresora',
    description: 'Impresora de tickets',
    reviewManual: true,
  },
  router: {
    id: 'router',
    label: 'Router / Red',
    description: 'Equipamiento de red',
    reviewManual: true,
  },
}

export const HARDWARE_ORDER: HardwareId[] = [
  'terminal_pos',
  'kds_screen',
  'kiosk_unit',
  'printer',
  'router',
]
