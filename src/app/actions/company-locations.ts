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
    const data = await listLocationsByDeal(dealId)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

export async function createLocationAction(
  input: CreateLocationInput,
): Promise<{ ok: boolean; data?: CompanyLocation; error?: string }> {
  try {
    await requireAuth()
    const data = await createLocation(input)
    revalidatePath(`/deals/${input.dealId}`)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
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
