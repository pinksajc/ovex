'use client'

import { useRouter, usePathname } from 'next/navigation'

type Tab = 'transactions' | 'planning' | 'loans'

interface CashflowTabsProps {
  activeTab: Tab
}

export function CashflowTabs({ activeTab }: CashflowTabsProps) {
  const router   = useRouter()
  const pathname = usePathname()

  function switchTab(tab: Tab) {
    const params = new URLSearchParams(window.location.search)
    if (tab === 'transactions') params.delete('tab')
    else params.set('tab', tab)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex items-center gap-0.5">
      <TabBtn active={activeTab === 'transactions'} onClick={() => switchTab('transactions')}>
        Transacciones
      </TabBtn>
      <span className="text-zinc-200 text-xs select-none">|</span>
      <TabBtn active={activeTab === 'planning'} onClick={() => switchTab('planning')}>
        Planificación
      </TabBtn>
      <span className="text-zinc-200 text-xs select-none">|</span>
      <TabBtn active={activeTab === 'loans'} onClick={() => switchTab('loans')}>
        Préstamos
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
      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
        active
          ? 'text-zinc-900'
          : 'text-zinc-400 hover:text-zinc-600'
      }`}
    >
      {children}
    </button>
  )
}
