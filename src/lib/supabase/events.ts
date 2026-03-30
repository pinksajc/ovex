// =========================================
// DEAL EVENTS — fire-and-forget logging
// server-only
// =========================================
//
// SQL migration (run once in Supabase):
//
// CREATE TABLE IF NOT EXISTS deal_events (
//   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   deal_id    text NOT NULL,
//   event_type text NOT NULL,
//   created_at timestamptz NOT NULL DEFAULT now()
// );
// CREATE INDEX ON deal_events (deal_id);
// CREATE INDEX ON deal_events (event_type);
//
// =========================================

/**
 * Returns a map of dealId → ISO timestamp of the most recent event.
 * Single query, no N+1.
 */
export async function getLastActivityByDeal(
  dealIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (dealIds.length === 0) return result

  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) return result

    const { getSupabaseClient } = await import('./client')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (getSupabaseClient() as any)
      .from('deal_events')
      .select('deal_id, created_at')
      .in('deal_id', dealIds)
      .order('created_at', { ascending: false })

    if (!data) return result

    // Keep only the first (most recent) row per deal_id
    for (const row of data as { deal_id: string; created_at: string }[]) {
      if (!result.has(row.deal_id)) {
        result.set(row.deal_id, row.created_at)
      }
    }
  } catch {
    // never surface
  }

  return result
}

/**
 * Returns { count, lastAt } for proposal_viewed events of a single deal.
 */
export async function getProposalViewStats(
  dealId: string
): Promise<{ count: number; lastAt: string | null }> {
  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) return { count: 0, lastAt: null }

    const { getSupabaseClient } = await import('./client')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (getSupabaseClient() as any)
      .from('deal_events')
      .select('created_at')
      .eq('deal_id', dealId)
      .eq('event_type', 'proposal_viewed')
      .order('created_at', { ascending: false })

    if (!data || (data as unknown[]).length === 0) return { count: 0, lastAt: null }
    const rows = data as { created_at: string }[]
    return { count: rows.length, lastAt: rows[0].created_at }
  } catch {
    return { count: 0, lastAt: null }
  }
}

/**
 * Returns a map of dealId → ISO timestamp of the most recent proposal_viewed event.
 */
export async function getLastProposalViewByDeal(
  dealIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (dealIds.length === 0) return result

  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) return result

    const { getSupabaseClient } = await import('./client')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (getSupabaseClient() as any)
      .from('deal_events')
      .select('deal_id, created_at')
      .in('deal_id', dealIds)
      .eq('event_type', 'proposal_viewed')
      .order('created_at', { ascending: false })

    if (!data) return result
    for (const row of data as { deal_id: string; created_at: string }[]) {
      if (!result.has(row.deal_id)) result.set(row.deal_id, row.created_at)
    }
  } catch {
    // never surface
  }

  return result
}

export type DealEventType =
  | 'deal_opened'
  | 'proposal_viewed'
  | 'config_saved'
  | 'proposal_saved'
  | 'proposal_sent_for_signature'

/**
 * Logs a deal event to Supabase.
 * Never throws — errors are silently swallowed so they never break the main flow.
 */
export async function logEvent(
  eventType: DealEventType,
  dealId: string
): Promise<void> {
  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) return // mock mode — skip silently

    const { getSupabaseClient } = await import('./client')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSupabaseClient() as any)
      .from('deal_events')
      .insert({ deal_id: dealId, event_type: eventType })
  } catch {
    // never surface — tracking must not affect UX
  }
}
