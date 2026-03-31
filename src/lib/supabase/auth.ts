// =========================================
// SUPABASE AUTH CLIENTS
// Separate from the service-role client used for data ops.
// Uses anon key + cookie-based sessions.
// =========================================

import { createServerClient, createBrowserClient } from '@supabase/ssr'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { getAuthEnv } from './auth-env'

/** For server components and server actions — reads session from cookies. */
export function createAuthServerClient(cookieStore: ReadonlyRequestCookies) {
  const result = getAuthEnv()
  if (!result.ok) {
    throw new Error(
      `Supabase auth no configurado. Variables de entorno faltantes: ${result.missing.join(', ')}`
    )
  }
  return createServerClient(result.env.url, result.env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {
        // Server components can't set cookies — middleware handles refresh
      },
    },
  })
}

/** For client components — browser-side session management. */
export function createAuthBrowserClient() {
  const result = getAuthEnv()
  if (!result.ok) {
    throw new Error(
      `Supabase auth no configurado. Variables faltantes: ${result.missing.join(', ')}`
    )
  }
  return createBrowserClient(result.env.url, result.env.anonKey)
}
