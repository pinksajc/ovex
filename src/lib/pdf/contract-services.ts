// Client-safe service detection for contracts.
// Kept separate from contract.ts (which is server-only — imports fs/puppeteer)
// so the "Generar contrato" button can reuse the same detection logic.

import type { InvoiceLineItem } from '@/types'
import { SERVICE_MAP } from '@/lib/invoice-catalog'

export type ServiceKey = 'ros' | 'posKiosk' | 'whispr' | 'analitica' | 'equipos' | 'ren'

export const SERVICE_KEYS: ServiceKey[] = ['ros', 'posKiosk', 'whispr', 'analitica', 'equipos', 'ren']

export function detectServices(
  items: InvoiceLineItem[],
  override?: Partial<Record<ServiceKey, boolean>>,
): Record<ServiceKey, boolean> {
  const detected: Record<ServiceKey, boolean> = {
    ros: false, posKiosk: false, whispr: false, analitica: false, equipos: false, ren: false,
  }
  for (const item of items) {
    if (item.type !== 'line') continue
    const id = item.serviceId ?? ''
    const group = id ? SERVICE_MAP.get(id)?.group : undefined
    if (group === 'ROS' || id.startsWith('ros')) detected.ros = true
    if (group === 'REN' || id === 'ren')         detected.ren = true
    if (group === 'WHISPR' || id.startsWith('whispr')) detected.whispr = true
    if (group === 'HARDWARE') detected.equipos = true
    if (id === 'addon_analytics') detected.analitica = true
    if (id === 'addon_kiosk' || id.includes('kiosk') || id.startsWith('bouncepad') || id.startsWith('counter_stand')) {
      detected.posKiosk = true
    }
  }
  // POS/Kiosk is implied whenever ROS is contracted (order & point-of-sale).
  if (detected.ros) detected.posKiosk = true

  if (override) {
    for (const k of SERVICE_KEYS) {
      if (typeof override[k] === 'boolean') detected[k] = override[k] as boolean
    }
  }
  return detected
}
