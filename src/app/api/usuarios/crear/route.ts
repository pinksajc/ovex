// POST /api/usuarios/crear
// Body: { email: string, password: string, name?: string, role: 'admin' | 'sales' | 'finance' }
//
// Uses service_role to create the user directly — no invitation email sent.
// email_confirm: true bypasses the email verification step.

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/auth'

const VALID_ROLES: UserRole[] = ['admin', 'sales', 'finance']

export async function POST(req: Request) {
  // ── Auth check ────────────────────────────────────────────────────────────
  try {
    const me = await requireAuth()
    if (me.role !== 'admin' && me.role !== 'owner') {
      return NextResponse.json({ ok: false, error: 'Solo admin u owner pueden crear usuarios' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { email?: string; password?: string; name?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  const email    = (body.email    ?? '').trim().toLowerCase()
  const password = (body.password ?? '').trim()
  const name     = (body.name     ?? '').trim()
  const role     = body.role as UserRole

  if (!email)    return NextResponse.json({ ok: false, error: 'El email es requerido' },      { status: 400 })
  if (!password) return NextResponse.json({ ok: false, error: 'La contraseña es requerida' }, { status: 400 })
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: `Rol inválido: ${role}` }, { status: 400 })
  }

  const db = getSupabaseClient()
  const displayName = name || email.split('@')[0]

  // ── Create auth user (no email required, account confirmed immediately) ───
  const { data, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName, role },
  })

  if (createError) {
    console.error('[crear-usuario] createUser error:', createError)
    let msg = createError.message
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
      msg = 'Ya existe un usuario con ese email.'
    } else if (msg.toLowerCase().includes('invalid email')) {
      msg = `Email inválido: ${email}`
    } else if (msg.toLowerCase().includes('password')) {
      msg = 'La contraseña no cumple los requisitos de seguridad (mínimo 6 caracteres).'
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 422 })
  }

  if (!data?.user) {
    return NextResponse.json(
      { ok: false, error: 'Supabase no devolvió el usuario. Revisa los logs del proyecto.' },
      { status: 500 }
    )
  }

  // ── Upsert profile ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (db.from('profiles') as any).upsert(
    {
      id:        data.user.id,
      email,
      full_name: displayName,
      role,
      status:    'active',
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    console.error('[crear-usuario] profile upsert error:', profileError)
    // Non-fatal: user was created, profile will be auto-created on first login
  }

  return NextResponse.json({ ok: true, userId: data.user.id })
}
