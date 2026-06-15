'use server'

import { requireAuth } from '@/lib/auth'
import { createComment, deleteComment } from '@/lib/supabase/deal-comments'
import type { CommentType } from '@/lib/supabase/deal-comments'

export interface AddCommentResult {
  ok: boolean
  error?: string
}

function extractMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    // Supabase PostgrestError has message / details / hint / code
    return String(e.message ?? e.details ?? e.hint ?? e.code ?? JSON.stringify(err))
  }
  return String(err)
}

export async function addCommentAction(
  dealId: string,
  type: CommentType,
  content: string,
): Promise<AddCommentResult> {
  try {
    const user = await requireAuth()
    const trimmed = content.trim()
    if (!trimmed) return { ok: false, error: 'El comentario no puede estar vacío' }
    await createComment({ dealId, userId: user.id, type, content: trimmed })
    return { ok: true }
  } catch (err) {
    const msg = extractMsg(err)
    console.error('[addCommentAction]', msg, err)
    return { ok: false, error: msg }
  }
}

export interface DeleteCommentResult {
  ok: boolean
  error?: string
}

export async function deleteCommentAction(commentId: string): Promise<DeleteCommentResult> {
  try {
    const user = await requireAuth()
    await deleteComment(commentId, user.id)
    return { ok: true }
  } catch (err) {
    const msg = extractMsg(err)
    console.error('[deleteCommentAction]', msg, err)
    return { ok: false, error: msg }
  }
}
