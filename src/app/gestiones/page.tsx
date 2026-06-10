import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getPendingApprovals, getApprovalHistory } from '@/lib/supabase/approvals'
import { GestionesClient } from './gestiones-client'

export default async function GestionesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [items, history] = await Promise.all([
    getPendingApprovals().catch(() => []),
    getApprovalHistory().catch(() => []),
  ])

  return (
    <GestionesClient
      items={items}
      history={history}
      currentUserRole={user.role}
    />
  )
}
