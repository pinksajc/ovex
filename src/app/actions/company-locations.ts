'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import {
  listLocationsByDeal,
  createLocation,
  updateLocation,
  deleteLocation,
} from '@/lib/supabase/company-locations'
import type { CompanyLocation, CreateLocationInput } from '@/types'

export type { CompanyLocation }

interface ActionResult { ok: boolean; error?: string }

export async function listLocationsAction(
  dealId: string,
): Promise<{ ok: boolean; data?: CompanyLocation[]; error?: string }> {
  try {
    await requireAuth()
    if (!dealId) return { ok: true, data: [] }
    const data = await listLocationsByDeal(dealId)
    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[listLocationsAction] error:', msg, { dealId })
    return { ok: false, error: msg }
  }
}

export async function createLocationAction(
  input: CreateLocationInput,
): Promise<{ ok: boolean; data?: CompanyLocation; error?: string }> {
  try {
    await requireAuth()

    // Validate required fields before hitting the DB
    if (!input.dealId || !input.dealId.trim()) {
      return { ok: false, error: 'deal_id es obligatorio' }
    }
    if (!input.name || !input.name.trim()) {
      return { ok: false, error: 'El nombre es obligatorio' }
    }

    const data = await createLocation(input)
    revalidatePath(`/deals/${input.dealId}`)
    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[createLocationAction] error:', msg, { dealId: input.dealId, name: input.name })
    return { ok: false, error: msg }
  }
}

export async function updateLocationAction(
  id: string,
  dealId: string,
  input: Partial<Omit<CreateLocationInput, 'dealId'>>,
): Promise<ActionResult> {
  try {
    await requireAuth()
    await updateLocation(id, input)
    revalidatePath(`/deals/${dealId}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

export async function deleteLocationAction(
  id: string,
  dealId: string,
): Promise<ActionResult> {
  try {
    await requireAuth()
    await deleteLocation(id)
    revalidatePath(`/deals/${dealId}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}
