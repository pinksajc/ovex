import { redirect } from 'next/navigation'
import { getCurrentUser, getWorkspaceMembersAdmin } from '@/lib/auth'
import { canAccess } from '@/lib/permissions'
import { UsuariosClient } from './usuarios-client'
import { getGmailToken } from '@/lib/supabase/gmail-tokens'
import { GmailConnectButton } from './gmail-connect-button'

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!canAccess(user.role, 'usuarios')) redirect('/')

  const [members, gmailToken] = await Promise.all([
    getWorkspaceMembersAdmin(),
    getGmailToken(user.id).catch(() => null),
  ])

  const { gmail } = await searchParams

  return (
    <div>
      {/* Gmail connection banner */}
      <div className="max-w-5xl mx-auto px-8 pt-8">
        <GmailConnectButton
          connected={!!gmailToken}
          flashStatus={gmail ?? null}
        />
      </div>

      <UsuariosClient
        members={members}
        currentUserId={user.id}
        currentUserRole={user.role}
      />
    </div>
  )
}
