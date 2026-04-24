'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { calculateEconomics } from '@/lib/pricing/engine'
import { DELIVERY_PLANS } from '@/lib/pricing/catalog'
import { saveActiveConfig } from '@/lib/deals'
import { logEvent } from '@/lib/supabase/events'
import type { PlanTier, AddonId, HardwareLineItem, DealConfiguration, DealEconomics, DeliveryPlanId } from '@/types'

type SaveActiveConfigPayload = Omit<DealConfiguration, 'dealId'> & {
  calculateVariable?: boolean
  economics: DealEconomics & { calculateVariable?: boolean }
}

export interface SaveConfigPayload {
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
  discountName?: string
  deliveryPlan?: DeliveryPlanId
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
      discountName: payload.discountName ?? '',
      // Delivery sub-plan — canonical persisted fields (read by PDF & preview)
      deliveryPlan: payload.deliveryPlan ?? 'start',                     // backward compat
      deliveryPlanKey: payload.deliveryPlan ?? 'start',
      deliveryFixedFee: DELIVERY_PLANS[payload.deliveryPlan ?? 'start'].priceMonthly,  // per local
      deliveryFixedMonthly: payload.activeAddons.includes('delivery_integrations')     // backward compat
        ? DELIVERY_PLANS[payload.deliveryPlan ?? 'start'].priceMonthly * payload.locations
        : 0,
      deliveryExtraFeePerOrder: DELIVERY_PLANS[payload.deliveryPlan ?? 'start'].extraOrderFee,
      deliveryIncludedOrders: DELIVERY_PLANS[payload.deliveryPlan ?? 'start'].includedOrders,
    }

    // Fetch current active config to reuse its id/version (avoids always writing v1)
    const { getActiveConfigForDeal } = await import('@/lib/supabase/configs')
    const existing = await getActiveConfigForDeal(payload.dealId).catch(() => undefined)

    const result = await saveActiveConfig(payload.dealId, ({
      id: existing?.id ?? `${payload.dealId}-v1`,
      version: existing?.version ?? 1,
      dailyOrdersPerLocation: payload.dailyOrdersPerLocation,
      deliveryOrdersPerVenue: payload.deliveryOrdersPerVenue,
      discountPercent: payload.discountPercent,
      renEnabled: payload.renEnabled,
      renFeePerOrder: payload.renFeePerOrder,
      renVenues: payload.renVenues,
      kdsVenues: payload.kdsVenues,
      kioskVenues: payload.kioskVenues,
      calculateVariable: payload.calculateVariable ?? false,
      discountName: payload.discountName ?? '',
      deliveryPlan: payload.deliveryPlan ?? 'start',
      locations: payload.locations,
      averageTicket: payload.averageTicket,
      estimatedGrowthPercent: 0,
      plan: payload.plan,
      planOverridden: payload.planOverridden,
      activeAddons: payload.activeAddons,
      hardware: payload.hardware,
      economics,
      createdAt: new Date().toISOString(),
    }) as SaveActiveConfigPayload)

    void logEvent('config_saved', payload.dealId)
    revalidateTag('attio-deals', 'max')
    revalidatePath(`/deals/${payload.dealId}/configurador`)
    return { ok: true, persisted: result.persisted }
  } catch (err) {
    return {
      ok: false,
      persisted: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}
