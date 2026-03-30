'use server'

import { calculateEconomics } from '@/lib/pricing/engine'
import { saveActiveConfig } from '@/lib/deals'
import { logEvent } from '@/lib/supabase/events'
import type { PlanTier, AddonId, HardwareLineItem } from '@/types'

export interface SaveConfigPayload {
  dealId: string
  dailyOrdersPerLocation: number
  locations: number
  averageTicket: number
  plan: PlanTier
  planOverridden: boolean
  activeAddons: AddonId[]
  hardware: HardwareLineItem[]
}

export interface SaveConfigResult {
  ok: boolean
  persisted: boolean
  error?: string
}

export async function saveConfigAction(
  payload: SaveConfigPayload
): Promise<SaveConfigResult> {
  try {
    const economics = calculateEconomics({
      dailyOrdersPerLocation: payload.dailyOrdersPerLocation,
      locations: payload.locations,
      averageTicket: payload.averageTicket,
      plan: payload.plan,
      activeAddons: payload.activeAddons,
      hardware: payload.hardware,
    })

    const result = await saveActiveConfig(payload.dealId, {
      id: `${payload.dealId}-v1`,
      version: 1,
      dailyOrdersPerLocation: payload.dailyOrdersPerLocation,
      locations: payload.locations,
      averageTicket: payload.averageTicket,
      estimatedGrowthPercent: 0,
      plan: payload.plan,
      planOverridden: payload.planOverridden,
      activeAddons: payload.activeAddons,
      hardware: payload.hardware,
      economics,
      createdAt: new Date().toISOString(),
    })

    void logEvent('config_saved', payload.dealId)
    return { ok: true, persisted: result.persisted }
  } catch (err) {
    return {
      ok: false,
      persisted: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}
