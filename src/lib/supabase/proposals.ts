// =========================================
// CRUD — proposals
// server-only
// One proposal per deal (upsert on attio_deal_id).
// config_id is updated on each save to reflect
// which config version was current at save time.
// =========================================

import { getSupabaseClient } from './client'
import type { ProposalRecord, ProposalSections } from '@/types'

interface ProposalRow {
  id: string
  attio_deal_id: string
  config_id: string
  sections: ProposalSections
  created_at: string
  updated_at: string
}

function table() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getSupabaseClient().from('proposals') as any
}

function rowToRecord(row: ProposalRow): ProposalRecord {
  return {
    id: row.id,
    attioDealId: row.attio_deal_id,
    configId: row.config_id,
    sections: row.sections,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Returns the saved proposal for a deal, or null if none exists. */
export async function getProposalForDeal(
  attioDealId: string
): Promise<ProposalRecord | null> {
  const { data, error } = await table()
    .select('*')
    .eq('attio_deal_id', attioDealId)
    .maybeSingle()

  if (error) throw new Error(`Supabase getProposalForDeal: ${error.message}`)
  if (!data) return null
  return rowToRecord(data as ProposalRow)
}

/**
 * Upserts the proposal for a deal.
 * Uses attio_deal_id as the unique key (one proposal per deal).
 * Updates config_id and sections; bumps updated_at.
 */
export async function upsertProposal(
  attioDealId: string,
  configId: string,
  sections: ProposalSections
): Promise<ProposalRecord> {
  const row = {
    attio_deal_id: attioDealId,
    config_id: configId,
    sections,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await table()
    .upsert(row, { onConflict: 'attio_deal_id' })
    .select()
    .single()

  if (error) throw new Error(`Supabase upsertProposal: ${error.message}`)
  return rowToRecord(data as ProposalRow)
}
