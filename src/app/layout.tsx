import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { getCurrentUser } from '@/lib/auth'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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

  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className={`h-full antialiased bg-base ${showShell ? 'flex' : ''}`}>
        {showShell && <Sidebar user={user} />}
        <main className={showShell ? 'flex-1 overflow-y-auto' : 'min-h-screen'}>
          {children}
        </main>
      </body>
    </html>
  )
}
