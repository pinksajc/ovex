'use client'

import { useRouter, usePathname } from 'next/navigation'

interface CashflowTabsProps {
  activeTab: 'transactions' | 'planning'
}

export function CashflowTabs({ activeTab }: CashflowTabsProps) {
  const router   = useRouter()
  const pathname = usePathname()

  function switchTab(tab: 'transactions' | 'planning') {
    const params = new URLSearchParams(window.location.search)
    if (tab === 'transactions') params.delete('tab')
    else params.set('tab', tab)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex items-center gap-0.5 bg-zinc-100 rounded-xl p-1">
      <TabBtn active={activeTab === 'transactions'} onClick={() => switchTab('transactions')}>
        Transacciones
      </TabBtn>
      <TabBtn active={activeTab === 'planning'} onClick={() => switchTab('planning')}>
        Planificación
      </TabBtn>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-white text-zinc-900 shadow-sm'
          : 'text-zinc-500 hover:text-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}
