// =========================================
// SERVICE CATALOG — Invoice line items
// =========================================

export interface ServiceItem {
  id: string
  label: string
  group: 'ROS' | 'ADD-ONS' | 'REN' | 'HARDWARE' | 'OTROS'
  unit: string
  unitEditable?: boolean   // true → unit label is free-text
  defaultPrice: number
  priceEditable?: boolean  // true → price field highlighted (user must fill)
  note?: string            // shown next to the service name in dropdown
  custom?: true            // "Línea personalizada" — fully free text
}

export const SERVICES: ServiceItem[] = [
  // ---- ROS ----
  {
    id: 'ros_starter',
    label: 'ROS Plan Starter',
    group: 'ROS',
    unit: 'local/mes',
    defaultPrice: 0,
    priceEditable: true,
    note: '+ 0,08€/ticket variable',
  },
  {
    id: 'ros_growth',
    label: 'ROS Plan Growth',
    group: 'ROS',
    unit: 'local/mes',
    defaultPrice: 15,
    note: '+ 0,05€/ticket variable',
  },
  {
    id: 'ros_pro',
    label: 'ROS Plan Pro',
    group: 'ROS',
    unit: 'local/mes',
    defaultPrice: 35,
    note: '+ 0,03€/ticket variable',
  },

  // ---- ADD-ONS ----
  { id: 'addon_delivery', label: 'Add-on Delivery', group: 'ADD-ONS', unit: 'local/mes', defaultPrice: 45 },
  { id: 'addon_stock', label: 'Add-on Stock', group: 'ADD-ONS', unit: 'local/mes', defaultPrice: 9 },
  { id: 'addon_kds', label: 'Add-on KDS', group: 'ADD-ONS', unit: 'local/mes', defaultPrice: 19 },
  { id: 'addon_kiosk', label: 'Add-on Kiosk autoservicio', group: 'ADD-ONS', unit: 'local/mes', defaultPrice: 19 },
  {
    id: 'addon_analytics',
    label: 'Add-on Analítica IA',
    group: 'ADD-ONS',
    unit: 'consumo',
    defaultPrice: 0,
    priceEditable: true,
  },
  {
    id: 'datafono',
    label: 'Datáfono',
    group: 'ADD-ONS',
    unit: '% GMV',
    defaultPrice: 0,
    priceEditable: true,
    note: '0,8%',
  },

  // ---- REN ----
  {
    id: 'ren',
    label: 'REN — Marketplace logístico',
    group: 'REN',
    unit: 'pedido',
    defaultPrice: 0.10,
  },

  // ---- HARDWARE ----
  { id: 'ipad_rental', label: 'iPad 10th Gen — Alquiler', group: 'HARDWARE', unit: 'ud/mes', defaultPrice: 19 },
  { id: 'ipad_financed', label: 'iPad 10th Gen — Financiado', group: 'HARDWARE', unit: 'ud/mes', defaultPrice: 0, priceEditable: true },
  { id: 'ipad_sold', label: 'iPad 10th Gen — Vendido', group: 'HARDWARE', unit: 'ud', defaultPrice: 0, priceEditable: true },
  { id: 'lenovo_rental', label: 'Tablet Lenovo M11 — Alquiler', group: 'HARDWARE', unit: 'ud/mes', defaultPrice: 9 },
  { id: 'lenovo_financed', label: 'Tablet Lenovo M11 — Financiado', group: 'HARDWARE', unit: 'ud/mes', defaultPrice: 0, priceEditable: true },
  { id: 'lenovo_sold', label: 'Tablet Lenovo M11 — Vendido', group: 'HARDWARE', unit: 'ud', defaultPrice: 0, priceEditable: true },
  { id: 'bouncepad', label: 'Bouncepad Kiosk — Vendido', group: 'HARDWARE', unit: 'ud', defaultPrice: 200 },
  { id: 'counter_stand', label: 'Counter Stand — Vendido', group: 'HARDWARE', unit: 'ud', defaultPrice: 120 },

  // ---- OTROS ----
  { id: 'travel', label: 'Desplazamientos y dietas', group: 'OTROS', unit: 'ud', defaultPrice: 0, priceEditable: true },
  { id: 'custom', label: 'Línea personalizada', group: 'OTROS', unit: '', unitEditable: true, defaultPrice: 0, priceEditable: true, custom: true },
]

export const SERVICE_MAP = new Map<string, ServiceItem>(SERVICES.map((s) => [s.id, s]))

export const SERVICE_GROUPS = ['ROS', 'ADD-ONS', 'REN', 'HARDWARE', 'OTROS'] as const
export type ServiceGroup = (typeof SERVICE_GROUPS)[number]
