// =========================================
// CRUD — company_locations
// server-only
// =========================================

import { getSupabaseClient } from './client'
import type { CompanyLocation, CreateLocationInput } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table() { return (getSupabaseClient() as any).from('company_locations') }

interface LocationRow {
  id: string
  deal_id: string
  name: string
  address: string | null
  cost_center: string | null
  created_at: string
}

function rowToLocation(row: LocationRow): CompanyLocation {
  return {
    id: row.id,
    dealId: row.deal_id,
    name: row.name,
    address: row.address,
    costCenter: row.cost_center,
    createdAt: row.created_at,
  }
}

export async function listLocationsByDeal(dealId: string): Promise<CompanyLocation[]> {
  const { data, error } = await table()
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`listLocationsByDeal: ${error.message}`)
  return ((data ?? []) as LocationRow[]).map(rowToLocation)
}

export async function getLocation(id: string): Promise<CompanyLocation | null> {
  const { data, error } = await table().select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`getLocation: ${error.message}`)
  if (!data) return null
  return rowToLocation(data as LocationRow)
}

export async function createLocation(input: CreateLocationInput): Promise<CompanyLocation> {
  const { data, error } = await table()
    .insert({
      deal_id: input.dealId,
      name: input.name.trim(),
      address: input.address?.trim() || null,
      cost_center: input.costCenter?.trim() || null,
    })
    .select()
    .single()
  if (error) throw new Error(`createLocation: ${error.message}`)
  return rowToLocation(data as LocationRow)
}

export async function updateLocation(
  id: string,
  input: Partial<Omit<CreateLocationInput, 'dealId'>>,
): Promise<CompanyLocation> {
  const patch: Record<string, string | null> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.address !== undefined) patch.address = input.address?.trim() || null
  if (input.costCenter !== undefined) patch.cost_center = input.costCenter?.trim() || null

  const { data, error } = await table().update(patch).eq('id', id).select().single()
  if (error) throw new Error(`updateLocation: ${error.message}`)
  return rowToLocation(data as LocationRow)
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await table().delete().eq('id', id)
  if (error) throw new Error(`deleteLocation: ${error.message}`)
}

/** Returns a Map<dealId, locationCount> for a batch of deal IDs. */
export async function getLocationCountsByDeal(dealIds: string[]): Promise<Map<string, number>> {
  if (dealIds.length === 0) return new Map()
  const { data, error } = await table()
    .select('deal_id')
    .in('deal_id', dealIds) as { data: { deal_id: string }[] | null; error: unknown }
  if (error) return new Map()
  const map = new Map<string, number>()
  for (const row of data ?? []) {
    map.set(row.deal_id, (map.get(row.deal_id) ?? 0) + 1)
  }
  return map
}
