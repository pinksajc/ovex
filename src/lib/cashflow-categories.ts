// Shared cashflow category list — imported by both server actions and client components.
// No 'use server' / 'use client' directives so this module is usable anywhere.

export const CASHFLOW_CATEGORIES = [
  'Sin categoría',
  'Ingreso cliente',
  'Nómina',
  'Hardware',
  'Administrativo',
  'Impuestos',
  'Préstamos',
  'Oficina',
  'Viajes',
  'Servidores/Hosting',
  'Base de datos',
  'Herramientas IA',
  'Comunicaciones',
  'Marketing',
  'Otras herramientas',
  'Traspaso interno',
  'Refunds',
  'Otros',
] as const

export type CashflowCategory = (typeof CASHFLOW_CATEGORIES)[number]

/** Categories shown in the Claude categorisation prompt (excludes "Sin categoría") */
export const CATEGORIZABLE = CASHFLOW_CATEGORIES.filter(
  (c) => c !== 'Sin categoría',
) as readonly string[]
