'use server'

import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'

export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await requireAuth()

  const password  = (formData.get('password')  as string | null)?.trim() ?? ''
  const password2 = (formData.get('password2') as string | null)?.trim() ?? ''

  if (!password || password.length < 6) {
    redirect('/change-password?error=' + encodeURIComponent('La contraseña debe tener al menos 6 caracteres.'))
  }

  if (password !== password2) {
    redirect('/change-password?error=' + encodeURIComponent('Las contraseñas no coinciden.'))
  }

  const db = getSupabaseClient()

  const { error: updateError } = await db.auth.admin.updateUserById(user.id, { password })
  if (updateError) {
    redirect('/change-password?error=' + encodeURIComponent(updateError.message))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from('profiles') as any)
    .update({ must_change_password: false })
    .eq('id', user.id)

  redirect('/deals')
}
