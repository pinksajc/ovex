// POST /api/deals/[id]/gmail-import
// Imports selected Gmail emails as deal comments.
// Returns { comments_created, errors } so the client knows exactly what happened.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createComment } from '@/lib/supabase/deal-comments'
import type { GmailEmailResult } from '@/app/api/deals/[id]/gmail-search/route'

interface ImportBody {
  emails: GmailEmailResult[]
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return (
      d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    )
  } catch {
    return iso
  }
}

function extractErrMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.details ?? e.hint ?? e.code ?? JSON.stringify(err))
  }
  return String(err)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  let user
  try {
    user = await requireAuth()
  } catch (err) {
    console.error('[gmail-import] auth failed:', extractErrMsg(err))
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id: dealId } = await params

  if (!dealId) {
    console.error('[gmail-import] missing dealId in params')
    return NextResponse.json({ error: 'Deal ID requerido' }, { status: 400 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: ImportBody
  try {
    body = (await req.json()) as ImportBody
  } catch (err) {
    console.error('[gmail-import] failed to parse request body:', extractErrMsg(err))
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const emails = body?.emails
  if (!Array.isArray(emails) || emails.length === 0) {
    console.error('[gmail-import] empty or missing emails array. body keys:', Object.keys(body ?? {}))
    return NextResponse.json({ error: 'No hay emails para importar' }, { status: 400 })
  }

  console.log(`[gmail-import] start dealId=${dealId} userId=${user.id} emails=${emails.length}`)

  // ── Insert comments ─────────────────────────────────────────────────────────
  let comments_created = 0
  const errors: string[] = []

  for (const email of emails) {
    const content =
      `**${email.subject}**\n\nDe: ${email.from}\nFecha: ${fmtDate(email.date)}\n\n${email.snippet}`

    try {
      await createComment({
        dealId,
        userId: user.id,
        type: 'email',
        content: content.trim(),
      })
      comments_created++
      console.log(`[gmail-import] ok emailId=${email.id} total=${comments_created}`)
    } catch (err) {
      const msg = extractErrMsg(err)
      console.error(`[gmail-import] INSERT failed emailId=${email.id} dealId=${dealId} userId=${user.id} error=${msg}`, err)
      errors.push(msg)
    }
  }

  console.log(`[gmail-import] done comments_created=${comments_created} errors=${errors.length}`)

  if (comments_created === 0) {
    const firstError = errors[0] ?? 'No se pudo crear ningún comentario'
    return NextResponse.json(
      { comments_created: 0, errors, error: firstError },
      { status: 422 },
    )
  }

  return NextResponse.json({ comments_created, errors })
}
