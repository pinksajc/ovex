// =========================================
// CRUD — proposals
// server-only
// One proposal per (deal, config) — unique(attio_deal_id, config_id).
// Each config version has its own proposal draft.
// =========================================

import { getSupabaseClient } from './client'
import type { DocuSealStatus, ProposalRecord, ProposalSections, ProposalSummary } from '@/types'

// SQL migrations (run once in Supabase):
//   ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sent_for_signature_at timestamptz;
//   ALTER TABLE proposals ADD COLUMN IF NOT EXISTS docuseal_submission_id text;
//   ALTER TABLE proposals ADD COLUMN IF NOT EXISTS docuseal_status text;
//   ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signed_at timestamptz;

interface ProposalRow {
  id: string
  attio_deal_id: string
  config_id: string
  sections: ProposalSections
  sent_for_signature_at: string | null
  docuseal_submission_id: string | null
  docuseal_status: DocuSealStatus
  signed_at: string | null
  created_at: string
  updated_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table() { return getSupabaseClient().from('proposals') as any }

function rowToRecord(row: ProposalRow): ProposalRecord {
  return {
    id: row.id,
    attioDealId: row.attio_deal_id,
    configId: row.config_id,
    sections: row.sections,
    sentForSignatureAt: row.sent_for_signature_at ?? null,
    docusealSubmissionId: row.docuseal_submission_id ?? null,
    docusealStatus: row.docuseal_status ?? null,
    signedAt: row.signed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---- Reads ----

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

/** Returns config_ids that have a saved proposal (backward compat). */
export async function getConfigIdsWithProposals(dealIds: string[]): Promise<Set<string>> {
  if (dealIds.length === 0) return new Set()
  const { data, error } = await table().select('config_id').in('attio_deal_id', dealIds)
  if (error) throw new Error(`Supabase getConfigIdsWithProposals: ${error.message}`)
  return new Set((data as { config_id: string }[]).map((r) => r.config_id))
}

/**
 * Returns map of configId → ProposalSummary for batch status enrichment.
 * Called by enrichWithCommercialStatus() once per getDeals() call.
 */
export async function getProposalSummariesForDeals(
  dealIds: string[]
): Promise<Map<string, ProposalSummary>> {
  const result = new Map<string, ProposalSummary>()
  if (dealIds.length === 0) return result

  const { data, error } = await table()
    .select('config_id, sent_for_signature_at, docuseal_status, signed_at')
    .in('attio_deal_id', dealIds)
  if (error) throw new Error(`Supabase getProposalSummariesForDeals: ${error.message}`)

  type SummaryRow = Pick<ProposalRow, 'config_id' | 'sent_for_signature_at' | 'docuseal_status' | 'signed_at'>
  for (const row of (data ?? []) as SummaryRow[]) {
    result.set(row.config_id, {
      configId: row.config_id,
      sentForSignatureAt: row.sent_for_signature_at ?? null,
      docusealStatus: row.docuseal_status ?? null,
      signedAt: row.signed_at ?? null,
    })
  }
  return result
}

// ---- Writes ----

export async function upsertProposal(
  attioDealId: string,
  configId: string,
  sections: ProposalSections
): Promise<ProposalRecord> {
  const { data, error } = await table()
    .upsert(
      { attio_deal_id: attioDealId, config_id: configId, sections, updated_at: new Date().toISOString() },
      { onConflict: 'attio_deal_id,config_id' }
    )
    .select()
    .single()
  if (error) throw new Error(`Supabase upsertProposal: ${error.message}`)
  return rowToRecord(data as ProposalRow)
}

/**
 * Marks proposal sent without DocuSeal (legacy / fallback).
 * SELECT + conditional UPDATE/INSERT to avoid overwriting sections.
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
    await table().insert({
      attio_deal_id: attioDealId,
      config_id: configId,
      sections: { executiveSummary: '', solution: '', economicsSummary: '', nextSteps: '' },
      sent_for_signature_at: now,
      updated_at: now,
    })
  }
}

/**
 * Saves DocuSeal submission ID + sets docuseal_status = 'pending'.
 * Called after createDocuSealSubmission() succeeds.
 */
export async function markProposalSentWithDocuSeal(
  attioDealId: string,
  configId: string,
  submissionId: string
): Promise<void> {
  const now = new Date().toISOString()
  const { data: existing } = await table()
    .select('id')
    .eq('attio_deal_id', attioDealId)
    .eq('config_id', configId)
    .maybeSingle()

  if (existing) {
    await table()
      .update({
        sent_for_signature_at: now,
        docuseal_submission_id: submissionId,
        docuseal_status: 'pending',
        updated_at: now,
      })
      .eq('id', (existing as { id: string }).id)
  } else {
    await table().insert({
      attio_deal_id: attioDealId,
      config_id: configId,
      sections: { executiveSummary: '', solution: '', economicsSummary: '', nextSteps: '' },
      sent_for_signature_at: now,
      docuseal_submission_id: submissionId,
      docuseal_status: 'pending',
      updated_at: now,
    })
  }
}

/**
 * Called by DocuSeal webhook on submission.completed.
 * Idempotent: skips if already marked completed.
 */
export async function markProposalSignedByDocuSeal(submissionId: string): Promise<{ updated: boolean }> {
  const { data: existing } = await table()
    .select('id, docuseal_status')
    .eq('docuseal_submission_id', submissionId)
    .maybeSingle()

  if (!existing) return { updated: false }
  if ((existing as { docuseal_status: DocuSealStatus }).docuseal_status === 'completed') {
    return { updated: false }
  }

  const now = new Date().toISOString()
  await table()
    .update({ docuseal_status: 'completed', signed_at: now, updated_at: now })
    .eq('docuseal_submission_id', submissionId)

  return { updated: true }
}

/**
 * Updates docuseal_status for any terminal or intermediate state.
 * Idempotent: no-op if row not found or status unchanged.
 */
export async function updateProposalDocuSealStatus(
  submissionId: string,
  status: DocuSealStatus,
): Promise<{ updated: boolean }> {
  const { data: existing } = await table()
    .select('id, docuseal_status')
    .eq('docuseal_submission_id', submissionId)
    .maybeSingle()

  if (!existing) return { updated: false }
  if ((existing as { docuseal_status: DocuSealStatus }).docuseal_status === status) {
    return { updated: false }
  }

  const now = new Date().toISOString()
  await table()
    .update({ docuseal_status: status, updated_at: now })
    .eq('docuseal_submission_id', submissionId)

  return { updated: true }
}
