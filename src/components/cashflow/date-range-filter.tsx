'use client'

import { useRouter, usePathname } from 'next/navigation'

interface DateRangeFilterProps {
  from: string  // "YYYY-MM-DD"
  to: string    // "YYYY-MM-DD"
}

export function DateRangeFilter({ from, to }: DateRangeFilterProps) {
  const router   = useRouter()
  const pathname = usePathname()

  function update(key: 'from' | 'to', value: string) {
    const params = new URLSearchParams(window.location.search)
    params.set(key, value)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 text-[13px] text-text-tertiary">
      <span className="font-medium text-text-tertiary uppercase tracking-widest text-[11px]">Desde</span>
      <input
        type="date"
        value={from}
        onChange={(e) => update('from', e.target.value)}
        className="bg-base border border-border-subtle rounded-[6px] px-2.5 h-9 text-[13px] text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <span className="font-medium text-text-tertiary uppercase tracking-widest text-[11px]">Hasta</span>
      <input
        type="date"
        value={to}
        onChange={(e) => update('to', e.target.value)}
        className="bg-base border border-border-subtle rounded-[6px] px-2.5 h-9 text-[13px] text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  )
}
