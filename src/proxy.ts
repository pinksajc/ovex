// =========================================
// AUTH PROXY (formerly middleware)
// Protects all routes except:
//   /login                  — auth page
//   /setup-error            — env config error page
//   /*/propuesta/view       — client-facing proposal (public)
//   /api/docuseal/webhook   — DocuSeal webhook (has its own secret)
//   /_next/* favicon        — static assets
// =========================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthEnv } from '@/lib/supabase/auth-env'

const PUBLIC_PATTERNS = [
  /^\/login$/,
  /^\/setup-error$/,
  /\/propuesta\/view(\/.*)?$/,
  /^\/api\/docuseal\/webhook/,
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATTERNS.some((re) => re.test(pathname))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  // ── Env guard — redirect to /setup-error instead of crashing ─────────────
  const envResult = getAuthEnv()
  if (!envResult.ok) {
    const url = new URL('/setup-error', request.url)
    url.searchParams.set('missing', envResult.missing.join(','))
    return NextResponse.redirect(url)
  }

  // Build response — @supabase/ssr needs to be able to set cookies on it
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(envResult.env.url, envResult.env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // getUser() validates the JWT with Supabase (no stale session risk)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── must_change_password — force new users to set their own password ────────
  if (pathname !== '/change-password') {
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    if (serviceKey) {
      try {
        const res = await fetch(
          `${envResult.env.url}/rest/v1/profiles?id=eq.${user.id}&select=must_change_password`,
          {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
            cache: 'no-store',
          }
        )
        if (res.ok) {
          const rows = (await res.json()) as Array<{ must_change_password: boolean | null }>
          if (rows[0]?.must_change_password === true) {
            return NextResponse.redirect(new URL('/change-password', request.url))
          }
        }
      } catch {
        // Profile fetch failed — allow through, don't block the user
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
