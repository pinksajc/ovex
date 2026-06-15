/**
 * Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
 * Verifies that the must_change_password column exists in profiles.
 * If it does not exist and SUPABASE_ACCESS_TOKEN is available, applies the migration automatically.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const supabaseUrl     = process.env.SUPABASE_URL ?? ''
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? ''
  const accessToken     = process.env.SUPABASE_ACCESS_TOKEN ?? ''

  if (!supabaseUrl || !serviceRoleKey) return

  try {
    // Try selecting the column — PostgREST returns error if it doesn't exist
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=must_change_password&limit=1`,
      {
        headers: {
          apikey:        serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept:        'application/json',
        },
      }
    )

    if (checkRes.ok) return // column exists, nothing to do

    console.warn('[orvex] ⚠️  profiles.must_change_password column missing.')

    if (!accessToken) {
      console.warn('[orvex]    Set SUPABASE_ACCESS_TOKEN and restart to auto-apply, or run:')
      console.warn('[orvex]    npx tsx scripts/run-migrations.ts')
      return
    }

    const projectRef = supabaseUrl.replace('https://', '').split('.')[0]
    const migrateRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;',
        }),
      }
    )

    if (migrateRes.ok) {
      console.log('[orvex] ✅ Migration applied: profiles.must_change_password')
    } else {
      const err = await migrateRes.text()
      console.error('[orvex] ❌ Migration failed:', err)
    }
  } catch (err) {
    // Never block server startup
    console.error('[orvex] Migration check error (non-fatal):', err)
  }
}
