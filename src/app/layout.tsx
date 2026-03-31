import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { getCurrentUser } from '@/lib/auth'

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

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className={`h-full antialiased bg-zinc-50 ${user ? 'flex' : ''}`}>
        {user && <Sidebar user={user} />}
        <main className={user ? 'flex-1 overflow-y-auto' : 'min-h-screen'}>
          {children}
        </main>
      </body>
    </html>
  )
}
