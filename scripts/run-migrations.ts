/**
 * scripts/run-migrations.ts
 *
 * Applies pending schema migrations to the Supabase database.
 * Run with:  npx tsx scripts/run-migrations.ts
 *
 * Reads env vars from .env.local automatically.
 * Uses the Supabase management API (requires SUPABASE_ACCESS_TOKEN).
 * If SUPABASE_ACCESS_TOKEN is not set, prints the SQL to run manually.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // .env.local may not exist in CI — rely on process.env
  }
}

loadEnv()

// ── Migrations list ──────────────────────────────────────────────────────────
const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '20260615_add_must_change_password',
    sql: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;`,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
const PROJECT_REF = (process.env.SUPABASE_URL ?? '')
  .replace('https://', '')
  .split('.')[0]

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ACCESS_TOKEN     = process.env.SUPABASE_ACCESS_TOKEN ?? ''
const SUPABASE_URL     = process.env.SUPABASE_URL ?? ''

async function columnExists(table: string, column: string): Promise<boolean> {
  // Try selecting the column directly — PostgREST returns an error if it doesn't exist
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=1`,
    {
      headers: {
        apikey:        SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Accept:        'application/json',
      },
    }
  )
  // 200 = column exists; 4xx = column/table error = doesn't exist
  return res.ok
}

async function runSqlViaManagementApi(sql: string): Promise<{ ok: boolean; error?: string }> {
  if (!ACCESS_TOKEN) {
    return { ok: false, error: 'SUPABASE_ACCESS_TOKEN not set' }
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: text }
  }
  return { ok: true }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Checking migrations…\n')

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    process.exit(1)
  }

  for (const migration of MIGRATIONS) {
    console.log(`  • ${migration.id}`)

    // Quick existence check for known migrations
    if (migration.id.includes('must_change_password')) {
      const exists = await columnExists('profiles', 'must_change_password')
      if (exists) {
        console.log('    ✅ Already applied (column exists)\n')
        continue
      }
    }

    console.log('    ⚡ Applying…')
    const result = await runSqlViaManagementApi(migration.sql)

    if (result.ok) {
      console.log('    ✅ Applied successfully\n')
    } else if (result.error === 'SUPABASE_ACCESS_TOKEN not set') {
      console.log('    ⚠️  Cannot apply automatically — SUPABASE_ACCESS_TOKEN not set.')
      console.log('    Run this SQL in the Supabase dashboard (SQL Editor):')
      console.log()
      console.log('    ' + migration.sql)
      console.log()
      console.log('    Or set SUPABASE_ACCESS_TOKEN in .env.local and re-run this script.')
      console.log('    Get your token at: https://app.supabase.com/account/tokens\n')
    } else {
      console.error(`    ❌ Failed: ${result.error}\n`)
      process.exit(1)
    }
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
