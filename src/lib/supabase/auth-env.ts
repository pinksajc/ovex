// =========================================
// AUTH ENV VALIDATION
// Single source of truth for NEXT_PUBLIC_SUPABASE_*
// =========================================

export interface AuthEnv {
  url: string
  anonKey: string
}

/**
 * Returns the auth env vars, or null with a list of missing names.
 * Never throws. Use before creating any auth Supabase client.
 */
export function getAuthEnv(): { ok: true; env: AuthEnv } | { ok: false; missing: string[] } {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const missing: string[] = []
  if (!url)     missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (missing.length > 0) return { ok: false, missing }
  return { ok: true, env: { url: url!, anonKey: anonKey! } }
}
