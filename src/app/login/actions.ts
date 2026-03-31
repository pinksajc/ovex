'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAuthServerClient } from '@/lib/supabase/auth'

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies()
  const supabase = createAuthServerClient(cookieStore)
  await supabase.auth.signOut()
  redirect('/login')
}
