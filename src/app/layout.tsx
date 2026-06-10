import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { getCurrentUser } from '@/lib/auth'
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  // Don't show the sidebar while the user is forced to change their password
  const showShell = user && !user.mustChangePassword

  // Billing badge — only for owner/admin; fail silently so layout never breaks
  let pendingBillingCount = 0
  let pendingGestionesCount = 0
  if (showShell && (user.role === 'owner' || user.role === 'admin')) {
    try {
      const [pending, gestionesCount] = await Promise.all([
        getPendingBillingPresupuestos(),
        getPendingApprovalsCount(),
      ])
      pendingBillingCount   = pending.length
      pendingGestionesCount = gestionesCount
    } catch {
      // ignore
    }
  }

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className={`h-full antialiased bg-zinc-50 ${showShell ? 'flex' : ''}`}>
        {showShell && <Sidebar user={user} pendingBillingCount={pendingBillingCount} pendingGestionesCount={pendingGestionesCount} />}
        <main className={showShell ? 'flex-1 overflow-y-auto' : 'min-h-screen'}>
          {children}
        </main>
      </body>
    </html>
  )
}
