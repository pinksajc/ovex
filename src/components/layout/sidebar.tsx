'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase/auth'
import type { AuthUser } from '@/lib/auth'
import { canAccess, type Module } from '@/lib/permissions'

interface NavItem {
  href: string
  label: string
  icon: ({ className }: { className?: string }) => React.JSX.Element
  module: Module
}

// All modules — filtered at render time based on user.role
const MAIN_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard, module: 'dashboard' },
  { href: '/leads',     label: 'Leads',     icon: IconLeads,     module: 'leads'     },
  { href: '/deals',     label: 'Deals',     icon: IconDeals,     module: 'deals'     },
  { href: '/pipeline',  label: 'Pipeline',  icon: IconPipeline,  module: 'pipeline'  },
  { href: '/ofertas',   label: 'Ofertas',   icon: IconQuote,     module: 'ofertas'   },
  { href: '/facturas',  label: 'Facturas',  icon: IconInvoice,   module: 'facturas'  },
]

const FINANCE_NAV: NavItem[] = [
  { href: '/cashflow', label: 'Flujo de Caja', icon: IconCashflow, module: 'cashflow' },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/gestiones', label: 'Gestiones', icon: IconGestiones, module: 'gestiones' },
  { href: '/usuarios',  label: 'Usuarios',  icon: IconUsers,     module: 'usuarios'  },
]

export function Sidebar({
  user,
  pendingBillingCount = 0,
  pendingGestionesCount = 0,
}: {
  user: AuthUser
  pendingBillingCount?: number
  pendingGestionesCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createAuthBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const visibleMain    = MAIN_NAV.filter(({ module }) => canAccess(user.role, module))
  const visibleFinance = FINANCE_NAV.filter(({ module }) => canAccess(user.role, module))
  const visibleAdmin   = ADMIN_NAV.filter(({ module }) => canAccess(user.role, module))

  function navLink({ href, label, icon: Icon }: NavItem) {
    const active =
      href === '/dashboard'
        ? pathname === '/dashboard'
        : pathname.startsWith(href)

    const badge =
      href === '/facturas'  && pendingBillingCount  > 0 ? pendingBillingCount  :
      href === '/gestiones' && pendingGestionesCount > 0 ? pendingGestionesCount :
      0

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
        <span className="flex-1">{label}</span>
        {badge > 0 && (
          <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <Image
          src="/orvex-wordmark.png"
          alt="Orvex"
          width={100}
          height={28}
          className="invert"
          priority
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleMain.map((item) => navLink(item))}

        {visibleFinance.length > 0 && (
          <>
            <div className="pt-3 pb-1 px-3">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                Finanzas
              </span>
            </div>
            {visibleFinance.map((item) => navLink(item))}
          </>
        )}

        {visibleAdmin.length > 0 && (
          <>
            <div className="pt-3 pb-1 px-3">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                Admin
              </span>
            </div>
            {visibleAdmin.map((item) => navLink(item))}
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

function IconQuote({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="1" width="12" height="14" rx="1.5" />
      <path d="M5 5h6M5 8h4" strokeLinecap="round" />
      <path d="M5 11h2.5M9.5 11l1 1.5 1-1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconLeads({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-3 2-4.5 5-4.5s5 1.5 5 4.5" strokeLinecap="round" />
      <path d="M11 2.5a2.5 2.5 0 010 5M15 14c0-2.5-1.5-4-3.5-4.5" strokeLinecap="round" />
    </svg>
  )
}

function IconGestiones({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 4h12M2 8h8M2 12h5" strokeLinecap="round" />
      <circle cx="13" cy="11" r="2.5" />
      <path d="M12 11l.8.8 1.7-1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
