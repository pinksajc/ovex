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
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span className="font-medium text-zinc-400 uppercase tracking-widest text-[10px]">Desde</span>
      <input
        type="date"
        value={from}
        onChange={(e) => update('from', e.target.value)}
        className="bg-zinc-100 border-0 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <span className="font-medium text-zinc-400 uppercase tracking-widest text-[10px]">Hasta</span>
      <input
        type="date"
        value={to}
        onChange={(e) => update('to', e.target.value)}
        className="bg-zinc-100 border-0 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
      />
    </div>
  )
}
