'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { calculateEconomics } from '@/lib/pricing/engine'
import { saveNewConfigVersion } from '@/lib/deals'
import { logEvent } from '@/lib/supabase/events'
import type { PlanTier, AddonId, HardwareLineItem } from '@/types'

export interface SaveVersionPayload {
  dealId: string
  dailyOrdersPerLocation: number
  deliveryOrdersPerVenue: number
  locations: number
  averageTicket: number
  plan: PlanTier
  planOverridden: boolean
  activeAddons: AddonId[]
  hardware: HardwareLineItem[]
  discountPercent: number
  renEnabled: boolean
  renFeePerOrder: number
  renVenues: number
  kdsVenues: number
  kioskVenues: number
  calculateVariable?: boolean
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
    const economics = {
      ...calculateEconomics({
        dailyOrdersPerLocation: payload.dailyOrdersPerLocation,
        locations: payload.locations,
        averageTicket: payload.averageTicket,
        plan: payload.plan,
        activeAddons: payload.activeAddons,
        hardware: payload.hardware,
      }),
      deliveryOrdersPerVenue: payload.deliveryOrdersPerVenue,
      discountPercent: payload.discountPercent,
      renEnabled: payload.renEnabled,
      renFeePerOrder: payload.renFeePerOrder,
      renVenues: payload.renVenues,
      kdsVenues: payload.kdsVenues,
      kioskVenues: payload.kioskVenues,
      calculateVariable: payload.calculateVariable ?? false,
    }

    const result = await saveNewConfigVersion(payload.dealId, {
      label: payload.label,
      dailyOrdersPerLocation: payload.dailyOrdersPerLocation,
      deliveryOrdersPerVenue: payload.deliveryOrdersPerVenue,
      discountPercent: payload.discountPercent,
      renEnabled: payload.renEnabled,
      renFeePerOrder: payload.renFeePerOrder,
      renVenues: payload.renVenues,
      kdsVenues: payload.kdsVenues,
      kioskVenues: payload.kioskVenues,
      calculateVariable: payload.calculateVariable ?? false,
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
    revalidateTag('attio-deals', 'max')
    revalidatePath(`/deals/${payload.dealId}/configurador`)
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
