import { NextRequest, NextResponse } from 'next/server'
import { upsertGmailToken } from '@/lib/supabase/gmail-tokens'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://orvex.platomico.com'}/usuarios?gmail=error`,
    )
  }

  // Verify user is still authenticated
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://orvex.platomico.com'}/login`,
    )
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const callbackUrl  = 'https://orvex.platomico.com/api/auth/gmail/callback'

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  callbackUrl,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    console.error('[gmail/callback] token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://orvex.platomico.com'}/usuarios?gmail=error`,
    )
  }

  const json = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  if (!json.refresh_token) {
    console.error('[gmail/callback] no refresh_token in response — user may need to revoke access first')
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://orvex.platomico.com'}/usuarios?gmail=no_refresh`,
    )
  }

  const expiresAt = new Date(Date.now() + json.expires_in * 1000)
  await upsertGmailToken(user.id, json.access_token, json.refresh_token, expiresAt)

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://orvex.platomico.com'}/usuarios?gmail=connected`,
  )
}
