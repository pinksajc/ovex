'use server'

import { calculateEconomics } from '@/lib/pricing/engine'
import { saveNewConfigVersion } from '@/lib/deals'
import { logEvent } from '@/lib/supabase/events'
import type { PlanTier, AddonId, HardwareLineItem } from '@/types'

export interface SaveVersionPayload {
  dealId: string
  dailyOrdersPerLocation: number
  locations: number
  averageTicket: number
  plan: PlanTier
  planOverridden: boolean
  activeAddons: AddonId[]
  hardware: HardwareLineItem[]
  label?: string
}

export interface SaveVersionResult {
  ok: boolean
  version?: number
  configId?: string
  persisted: boolean
  error?: string
}

export async function saveNewVersionAction(
  payload: SaveVersionPayload
): Promise<SaveVersionResult> {
  try {
    const economics = calculateEconomics({
      dailyOrdersPerLocation: payload.dailyOrdersPerLocation,
      locations: payload.locations,
      averageTicket: payload.averageTicket,
      plan: payload.plan,
      activeAddons: payload.activeAddons,
      hardware: payload.hardware,
    })

    const result = await saveNewConfigVersion(payload.dealId, {
      label: payload.label,
      dailyOrdersPerLocation: payload.dailyOrdersPerLocation,
      locations: payload.locations,
      averageTicket: payload.averageTicket,
      estimatedGrowthPercent: 0,
      plan: payload.plan,
      planOverridden: payload.planOverridden,
      activeAddons: payload.activeAddons,
      hardware: payload.hardware,
      economics,
    })

    void logEvent('config_saved', payload.dealId)
    return {
      ok: true,
      version: result.config.version,
      configId: result.config.id,
      persisted: result.persisted,
    }
  } catch (err) {
    return {
      ok: false,
      persisted: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}
