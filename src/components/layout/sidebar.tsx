'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase/auth'
import type { AuthUser } from '@/lib/auth'

const NAV = [
  { href: '/deals', label: 'Deals', icon: IconDeals },
  { href: '/pipeline', label: 'Pipeline', icon: IconPipeline },
  { href: '/facturas', label: 'Facturas', icon: IconInvoice },
]

const ADMIN_NAV = [
  { href: '/admin/users', label: 'Usuarios', icon: IconUsers },
]

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createAuthBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <span className="text-white font-semibold text-sm tracking-tight">
          Orvex
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/deals'
              ? pathname.startsWith('/deals')
              : href === '/facturas'
              ? pathname.startsWith('/facturas')
              : pathname === href

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {/* Admin-only section */}
        {user.role === 'admin' && (
          <>
            <div className="pt-3 pb-1 px-3">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                Admin
              </span>
            </div>
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User profile + logout */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="flex items-start gap-2.5 px-1 mb-3">
          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs font-semibold text-zinc-300">
              {(user.name ?? user.email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-200 truncate leading-snug">
              {user.name ?? user.email.split('@')[0]}
            </p>
            <p className="text-[10px] text-zinc-500 truncate leading-snug">
              {user.email}
            </p>
            <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
              {user.role}
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-1.5 rounded-md text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
        >
          Cerrar sesión →
        </button>
      </div>
    </aside>
  )
}

// ---- Icons (inline SVG — sin dependencias) ----

function IconDeals({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  )
}

function IconPipeline({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 12V8a6 6 0 0 1 12 0v4" />
      <path d="M2 12h12" />
      <path d="M6 12v2" />
      <path d="M10 12v2" />
    </svg>
  )
}

function IconInvoice({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="1" width="12" height="14" rx="1.5" />
      <path d="M5 5h6M5 8h6M5 11h3" strokeLinecap="round" />
    </svg>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 13c0-2.76 2.24-5 5-5" />
      <circle cx="12" cy="5" r="2" />
      <path d="M10.5 8.5c.5-.1 1-.15 1.5-.15 1.93 0 3.5 1.57 3.5 3.5" />
    </svg>
  )
}
