'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/deals', label: 'Deals', icon: IconDeals },
  { href: '/pipeline', label: 'Pipeline', icon: IconPipeline },
]

export function Sidebar() {
  const pathname = usePathname()

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
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">v0.1 · internal</p>
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
