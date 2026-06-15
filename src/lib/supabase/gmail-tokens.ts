// =========================================
// GMAIL TOKENS — Supabase CRUD
// server-only
// =========================================

import { getSupabaseClient } from './client'

export interface GmailToken {
  id: string
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: string
}

interface TokenRow {
  id: string
  user_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tokensTable(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('gmail_tokens')
}

function rowToToken(row: TokenRow): GmailToken {
  return {
    id: row.id,
    userId: row.user_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
  }
}

export async function getGmailToken(userId: string): Promise<GmailToken | null> {
  const db = getSupabaseClient()
  const { data, error } = await tokensTable(db)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return rowToToken(data as TokenRow)
}

export async function upsertGmailToken(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await tokensTable(db).upsert(
    {
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

export async function deleteGmailToken(userId: string): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await tokensTable(db).delete().eq('user_id', userId)
  if (error) throw error
}

/** Returns a valid access token, refreshing if expired. Updates DB on refresh. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const token = await getGmailToken(userId)
  if (!token) return null

  // If token has > 60 s left, use it directly
  const expiresAt = new Date(token.expiresAt).getTime()
  if (expiresAt - Date.now() > 60_000) return token.accessToken

  // Refresh
  const clientId     = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: token.refreshToken,
      grant_type:    'refresh_token',
    }),
  })

  if (!res.ok) {
    // Refresh token revoked — delete stored token
    await deleteGmailToken(userId).catch(() => null)
    return null
  }

  const json = await res.json() as { access_token: string; expires_in: number }
  const newExpiry = new Date(Date.now() + json.expires_in * 1000)
  await upsertGmailToken(userId, json.access_token, token.refreshToken, newExpiry)
  return json.access_token
}
