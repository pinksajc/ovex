// GET /api/leads/attio
// Fetches all Deals from the Attio pipeline with full pagination.

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

export type AttioDealStage = string

export type AttioDeal = {
  attioId: string
  name: string
  stage: AttioDealStage       // raw slug, e.g. "in_progress"
  stageLabel: string          // display label, e.g. "In Progress"
  value: number | null
  currency: string
  ownerName: string | null
  createdAt: string
}

// ── Field extraction — exact Attio v2 shapes ─────────────────────────────────

type AttioRecord = {
  id: { record_id: string }
  created_at?: string
  values: Record<string, unknown>
}

/** Text field: values.name = [{ value: "Goconut" }] */
function str(field: unknown): string | null {
  if (!Array.isArray(field) || field.length === 0) return null
  const v = (field[0] as Record<string, unknown>).value
  return v != null ? String(v) : null
}

/**
 * Status field: values.stage = [{ status: { title: "Lead" } }]
 * Also handles option fields and plain string values.
 */
function stageFromField(field: unknown): { slug: string; label: string } | null {
  if (!Array.isArray(field) || field.length === 0) return null
  const entry = field[0] as Record<string, unknown>
  if (entry.status && typeof entry.status === 'object') {
    const status = entry.status as Record<string, unknown>
    const title = String(status.title ?? status.label ?? status.name ?? '')
    const id    = String(status.id ?? status.slug ?? title)
    return { slug: slugify(id || title), label: title || id }
  }
  if (entry.option && typeof entry.option === 'object') {
    const option = entry.option as Record<string, unknown>
    const title = String(option.title ?? option.label ?? option.name ?? '')
    return title ? { slug: slugify(title), label: title } : null
  }
  if (typeof entry.value === 'string' && entry.value) {
    return { slug: slugify(entry.value), label: entry.value }
  }
  return null
}

/** Currency field: values.value = [{ currency_value: 900, currency_code: "EUR" }] */
function currency(field: unknown): { amount: number | null; code: string } {
  if (!Array.isArray(field) || field.length === 0) return { amount: null, code: 'EUR' }
  const entry = field[0] as Record<string, unknown>
  const amt   = entry.currency_value ?? entry.amount ?? entry.value ?? null
  const code  = String(entry.currency_code ?? 'EUR')
  return { amount: amt !== null ? Number(amt) : null, code }
}

/** Actor reference: values.owner = [{ referenced_actor_name: "Antonio Casanova" }] */
function actor(field: unknown): string | null {
  if (!Array.isArray(field) || field.length === 0) return null
  const entry = field[0] as Record<string, unknown>
  const name  = entry.referenced_actor_name ?? entry.name ?? entry.display_name ?? entry.email ?? null
  return name !== null ? String(name) : null
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

const STAGE_LABEL_MAP: Record<string, string> = {
  lead:        'Lead',
  in_progress: 'In Progress',
  inprogress:  'In Progress',
  negotiating: 'Negotiating',
  negotiation: 'Negotiating',
  won:         'Won',
  closed_won:  'Won',
  lost:        'Lost',
  closed_lost: 'Lost',
}

function normalizeStage(raw: { slug: string; label: string } | null): { slug: string; label: string } {
  if (!raw) return { slug: 'unknown', label: 'Unknown' }
  const label = STAGE_LABEL_MAP[raw.slug] ?? raw.label ?? raw.slug
  return { slug: raw.slug, label }
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
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Attio deals [${res.status}]: ${body}`)
    }

    const json = await res.json() as { data: AttioRecord[] }
    const page = json.data ?? []
    all.push(...page)
    if (page.length < PAGE) break
    offset += PAGE
  }

  // Log field keys of first record to Vercel logs for diagnostics
  if (all.length > 0) {
    console.log('[leads/attio] KEYS:', Object.keys(all[0].values))
    console.log('[leads/attio] first record:', JSON.stringify(all[0], null, 2))
  }

  const deals: AttioDeal[] = all.map((r) => {
    const v = r.values

    const name =
      str(v.name) ??
      str(v.deal_name) ??
      str(v.title) ??
      str(v.company) ??
      '(sin nombre)'

    let stageRaw =
      stageFromField(v.stage) ??
      stageFromField(v.pipeline_stage) ??
      stageFromField(v.deal_stage) ??
      stageFromField(v.status)

    // Dynamic fallback: iterate all fields looking for status/option shape
    if (!stageRaw) {
      for (const val of Object.values(v)) {
        const arr = Array.isArray(val) ? val : []
        const first = arr[0] as Record<string, unknown> | undefined
        if (!first) continue
        if (first.status && typeof first.status === 'object') {
          const s = first.status as Record<string, unknown>
          const title = String(s.title ?? s.label ?? s.name ?? '')
          if (title) { stageRaw = { slug: slugify(title), label: title }; break }
        }
        if (first.option && typeof first.option === 'object') {
          const o = first.option as Record<string, unknown>
          const title = String(o.title ?? o.label ?? o.name ?? '')
          if (title) { stageRaw = { slug: slugify(title), label: title }; break }
        }
      }
    }

    const rawStage = normalizeStage(stageRaw)

    const { amount, code } = currency(
      Array.isArray(v.value) ? v.value :
      Array.isArray(v.deal_value) ? v.deal_value :
      Array.isArray(v.amount) ? v.amount :
      null
    )

    let ownerName =
      actor(v.owner) ??
      actor(v.assignee) ??
      actor(v.deal_owner) ??
      actor(v.owners) ??
      actor(v.assigned_to)

    // Dynamic fallback: find any field with referenced_actor_name
    if (!ownerName) {
      for (const val of Object.values(v)) {
        const arr = Array.isArray(val) ? val : []
        const first = arr[0] as Record<string, unknown> | undefined
        if (first?.referenced_actor_name != null) {
          ownerName = String(first.referenced_actor_name)
          break
        }
      }
    }

    return {
      attioId:    r.id.record_id,
      name,
      stage:      rawStage.slug,
      stageLabel: rawStage.label,
      value:      amount,
      currency:   code,
      ownerName,
      createdAt:  r.created_at ?? '',
    }
  })

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
