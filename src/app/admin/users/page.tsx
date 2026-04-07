import { redirect } from 'next/navigation'
import { getCurrentUser, getWorkspaceMembersAdmin } from '@/lib/auth'
import { AdminUsersClient } from '@/components/admin/users-client'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/deals')

  const { error, success } = await searchParams
  const members = await getWorkspaceMembersAdmin()

  return (
    <AdminUsersClient
      members={members}
      currentUserId={user.id}
      initialSuccess={success}
      initialError={error}
    />
  )
}
