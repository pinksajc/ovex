// POST /api/usuarios/invitar
// Body: { email: string, name?: string, role: 'admin' | 'sales' | 'finance' }
//
// Requires: authenticated user with role owner or admin.
// Uses service_role client — must stay server-side only.

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/auth'

const VALID_INVITE_ROLES: UserRole[] = ['admin', 'sales', 'finance']

export async function POST(req: Request) {
  // ── Auth check ────────────────────────────────────────────────────────────
  let me: Awaited<ReturnType<typeof requireAuth>>
  try {
    me = await requireAuth()
  } catch {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  if (me.role !== 'admin' && me.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'Solo admin u owner pueden invitar usuarios' }, { status: 403 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { email?: string; name?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const name  = (body.name  ?? '').trim()
  const role  = body.role as UserRole

  if (!email) {
    return NextResponse.json({ ok: false, error: 'El email es requerido' }, { status: 400 })
  }
  if (!VALID_INVITE_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: `Rol inválido: ${role}` }, { status: 400 })
  }

  const db = getSupabaseClient()

  // ── Build redirectTo (allowlisted in Supabase Dashboard → Auth → URL Configuration) ──
  const appUrl =
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // ── Send invite email ──────────────────────────────────────────────────────
  const { data, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: name || email.split('@')[0],
      role,       // stored in user_metadata for the welcome flow
    },
    redirectTo: appUrl,
  })

  if (inviteError) {
    console.error('[invitar] inviteUserByEmail error:', inviteError)
    // Surface actionable messages
    let msg = inviteError.message
    if (msg.toLowerCase().includes('already registered')) {
      msg = 'Este email ya está registrado. Si quieres reenviar la invitación usa el botón "Reenviar".'
    } else if (msg.toLowerCase().includes('invalid')) {
      msg = `Email inválido o dominio no permitido: ${email}`
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 422 })
  }

  if (!data?.user) {
    return NextResponse.json(
      { ok: false, error: 'Supabase no devolvió el usuario. Revisa los logs del proyecto.' },
      { status: 500 }
    )
  }

  // ── Upsert profile ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (db.from('profiles') as any).upsert(
    {
      id:        data.user.id,
      email,
      full_name: name || email.split('@')[0],
      role,
      status:    'pending',
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    // Invite already sent — profile upsert failing is non-fatal; log but continue.
    console.error('[invitar] profile upsert error:', profileError)
  }

  return NextResponse.json({ ok: true, userId: data.user.id })
}
