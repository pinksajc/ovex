// GET /api/cron/gmail-sync
// Called every 15 min by Vercel Cron.
// Imports new Gmail emails for all deals that have a contact email + owner with a connected Gmail token.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { getValidAccessToken } from '@/lib/supabase/gmail-tokens'
import { createComment, gmailMessageAlreadyImported } from '@/lib/supabase/deal-comments'
import { getContactOverridesForDeals } from '@/lib/supabase/contact-overrides'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DealRow {
  id: string
  contact_email: string
  owner_id: string
}

interface GmailMessage {
  id: string
  threadId: string
}

interface GmailMessageDetail {
  id: string
  payload: {
    headers: { name: string; value: string }[]
    body?: { data?: string }
    parts?: { mimeType: string; body: { data?: string } }[]
  }
  snippet: string
  internalDate: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeBase64(encoded: string): string {
  try {
    return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function extractPreview(detail: GmailMessageDetail): string {
  const parts = detail.payload.parts ?? []
  const textPart = parts.find((p) => p.mimeType === 'text/plain')
  const rawData = textPart?.body?.data ?? detail.payload.body?.data
  if (rawData) {
    const text = decodeBase64(rawData)
    return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 300).trim()
  }
  return detail.snippet ?? ''
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  )
}

// ── Gmail fetch helpers ───────────────────────────────────────────────────────

async function fetchMessageDetail(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageDetail | null> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return null
  return res.json() as Promise<GmailMessageDetail>
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseClient()

  // Diagnostic: count users with gmail_tokens
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokensTable = (db as unknown as { from(t: string): any }).from('gmail_tokens')
  const { count: tokenCount } = await tokensTable.select('*', { count: 'exact', head: true }).catch(() => ({ count: 0 }))
  console.log(`[gmail-sync] start — users with gmail tokens: ${tokenCount ?? 'unknown'}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dealsTable = (db as unknown as { from(t: string): any }).from('deals')

  // Fetch all deals with a contact email and an owner
  const { data: deals, error: dealsError } = await dealsTable
    .select('id, contact_email, owner_id')
    .not('contact_email', 'is', null)
    .not('contact_email', 'eq', '')
    .not('owner_id', 'is', null)

  if (dealsError) {
    console.error('[gmail-sync] failed to fetch deals:', dealsError.message)
    return NextResponse.json({ error: dealsError.message }, { status: 500 })
  }

  const dealRows = deals as DealRow[]
  console.log(`[gmail-sync] deals with contact email: ${dealRows.length}`)
  const dealIds = dealRows.map((d) => d.id)
  const overrideMap = await getContactOverridesForDeals(dealIds).catch(() => new Map())

  const afterDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
  const summary: { dealId: string; imported: number; skipped: number; error?: string }[] = []
  let totalImported = 0

  for (const deal of dealRows) {
    const { id: dealId, contact_email: contactEmail, owner_id: ownerId } = deal
    // Use all emails from contact_overrides if available; fall back to deals.contact_email
    const override = overrideMap.get(dealId)
    const emailsToSearch: string[] = override?.emails.length
      ? override.emails
      : contactEmail ? [contactEmail] : []
    if (emailsToSearch.length === 0) continue

    // Get valid Gmail access token for the owner (auto-refreshes if needed)
    let accessToken: string | null
    try {
      accessToken = await getValidAccessToken(ownerId)
    } catch {
      // No token or revoked — skip silently
      continue
    }
    if (!accessToken) continue

    // Search Gmail for all contact emails (dedup by message id across iterations)
    let messages: GmailMessage[]
    try {
      // Build combined query: (from:e1 OR to:e1 OR from:e2 OR to:e2 ...) after:unix
      const afterUnix = Math.floor(afterDate.getTime() / 1000)
      const emailParts = emailsToSearch.map((e) => `from:${e} OR to:${e}`).join(' OR ')
      const q = encodeURIComponent(`(${emailParts}) after:${afterUnix}`)
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=20`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Gmail list [${res.status}]: ${body}`)
      }
      const json = await res.json() as { messages?: GmailMessage[] }
      messages = json.messages ?? []
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[gmail-sync] deal=${dealId} search error: ${msg}`)
      summary.push({ dealId, imported: 0, skipped: 0, error: msg })
      continue
    }

    if (messages.length === 0) continue

    // Fetch details & import
    let imported = 0
    let skipped = 0

    for (const msg of messages) {
      // Deduplication check (fast — uses unique index)
      const already = await gmailMessageAlreadyImported(msg.id)
      if (already) { skipped++; continue }

      const detail = await fetchMessageDetail(accessToken, msg.id)
      if (!detail) { skipped++; continue }

      const subject = getHeader(detail.payload.headers, 'Subject') || '(sin asunto)'
      const from    = getHeader(detail.payload.headers, 'From')
      const dateIso = new Date(Number(detail.internalDate)).toISOString()
      const preview = extractPreview(detail)
      const content = `**${subject}**\n\nDe: ${from}\nFecha: ${fmtDate(dateIso)}\n\n${preview}`

      try {
        await createComment({
          dealId,
          userId: ownerId,
          type: 'email',
          content: content.trim(),
          gmailMessageId: msg.id,
        })
        imported++
        totalImported++
      } catch (err) {
        // Unique constraint violation = race condition duplicate — safe to ignore
        const msg2 = err instanceof Error ? err.message : String(err)
        if (msg2.includes('unique') || msg2.includes('duplicate')) {
          skipped++
        } else {
          console.error(`[gmail-sync] deal=${dealId} insert error: ${msg2}`)
          skipped++
        }
      }
    }

    if (imported > 0) {
      console.log(`[gmail-sync] deal=${dealId} emails=${emailsToSearch.join(',')} imported=${imported} skipped=${skipped}`)
    }
    summary.push({ dealId, imported, skipped })
  }

  console.log(`[gmail-sync] done totalImported=${totalImported} deals=${(deals as DealRow[]).length}`)
  return NextResponse.json({ ok: true, totalImported, summary })
}
