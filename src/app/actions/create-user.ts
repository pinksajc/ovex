'use server'

import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'

export async function createUserAction(formData: FormData): Promise<void> {
  const me = await requireAuth()
  if (me.role !== 'admin') {
    redirect('/deals')
  }

  const name    = (formData.get('name')     as string | null)?.trim() ?? ''
  const email   = (formData.get('email')    as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null)?.trim() ?? ''
  const role    = (formData.get('role')     as string | null) === 'admin' ? 'admin' : 'sales'

  if (!email || !password) {
    redirect('/admin/users?error=' + encodeURIComponent('Email y contraseña son obligatorios.'))
  }

  try {
    const db = getSupabaseClient()

    // Create auth user via admin API
    const { data, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (authError || !data.user) {
      const msg = authError?.message ?? 'Error creando usuario en Auth'
      redirect('/admin/users?error=' + encodeURIComponent(msg))
    }

    // Upsert profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (db.from('profiles') as any).upsert({
      id: data.user.id,
      name: name || email.split('@')[0],
      role,
    })

    if (profileError) {
      redirect('/admin/users?error=' + encodeURIComponent(profileError.message))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado'
    redirect('/admin/users?error=' + encodeURIComponent(msg))
  }

  redirect('/admin/users?success=1')
}
