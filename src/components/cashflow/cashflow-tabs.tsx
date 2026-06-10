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
    <div className="flex items-center bg-elevated border border-border-subtle rounded-[6px] p-0.5">
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
      className={`px-3 h-8 text-[13px] font-medium rounded-[4px] transition-colors duration-150 ${
        active
          ? 'bg-hover text-text-primary'
          : 'text-text-tertiary hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}
