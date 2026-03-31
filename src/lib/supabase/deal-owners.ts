// =========================================
// DEAL OWNERSHIP
// Maps attio_deal_id → owner_id (auth.users UUID)
// Using service role — no RLS needed.
// =========================================

import { getSupabaseClient } from './client'

/** Returns map of attio_deal_id → owner_id for the given deals. */
export async function getDealOwnerMap(dealIds: string[]): Promise<Map<string, string>> {
  if (dealIds.length === 0) return new Map()
  const db = getSupabaseClient()
  type Row = { attio_deal_id: string; owner_id: string }
  const { data } = await db
    .from('deal_owners')
    .select('attio_deal_id, owner_id')
    .in('attio_deal_id', dealIds) as { data: Row[] | null; error: unknown }

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.attio_deal_id, row.owner_id)
  }
  return map
}

/** Assign (or reassign) a deal to an owner. */
export async function setDealOwner(
  attioDealId: string,
  ownerId: string,
  assignedBy: string
): Promise<void> {
  const db = getSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from('deal_owners') as any).upsert({
    attio_deal_id: attioDealId,
    owner_id: ownerId,
    assigned_at: new Date().toISOString(),
    assigned_by: assignedBy,
  })
}
