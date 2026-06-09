import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { canAccess } from '@/lib/permissions'

export default async function DealsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!canAccess(user.role, 'deals')) redirect('/')
  return <>{children}</>
}
