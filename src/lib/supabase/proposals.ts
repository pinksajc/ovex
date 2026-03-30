// =========================================
// CRUD — proposals
// server-only
// One proposal per (deal, config) — unique(attio_deal_id, config_id).
// Each config version has its own proposal draft.
// =========================================

import { getSupabaseClient } from './client'
import type { ProposalRecord, ProposalSections } from '@/types'

// SQL migration:
//   ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sent_for_signature_at timestamptz;

interface ProposalRow {
  id: string
  attio_deal_id: string
  config_id: string
  sections: ProposalSections
  sent_for_signature_at: string | null
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
    sentForSignatureAt: row.sent_for_signature_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Returns the saved proposal for a specific (deal, config) pair, or null. */
export async function getProposalForDeal(
  attioDealId: string,
  configId: string
): Promise<ProposalRecord | null> {
  const { data, error } = await table()
    .select('*')
    .eq('attio_deal_id', attioDealId)
    .eq('config_id', configId)
    .maybeSingle()

  if (error) throw new Error(`Supabase getProposalForDeal: ${error.message}`)
  if (!data) return null
  return rowToRecord(data as ProposalRow)
}

/**
 * Returns the set of config_ids that have a saved proposal,
 * scoped to the given deal IDs. One query for all deals.
 */
export async function getConfigIdsWithProposals(
  dealIds: string[]
): Promise<Set<string>> {
  if (dealIds.length === 0) return new Set()

  const { data, error } = await table()
    .select('config_id')
    .in('attio_deal_id', dealIds)

  if (error) throw new Error(`Supabase getConfigIdsWithProposals: ${error.message}`)
  return new Set((data as { config_id: string }[]).map((r) => r.config_id))
}

/**
 * Sets sent_for_signature_at = now() on the proposal row.
 * Updates if exists; inserts a skeleton row if not yet created.
 */
export async function markProposalSentForSignature(
  attioDealId: string,
  configId: string
): Promise<void> {
  const now = new Date().toISOString()

  const { data: existing } = await table()
    .select('id')
    .eq('attio_deal_id', attioDealId)
    .eq('config_id', configId)
    .maybeSingle()

  if (existing) {
    await table()
      .update({ sent_for_signature_at: now, updated_at: now })
      .eq('id', (existing as { id: string }).id)
  } else {
    await table()
      .insert({
        attio_deal_id: attioDealId,
        config_id: configId,
        sections: { executiveSummary: '', solution: '', economicsSummary: '', nextSteps: '' },
        sent_for_signature_at: now,
        updated_at: now,
      })
  }
}

/**
 * Upserts the proposal for a (deal, config) pair.
 * unique constraint: (attio_deal_id, config_id)
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
    .upsert(row, { onConflict: 'attio_deal_id,config_id' })
    .select()
    .single()

  if (error) throw new Error(`Supabase upsertProposal: ${error.message}`)
  return rowToRecord(data as ProposalRow)
}
