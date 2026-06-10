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

// ── helpers ───────────────────────────────────────────────────────────────────

/** Serialize any error object to a loggable string, including Supabase extras. */
function serializeError(e: unknown): string {
  if (!e) return String(e)
  try { return JSON.stringify(e, null, 2) } catch { return String(e) }
}

/** Build a user-readable message from a Supabase Auth error. */
function authErrMsg(e: { message?: string; status?: number; code?: string; [k: string]: unknown }): string {
  const msg = (e.message ?? '').toLowerCase()
  if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate')) {
    return 'Ya existe un usuario con ese email.'
  }
  if (msg.includes('invalid email')) return `Email inválido.`
  if (msg.includes('password') || msg.includes('weak')) {
    return 'La contraseña no cumple los requisitos. Prueba con una más larga que incluya letras y números.'
  }
  if (msg.includes('database error')) {
    return `Error interno de base de datos. Detalle: ${e.message ?? 'desconocido'}`
  }
  return e.message ?? 'Error desconocido al crear el usuario.'
}

// ── route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Service-role check ────────────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[crear-usuario] MISSING ENV VARS — SUPABASE_URL:', !!supabaseUrl, ' SERVICE_KEY:', !!serviceKey)
    return NextResponse.json(
      { ok: false, error: 'Configuración de servidor incompleta (faltan variables de entorno de Supabase).' },
      { status: 500 }
    )
  }

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
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: `Rol inválido: ${role}` }, { status: 400 })
  }

  const db = getSupabaseClient()
  const displayName = name || email.split('@')[0]

  console.log('[crear-usuario] Attempting createUser for:', email, '| role:', role, '| url:', supabaseUrl.slice(0, 40))

  // ── Create auth user (confirmed immediately, no email sent) ───────────────
  const { data, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName, role },
  })

  if (createError) {
    console.error('[crear-usuario] createUser FAILED:\n', serializeError(createError))
    return NextResponse.json(
      { ok: false, error: authErrMsg(createError as unknown as Record<string, unknown>) },
      { status: 422 }
    )
  }

  if (!data?.user) {
    console.error('[crear-usuario] createUser returned no user and no error')
    return NextResponse.json(
      { ok: false, error: 'Supabase no devolvió el usuario. Revisa los logs del proyecto en Vercel.' },
      { status: 500 }
    )
  }

  console.log('[crear-usuario] Auth user created OK, id:', data.user.id)

  // ── Upsert profile ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (db.from('profiles') as any).upsert(
    {
      id:        data.user.id,
      email,
      full_name: displayName,
      role,
      // status only if the column exists (migration 20260609000003 must be run in Supabase Dashboard)
      status: 'active',
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    // Log but don't fail — the auth user was created successfully.
    // If status column doesn't exist yet, the row will be auto-created on first login.
    console.error('[crear-usuario] profile upsert error (non-fatal):\n', serializeError(profileError))
  } else {
    console.log('[crear-usuario] Profile upserted OK for:', email)
  }

  return NextResponse.json({ ok: true, userId: data.user.id })
}
