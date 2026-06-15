'use server'

import { requireAuth } from '@/lib/auth'
import { createComment, deleteComment } from '@/lib/supabase/deal-comments'
import type { CommentType } from '@/lib/supabase/deal-comments'

export interface AddCommentResult {
  ok: boolean
  error?: string
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
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
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
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
