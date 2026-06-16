// =========================================
// CRUD — contact_overrides
// server-only
//
// SQL (run once in Supabase):
//   CREATE TABLE IF NOT EXISTS contact_overrides (
//     attio_deal_id text PRIMARY KEY,
//     first_name    text,
//     last_name     text,
//     email         text,
//     emails        text[],
//     updated_at    timestamptz DEFAULT now()
//   );
// =========================================

import { getSupabaseClient } from './client'

interface ContactOverrideRow {
  attio_deal_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  emails: string[] | null
  updated_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table() { return getSupabaseClient().from('contact_overrides') as any }

export interface ContactOverride {
  firstName: string
  lastName: string
  email: string
  emails: string[]
}

/**
 * Upserts a contact override for a deal.
 * PRIMARY KEY on attio_deal_id guarantees no duplicate constraint issues.
 * `emails` is the full list; `email` is kept in sync as the first element.
 */
export async function upsertContactOverride(
  attioDealId: string,
  firstName: string,
  lastName: string,
  emails: string[],
): Promise<void> {
  const cleanEmails = emails.map((e) => e.trim()).filter(Boolean)
  const primaryEmail = cleanEmails[0] ?? ''
  const { error } = await table().upsert(
    {
      attio_deal_id: attioDealId,
      first_name: firstName,
      last_name: lastName,
      email: primaryEmail,
      emails: cleanEmails.length > 0 ? cleanEmails : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'attio_deal_id' },
  )
  if (error) throw new Error(`contact_overrides upsert: ${error.message}`)
}

/**
 * Batch-fetches overrides for a list of deal IDs.
 * Returns a Map<attioDealId, ContactOverride>.
 */
export async function getContactOverridesForDeals(
  attioDealIds: string[],
): Promise<Map<string, ContactOverride>> {
  if (attioDealIds.length === 0) return new Map()
  const { data, error } = await table()
    .select('attio_deal_id, first_name, last_name, email, emails')
    .in('attio_deal_id', attioDealIds)
  if (error) throw new Error(`contact_overrides select: ${error.message}`)
  const map = new Map<string, ContactOverride>()
  for (const row of (data ?? []) as ContactOverrideRow[]) {
    const primaryEmail = row.email ?? ''
    // Prefer the emails array; fall back to wrapping the single email field
    const emails = row.emails && row.emails.length > 0
      ? row.emails
      : primaryEmail ? [primaryEmail] : []
    map.set(row.attio_deal_id, {
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      email: primaryEmail,
      emails,
    })
  }
  return map
}
