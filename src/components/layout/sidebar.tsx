'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase/auth'
import type { AuthUser } from '@/lib/auth'
import { OrvexLogo } from '@/components/ui/orvex-logo'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
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

  const initials = (user.name ?? user.email)
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()

  return (
    <aside
      className="w-56 shrink-0 flex flex-col h-full border-r border-border-subtle"
      style={{ background: '#101013' }}
    >
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-subtle">
        <OrvexLogo size="md" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : href === '/deals'
              ? pathname.startsWith('/deals')
              : href === '/facturas'
              ? pathname.startsWith('/facturas') || pathname.startsWith('/ofertas')
              : pathname === href

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 rounded-[6px] text-[13px] transition-colors duration-150 h-8 ${
                active
                  ? 'bg-accent-muted text-accent-text'
                  : 'text-text-secondary hover:bg-hover hover:text-text-primary'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : ''}`}
              />
              {label}
            </Link>
          )
        })}

        {/* Owner-only: Flujo de Caja */}
        {(user.role === 'owner' || user.role === 'admin') && (
          <>
            <div className="pt-4 pb-1.5 px-3">
              <span className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
                Finanzas
              </span>
            </div>
            <Link
              href="/cashflow"
              className={`flex items-center gap-2.5 px-3 rounded-[6px] text-[13px] transition-colors duration-150 h-8 ${
                pathname.startsWith('/cashflow')
                  ? 'bg-accent-muted text-accent-text'
                  : 'text-text-secondary hover:bg-hover hover:text-text-primary'
              }`}
            >
              <IconCashflow
                className={`w-4 h-4 shrink-0 ${pathname.startsWith('/cashflow') ? 'text-accent' : ''}`}
              />
              Flujo de Caja
            </Link>
          </>
        )}

        {/* Admin-only section */}
        {(user.role === 'admin' || user.role === 'owner') && (
          <>
            <div className="pt-4 pb-1.5 px-3">
              <span className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
                Admin
              </span>
            </div>
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 rounded-[6px] text-[13px] transition-colors duration-150 h-8 ${
                    active
                      ? 'bg-accent-muted text-accent-text'
                      : 'text-text-secondary hover:bg-hover hover:text-text-primary'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : ''}`}
                  />
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User profile + logout */}
      <div className="px-3 py-3 border-t border-border-subtle">
        <div className="flex items-start gap-2.5 px-1 mb-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'rgba(124,114,232,0.12)' }}
          >
            <span className="text-[11px] font-semibold text-accent-text font-mono">
              {initials}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-text-primary truncate leading-snug">
              {user.name ?? user.email.split('@')[0]}
            </p>
            <p className="text-[11px] text-text-tertiary truncate leading-snug">
              {user.email}
            </p>
            <span className="inline-block mt-1 text-[10px] font-medium uppercase tracking-wide text-text-tertiary bg-border-subtle px-1.5 py-0.5 rounded-[4px]">
              {user.role}
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-1.5 rounded-[6px] text-[13px] text-text-tertiary hover:bg-hover hover:text-text-secondary transition-colors duration-150"
        >
          Cerrar sesión →
        </button>
      </div>
    </aside>
  )
}

// ---- Icons (inline SVG — sin dependencias) ----

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="3" rx="1" />
      <rect x="9" y="7" width="5" height="7" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
    </svg>
  )
}

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

function IconCashflow({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M1 6h14" strokeLinecap="round" />
      <path d="M4 10h2M10 10h2" strokeLinecap="round" />
    </svg>
  )
}
