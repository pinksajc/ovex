import { redirect } from 'next/navigation'
import { getCurrentUser, getWorkspaceMembers } from '@/lib/auth'
import { canAccess } from '@/lib/permissions'
import { getDeals } from '@/lib/deals'
import { LeadsClient } from './leads-client'

export default async function LeadsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!canAccess(user.role, 'leads')) redirect('/dashboard')

  // Fetch members for owner selector and existing deals to show "converted" badge
  const [members, deals] = await Promise.all([
    getWorkspaceMembers(),
    getDeals(user),
  ])

  // Build a set of already-converted company names and contact emails
  const convertedNames  = new Set(deals.map((d) => d.company.name.toLowerCase().trim()))
  const convertedEmails = new Set(
    deals.map((d) => d.contact.email?.toLowerCase().trim()).filter(Boolean) as string[]
  )

  return (
    <LeadsClient
      currentUser={user}
      members={members}
      convertedNames={convertedNames}
      convertedEmails={convertedEmails}
    />
  )
}
