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

function rowToComment(row: CommentRow): DealComment {
  return {
    id: row.id,
    dealId: row.deal_id,
    userId: row.user_id,
    userName: row.profiles?.name ?? null,
    type: row.type as CommentType,
    content: row.content,
    createdAt: row.created_at,
  }
}

export async function getCommentsByDeal(dealId: string): Promise<DealComment[]> {
  const db = getSupabaseClient()
  const { data, error } = await commentsTable(db)
    .select('*, profiles(name)')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data as CommentRow[]).map(rowToComment)
}

export interface CreateCommentInput {
  dealId: string
  userId: string
  type: CommentType
  content: string
}

export async function createComment(input: CreateCommentInput): Promise<DealComment> {
  const db = getSupabaseClient()
  const { data, error } = await commentsTable(db)
    .insert({
      deal_id: input.dealId,
      user_id: input.userId,
      type: input.type,
      content: input.content,
    })
    .select('*, profiles(name)')
    .single()

  if (error) throw error
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
