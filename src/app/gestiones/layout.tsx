import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { canAccess } from '@/lib/permissions'

export default async function GestionesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!canAccess(user.role, 'gestiones')) redirect('/')
  return <>{children}</>
}
