// =========================================
// DEAL COMMENTS — Supabase CRUD
// server-only
// =========================================

import { getSupabaseClient } from './client'

export type CommentType = 'call' | 'email' | 'meeting' | 'whatsapp' | 'other'

export interface DealComment {
  id: string
  dealId: string
  userId: string
  /** Display name — joined from profiles at read time */
  userName: string | null
  type: CommentType
  content: string
  createdAt: string
}

interface CommentRow {
  id: string
  deal_id: string
  user_id: string
  type: string
  content: string
  created_at: string
  profiles?: { name: string | null } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function commentsTable(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('deal_comments')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function profilesTable(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('profiles')
}

function rowToComment(row: CommentRow, nameMap?: Map<string, string>): DealComment {
  return {
    id: row.id,
    dealId: row.deal_id,
    userId: row.user_id,
    userName: nameMap?.get(row.user_id) ?? row.profiles?.name ?? null,
    type: row.type as CommentType,
    content: row.content,
    createdAt: row.created_at,
  }
}

export async function getCommentsByDeal(dealId: string): Promise<DealComment[]> {
  const db = getSupabaseClient()

  // Fetch comments without profiles join (FK points to auth.users, not profiles)
  const { data, error } = await commentsTable(db)
    .select('id, deal_id, user_id, type, content, created_at')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  const rows = data as CommentRow[]

  // Resolve display names in a second query
  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const nameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await profilesTable(db)
      .select('id, name')
      .in('id', userIds)
    for (const p of (profiles ?? []) as { id: string; name: string | null }[]) {
      if (p.name) nameMap.set(p.id, p.name)
    }
  }

  return rows.map((r) => rowToComment(r, nameMap))
}

export interface CreateCommentInput {
  dealId: string
  userId: string
  type: CommentType
  content: string
}

export async function createComment(input: CreateCommentInput): Promise<DealComment> {
  const db = getSupabaseClient()
  console.log('[createComment] inserting', { dealId: input.dealId, userId: input.userId, type: input.type })

  // Don't join profiles on insert — the FK points to auth.users, not profiles,
  // so PostgREST can't resolve the profiles embed and the whole request fails.
  // We return userName: null here; the list query joins profiles correctly.
  const { data, error } = await commentsTable(db)
    .insert({
      deal_id: input.dealId,
      user_id: input.userId,
      type: input.type,
      content: input.content,
    })
    .select('id, deal_id, user_id, type, content, created_at')
    .single()

  if (error) {
    console.error('[createComment] DB error', JSON.stringify(error))
    throw error
  }
  console.log('[createComment] ok, id=', (data as CommentRow).id)
  return rowToComment(data as CommentRow)
}

export async function deleteComment(id: string, userId: string): Promise<void> {
  const db = getSupabaseClient()
  // Only allow deletion of own comments (enforced in-code, not just RLS)
  const { error } = await commentsTable(db)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}
