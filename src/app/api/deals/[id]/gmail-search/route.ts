import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getValidAccessToken } from '@/lib/supabase/gmail-tokens'
import { getDealById } from '@/lib/supabase/deals'

export interface GmailEmailResult {
  id: string
  subject: string
  from: string
  date: string    // ISO
  snippet: string // first ~2 lines of body
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
  // Try to get plain text body from parts first, fall back to snippet
  const parts = detail.payload.parts ?? []
  const textPart = parts.find((p) => p.mimeType === 'text/plain')
  const rawData = textPart?.body?.data ?? detail.payload.body?.data

  if (rawData) {
    const text = decodeBase64(rawData)
    // Take first 200 chars, clean whitespace
    return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 200).trim()
  }

  // Fall back to Gmail snippet (already a short preview)
  return detail.snippet ?? ''
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: dealId } = await params

  // Get deal to read contact email
  const deal = await getDealById(dealId).catch(() => null)
  if (!deal) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })

  const contactEmail = deal.contact?.email
  if (!contactEmail) {
    return NextResponse.json({ error: 'El deal no tiene email de contacto' }, { status: 400 })
  }

  // Get valid Gmail access token (auto-refreshes if expired)
  const accessToken = await getValidAccessToken(user.id)
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail no conectado' }, { status: 403 })
  }

  // Search Gmail
  const query = encodeURIComponent(`from:${contactEmail} OR to:${contactEmail}`)
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=10`

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!listRes.ok) {
    console.error('[gmail-search] list error:', await listRes.text())
    return NextResponse.json({ error: 'Error al consultar Gmail' }, { status: 502 })
  }

  const listJson = await listRes.json() as { messages?: GmailMessage[] }
  const messages = listJson.messages ?? []

  if (messages.length === 0) {
    return NextResponse.json({ emails: [] })
  }

  // Fetch details for each message (parallel, max 10)
  const details = await Promise.all(
    messages.slice(0, 10).map(async (msg) => {
      const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`
      const res = await fetch(detailUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return null
      return res.json() as Promise<GmailMessageDetail>
    }),
  )

  const emails: GmailEmailResult[] = details
    .filter((d): d is GmailMessageDetail => d !== null)
    .map((d) => ({
      id:      d.id,
      subject: getHeader(d.payload.headers, 'Subject') || '(sin asunto)',
      from:    getHeader(d.payload.headers, 'From'),
      date:    new Date(Number(d.internalDate)).toISOString(),
      snippet: extractPreview(d),
    }))
    // Sort most recent first
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({ emails })
}
