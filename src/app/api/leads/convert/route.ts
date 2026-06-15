// POST /api/leads/convert
// Creates a deal in Orvex from an Attio lead.

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { canAccess } from '@/lib/permissions'
import { createDeal } from '@/lib/supabase/deals'
import type { DealStage } from '@/types'

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    if (!canAccess(user.role, 'leads')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as {
      companyName: string
      companyCity?: string
      contactFirstName?: string
      contactLastName?: string
      contactEmail?: string
      contactPhone?: string
      stage: DealStage
      ownerId: string
    }

    if (!body.companyName?.trim()) {
      return NextResponse.json({ error: 'companyName requerido' }, { status: 400 })
    }

    const deal = await createDeal({
      companyName:       body.companyName.trim(),
      companyCity:       body.companyCity?.trim() || undefined,
      contactFirstName:  body.contactFirstName?.trim() || undefined,
      contactLastName:   body.contactLastName?.trim() || undefined,
      contactEmail:      body.contactEmail?.trim() || undefined,
      contactPhone:      body.contactPhone?.trim() || undefined,
      stage:             body.stage ?? 'prospecting',
      ownerId:           body.ownerId || undefined,
    })

    return NextResponse.json({ ok: true, dealId: deal.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[leads/convert]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
