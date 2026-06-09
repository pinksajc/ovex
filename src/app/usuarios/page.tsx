import { redirect } from 'next/navigation'
import { getCurrentUser, getWorkspaceMembersAdmin } from '@/lib/auth'
import { canAccess } from '@/lib/permissions'
import { UsuariosClient } from './usuarios-client'

export default async function UsuariosPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!canAccess(user.role, 'usuarios')) redirect('/')

  const members = await getWorkspaceMembersAdmin()

  return (
    <UsuariosClient
      members={members}
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  )
}
