// GET /api/leads/attio
// Fetches Companies and People from Attio and returns a unified list.

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

export type AttioCompany = {
  type: 'company'
  attioId: string
  name: string
  domain: string | null
  city: string | null
  country: string | null
  createdAt: string
}

export type AttioPerson = {
  type: 'person'
  attioId: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  createdAt: string
}

export type AttioLead = AttioCompany | AttioPerson

function pickValue(attr: unknown): string | null {
  if (!attr) return null
  const a = attr as { active_value?: { value?: unknown }; values?: Array<{ value?: unknown }> }
  const v = a.active_value?.value ?? a.values?.[0]?.value ?? null
  if (v === null || v === undefined) return null
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>
    return (obj.original_full_name ?? obj.full_domain ?? obj.display_value ?? null) as string | null
  }
  return String(v)
}

async function fetchCompanies(): Promise<AttioCompany[]> {
  const res = await fetch(`${ATTIO_BASE}/objects/companies/records/query`, {
    method: 'POST',
    headers: attioHeaders(),
    body: JSON.stringify({
      limit: 200,
      sorts: [{ attribute: 'created_at', field: 'created_at', direction: 'desc' }],
    }),
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`Attio companies: ${res.status} ${await res.text()}`)
  const json = await res.json() as { data: Array<{ id: { record_id: string }; values: Record<string, unknown>; created_at?: string }> }

  return json.data.map((r) => ({
    type: 'company' as const,
    attioId:   r.id.record_id,
    name:      pickValue(r.values.name) ?? '(sin nombre)',
    domain:    pickValue(r.values.domains),
    city:      pickValue(r.values.primary_location_city ?? r.values.city),
    country:   pickValue(r.values.primary_location_country ?? r.values.country),
    createdAt: r.created_at ?? (r.values.created_at as { active_value?: { value?: string } })?.active_value?.value ?? '',
  }))
}

async function fetchPeople(): Promise<AttioPerson[]> {
  const res = await fetch(`${ATTIO_BASE}/objects/people/records/query`, {
    method: 'POST',
    headers: attioHeaders(),
    body: JSON.stringify({
      limit: 200,
      sorts: [{ attribute: 'created_at', field: 'created_at', direction: 'desc' }],
    }),
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`Attio people: ${res.status} ${await res.text()}`)
  const json = await res.json() as { data: Array<{ id: { record_id: string }; values: Record<string, unknown>; created_at?: string }> }

  return json.data.map((r) => ({
    type: 'person' as const,
    attioId:   r.id.record_id,
    name:      pickValue(r.values.name) ?? '(sin nombre)',
    email:     pickValue(r.values.email_addresses ?? r.values.email),
    phone:     pickValue(r.values.phone_numbers ?? r.values.phone),
    company:   pickValue(r.values.company_name ?? r.values.primary_company),
    createdAt: r.created_at ?? (r.values.created_at as { active_value?: { value?: string } })?.active_value?.value ?? '',
  }))
}

export async function GET() {
  try {
    const user = await requireAuth()
    if (!canAccess(user.role, 'leads')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [companies, people] = await Promise.all([fetchCompanies(), fetchPeople()])
    return NextResponse.json({ companies, people })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[leads/attio]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
