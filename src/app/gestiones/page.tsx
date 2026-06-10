import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getPendingApprovals } from '@/lib/supabase/approvals'
import { GestionesClient } from './gestiones-client'

export default async function GestionesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const items = await getPendingApprovals().catch(() => [])

  return (
    <GestionesClient
      items={items}
      currentUserRole={user.role}
    />
  )
}
