'use server'

import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'

export async function createUserAction(formData: FormData): Promise<void> {
  const me = await requireAuth()
  if (me.role !== 'admin') redirect('/deals')

  const name  = (formData.get('name')  as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const role  = (formData.get('role')  as string | null) === 'admin' ? 'admin' : 'sales'

  if (!email) {
    redirect('/admin/users?error=' + encodeURIComponent('El email es obligatorio.'))
  }

  const db = getSupabaseClient()

  // Invite user — Supabase sends an email with a magic link so the user sets their own password
  const appUrl = process.env.APP_URL ?? 'https://platomico.vercel.app'
  const { data, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name || email.split('@')[0] },
    redirectTo: appUrl,
  })

  if (inviteError || !data.user) {
    redirect('/admin/users?error=' + encodeURIComponent(inviteError?.message ?? 'Error enviando invitación'))
  }

  // Upsert profile with the assigned role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (db.from('profiles') as any).upsert({
    id: data.user.id,
    full_name: name || email.split('@')[0],
    role,
  })

  if (profileError) {
    redirect('/admin/users?error=' + encodeURIComponent(profileError.message))
  }

  redirect('/admin/users?success=1')
}
