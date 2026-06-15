import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { getCurrentUser, type AuthUser } from '@/lib/auth'
import { getPendingBillingPresupuestos } from '@/lib/supabase/presupuestos'
import { getPendingApprovalsCount } from '@/lib/supabase/approvals'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Orvex',
  description: 'Sales Operating System',
}

// Fetches badge counts and renders the sidebar with them.
// Runs as a separate Suspense boundary so badge DB queries don't block the page.
async function SidebarWithBadges({ user }: { user: AuthUser }) {
  let pendingBillingCount = 0
  let pendingGestionesCount = 0
  try {
    const [pending, gestionesCount] = await Promise.all([
      getPendingBillingPresupuestos(),
      getPendingApprovalsCount(),
    ])
    pendingBillingCount   = pending.length
    pendingGestionesCount = gestionesCount
  } catch {
    // fail silently — badges are non-critical
  }
  return (
    <Sidebar
      user={user}
      pendingBillingCount={pendingBillingCount}
      pendingGestionesCount={pendingGestionesCount}
    />
  )
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  // Don't show the sidebar while the user is forced to change their password
  const showShell = user && !user.mustChangePassword

  const needsBadges = showShell && (user.role === 'owner' || user.role === 'admin')

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className={`h-full antialiased bg-zinc-50 ${showShell ? 'flex' : ''}`}>
        {showShell && (
          needsBadges ? (
            // Sidebar without badges renders instantly as fallback;
            // SidebarWithBadges streams in once the count queries resolve.
            <Suspense fallback={<Sidebar user={user} />}>
              <SidebarWithBadges user={user} />
            </Suspense>
          ) : (
            <Sidebar user={user} />
          )
        )}
        <main className={showShell ? 'flex-1 overflow-y-auto' : 'min-h-screen'}>
          {children}
        </main>
      </body>
    </html>
  )
}
