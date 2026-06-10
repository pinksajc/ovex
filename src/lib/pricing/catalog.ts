// =========================================
// PRICING CATALOG
// Source: platomico.com/pricing + internal hardware data
// =========================================

import type { PlanTier, AddonId, HardwareId, DeliveryPlanId } from '@/types'

// ---- PLANS ----

export interface PlanConfig {
  tier: PlanTier
  label: string
  description: string
  volumeRange: { min: number; max: number } // pedidos/día/local
  priceMonthly: number                       // € fijo por local
  variableFee: number                        // € por pedido
  highlight?: boolean
  noVariableFee?: boolean                    // true → no variable fee (Elite)
  deliveryIncludedPrice?: number             // € fijo por local/mes cuando delivery incluido (Elite)
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
    volumeRange: { min: 1001, max: 5000 },
    priceMonthly: 35,
    variableFee: 0.03,
  },
  elite: {
    tier: 'elite',
    label: 'Elite',
    description: 'Cobertura total Orvex',
    volumeRange: { min: 5001, max: Infinity },
    priceMonthly: 299,
    variableFee: 0,
    noVariableFee: true,
    deliveryIncludedPrice: 349,
    highlight: true,
  },
}

export const PLAN_ORDER: PlanTier[] = ['starter', 'growth', 'pro', 'elite']

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
    label: 'KDS — Pantalla de cocina',
    description: 'Software + tablet 10" incluida',
    priceMonthly: 19,
    perLocation: true,
  },
  kiosk: {
    id: 'kiosk',
    label: 'Kiosk autoservicio',
    description: 'Software + Bouncepad + tablet incluida',
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
    label: 'Integración delivery',
    description: 'Order Hub · Glovo, Uber Eats, Just Eat...',
    priceMonthly: 0,   // pricing comes from selected sub-plan (DELIVERY_PLANS)
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

// ---- DELIVERY SUB-PLANS (Order Hub) ----

export interface DeliveryPlanConfig {
  id: DeliveryPlanId
  label: string
  priceMonthly: number       // € fijo por local/mes
  includedOrders: number     // pedidos incluidos por local/mes (use Infinity for unlimited)
  extraOrderFee: number      // € por pedido adicional (variable); 0 when unlimited
  /** true = pedidos ilimitados, no excess fee applies */
  unlimited?: boolean
}

export const DELIVERY_PLANS: Record<DeliveryPlanId, DeliveryPlanConfig> = {
  start: {
    id: 'start',
    label: 'Order Hub Start',
    priceMonthly: 29,
    includedOrders: 200,
    extraOrderFee: 0.30,
  },
  go: {
    id: 'go',
    label: 'Order Hub Go',
    priceMonthly: 69,
    includedOrders: 650,
    extraOrderFee: 0.25,
  },
  pro: {
    id: 'pro',
    label: 'Order Hub Pro',
    priceMonthly: 119,
    includedOrders: 1250,
    extraOrderFee: 0.15,
  },
  enterprise: {
    id: 'enterprise',
    label: 'Order Hub Enterprise',
    priceMonthly: 169,
    includedOrders: Infinity,
    extraOrderFee: 0,
    unlimited: true,
  },
}

export const DELIVERY_PLAN_ORDER: DeliveryPlanId[] = ['start', 'go', 'pro', 'enterprise']

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
  rentalMonthlyPrice?: number  // override for RENTAL_MONTHLY_PRICE when mode=rented
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
    rentalMonthlyPrice: 9,
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

/** Fixed monthly rental price per unit (€/unit/month). */
export const RENTAL_MONTHLY_PRICE = 19

export const HARDWARE_MODE_LABELS: Record<import('@/types').HardwareMode, string> = {
  included: 'Incluido',
  sold: 'Vendido',
  financed: 'Financiado',
  rented: 'Alquiler',
}

// ---- PLAN FEATURES ----
// Software features included per plan, displayed in simulator and PDF.
// Listed in cumulative order (Growth = Starter + extras, Pro = Growth + extras).

export const PLAN_FEATURES: Record<PlanTier, string[]> = {
  starter: [
    'Register',
    'KDS',
    'Analytics Basic',
    'Soporte email L-V 9-18h',
  ],
  growth: [
    'Register',
    'KDS',
    'Analytics Basic',
    'Web y pedidos online',
    'Kiosk',
    'Soporte email L-V 9-23h',
  ],
  pro: [
    'Register',
    'KDS',
    'Analytics Basic',
    'Web y pedidos online',
    'Kiosk',
    'Fidelización (Loyalty)',
    'Analytics Premium',
    'Customer Success Manager',
    'SLA garantizado',
    'Teléfono + WhatsApp 24/7',
    'CSM dedicado',
  ],
  elite: [
    'Register',
    'KDS',
    'Analytics Basic',
    'Web y pedidos online',
    'Kiosk',
    'Fidelización (Loyalty)',
    'Analytics Premium',
    'Customer Success Manager',
    'SLA garantizado 99,99 %',
    'Teléfono + WhatsApp 24/7',
    'CSM dedicado',
    'Stock',
    'Sin tarifa variable',
    'Onboarding presencial',
    'Delivery incluido (opcional)',
  ],
}

// ---- WHISPR ----

export type WhisprPlanId = 'none' | 'starter' | 'professional' | 'enterprise'

export interface WhisprPlanConfig {
  id: WhisprPlanId
  label: string
  description: string
  priceMonthly: number  // 0 for enterprise (custom)
  features: string[]
}

export const WHISPR_PLANS: Record<WhisprPlanId, WhisprPlanConfig> = {
  none: { id: 'none', label: 'Ninguno', description: '', priceMonthly: 0, features: [] },
  starter: {
    id: 'starter',
    label: 'Starter',
    description: 'Hasta 50 empleados',
    priceMonthly: 49,
    features: ['Canal de quejas con marca propia', 'Chat cifrado bidireccional', 'Control de plazos automático', 'Soporte email'],
  },
  professional: {
    id: 'professional',
    label: 'Professional',
    description: 'Hasta 250 empleados',
    priceMonthly: 99,
    features: ['Todo lo de Starter', 'Múltiples gestores y roles', 'Matriz de acceso por departamento', 'Notificaciones email', 'Soporte prioritario'],
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    description: 'Empleados ilimitados',
    priceMonthly: 0, // custom price
    features: ['Multi-establecimiento', 'Integraciones personalizadas', 'Gestor dedicado', 'SLA garantizado'],
  },
}

export const WHISPR_PLAN_ORDER: WhisprPlanId[] = ['none', 'starter', 'professional', 'enterprise']
export const WHISPR_ANNUAL_DISCOUNT = 0.20
