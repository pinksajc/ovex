// GET /api/leads/attio
// Fetches Deals from Attio pipeline with full pagination.

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { canAccess } from '@/lib/permissions'

const ATTIO_BASE = 'https://api.attio.com/v2'

function attioHeaders() {
  const key = process.env.ATTIO_API_KEY
  if (!key) throw new Error('ATTIO_API_KEY not set')
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type AttioDealStage = 'lead' | 'in_progress' | 'negotiating' | 'won' | 'lost' | string

export type AttioDeal = {
  attioId: string
  name: string
  stage: AttioDealStage
  stageLabel: string
  value: number | null
  currency: string
  ownerName: string | null
  createdAt: string
}

export type AttioLead = AttioDeal  // keep alias for leads-client compat

// ── Value extraction ──────────────────────────────────────────────────────────

type AttioRecord = {
  id: { record_id: string }
  created_at?: string
  values: Record<string, unknown>
}

/** Pull the first scalar value from any Attio attribute shape. */
function pick(attr: unknown): unknown {
  if (attr === null || attr === undefined) return null
  // Array form: [{ value: ... }, ...]
  if (Array.isArray(attr)) return attr.length > 0 ? attr[0].value ?? attr[0] : null
  // Object form: { active_value: { value: ... } } or { value: ... }
  const a = attr as Record<string, unknown>
  if ('active_value' in a) return (a.active_value as Record<string, unknown>)?.value ?? null
  if ('value' in a) return a.value
  return null
}

function pickStr(attr: unknown): string | null {
  const v = pick(attr)
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v || null
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    // name object
    const name = o.original_full_name ?? o.full_name ?? o.full_domain ?? o.display_value ?? o.title ?? o.name ?? null
    return name ? String(name) : null
  }
  return String(v)
}

function pickNum(attr: unknown): number | null {
  const v = pick(attr)
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    const n = o.currency_value ?? o.amount ?? o.value ?? null
    return n !== null ? Number(n) : null
  }
  const n = Number(v)
  return isNaN(n) ? null : n
}

function pickCurrency(attr: unknown): string {
  const v = pick(attr)
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).currency_code ?? 'EUR')
  }
  return 'EUR'
}

/** Resolve stage slug → display label. */
function stageLabel(raw: string): string {
  const map: Record<string, string> = {
    lead:         'Lead',
    in_progress:  'In Progress',
    inprogress:   'In Progress',
    negotiating:  'Negotiating',
    won:          'Won',
    lost:         'Lost',
    closed_won:   'Won',
    closed_lost:  'Lost',
  }
  return map[raw.toLowerCase().replace(/[^a-z]/g, '_')] ?? raw
}

/** Extract stage slug from various Attio attribute shapes. */
function pickStage(attr: unknown): string {
  const v = pick(attr)
  if (v === null || v === undefined) return 'lead'
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    // status attribute shape: { status: 'lead' } or { id: {...}, title: 'Lead' }
    return String(o.status ?? o.slug ?? o.id?.toString() ?? o.title ?? 'lead')
  }
  return String(v)
}

/** Extract owner display name from owner/assignee attribute. */
function pickOwner(attr: unknown): string | null {
  const v = pick(attr)
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    return String(
      o.name ?? o.display_name ?? o.full_name ??
      o.original_full_name ?? o.email ?? ''
    ) || null
  }
  return null
}

// ── Pagination ────────────────────────────────────────────────────────────────

async function fetchAllDeals(): Promise<AttioDeal[]> {
  const PAGE = 200
  let offset = 0
  const all: AttioRecord[] = []

  for (;;) {
    const res = await fetch(`${ATTIO_BASE}/objects/deals/records/query`, {
      method: 'POST',
      headers: attioHeaders(),
      body: JSON.stringify({ limit: PAGE, offset }),
      // no cache — always fresh in production
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Attio deals [${res.status}]: ${body}`)
    }

    const json = await res.json() as { data: AttioRecord[] }
    const page = json.data ?? []
    all.push(...page)

    if (page.length < PAGE) break   // last page
    offset += PAGE
  }

  // Debug: log first record structure once so we can verify field names in Vercel logs
  if (all.length > 0) {
    console.log('[leads/attio] first record sample:', JSON.stringify(all[0], null, 2))
  }

  const deals: AttioDeal[] = all.map((r) => {
    const v = r.values

    // Try common deal name fields
    const name =
      pickStr(v.name) ??
      pickStr(v.deal_name) ??
      pickStr(v.title) ??
      pickStr(v.company) ??
      pickStr(v.associated_company) ??
      '(sin nombre)'

    // Try common stage fields
    const rawStage = pickStage(
      v.stage ?? v.deal_stage ?? v.status ?? v.pipeline_stage ?? null
    )

    // Try common value/amount fields
    const amount = pickNum(v.value ?? v.deal_value ?? v.amount ?? v.arr ?? null)
    const currency = pickCurrency(v.value ?? v.deal_value ?? v.amount ?? null)

    // Try common owner fields
    const owner = pickOwner(
      v.owner ?? v.assignee ?? v.assigned_to ?? v.deal_owner ?? v.owners ?? null
    )

    const createdAt = r.created_at ?? pickStr(v.created_at) ?? ''

    return {
      attioId:    r.id.record_id,
      name,
      stage:      rawStage,
      stageLabel: stageLabel(rawStage),
      value:      amount,
      currency,
      ownerName:  owner,
      createdAt,
    }
  })

  // Sort: newest first, fallback alphabetical
  return deals.sort((a, b) =>
    a.createdAt && b.createdAt
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : a.name.localeCompare(b.name)
  )
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const user = await requireAuth()
    if (!canAccess(user.role, 'leads')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deals = await fetchAllDeals()
    return NextResponse.json({ deals, total: deals.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[leads/attio]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
