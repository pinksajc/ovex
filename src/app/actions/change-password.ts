'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'
import { getAuthEnv } from '@/lib/supabase/auth-env'

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

  // ── Update password using the user's own session (anon key + cookies) ───────
  // supabase.auth.updateUser() refreshes the session tokens automatically,
  // keeping the user logged in. The admin API (updateUserById) does NOT do this.
  const envResult = getAuthEnv()
  if (!envResult.ok) {
    redirect('/change-password?error=' + encodeURIComponent('Error de configuración del servidor.'))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(envResult.env.url, envResult.env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // In server actions cookies() is writable — this propagates the new tokens
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    redirect('/change-password?error=' + encodeURIComponent(updateError.message))
  }

  // ── Clear the must_change_password flag using service role ───────────────────
  const db = getSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileUpdateError } = await (db.from('profiles') as any)
    .update({ must_change_password: false })
    .eq('id', user.id)

  if (profileUpdateError) {
    redirect('/change-password?error=' + encodeURIComponent('Error al actualizar el perfil: ' + profileUpdateError.message))
  }

  redirect('/deals')
}
