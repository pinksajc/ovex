'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateCloseProbabilityAction } from '@/app/actions/deals'

const PROB_OPTIONS = [0, 25, 50, 75, 100] as const

const SELECTED_COLORS: Record<number, string> = {
  0:   'bg-zinc-100 text-zinc-500',
  25:  'bg-red-50 text-red-600',
  50:  'bg-orange-50 text-orange-600',
  75:  'bg-blue-50 text-blue-700',
  100: 'bg-emerald-50 text-emerald-700',
}

interface Props {
  dealId: string
  initialValue: number
}

export function CloseProbabilitySelector({ dealId, initialValue }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState(initialValue)
  const [toast, setToast] = useState<string | null>(null)

  // Sync if server re-renders with a new initialValue
  useEffect(() => { setSelected(initialValue) }, [initialValue])

  // Auto-dismiss toast after 3 s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function handleClick(value: number) {
    if (value === selected || isPending) return
    setSelected(value) // optimistic update
    startTransition(async () => {
      await updateCloseProbabilityAction(dealId, value)
      setToast('Probabilidad actualizada')
      router.refresh()
    })
  }

  return (
    <div>
      <div className={`flex items-center gap-1.5 flex-wrap transition-opacity ${isPending ? 'opacity-60' : ''}`}>
        {PROB_OPTIONS.map((v) => {
          const isSelected = v === selected
          return (
            <button
              key={v}
              onClick={() => handleClick(v)}
              disabled={isPending}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                isSelected
                  ? SELECTED_COLORS[v]
                  : 'border border-zinc-200 text-zinc-400 hover:bg-zinc-50'
              }`}
            >
              {v}%
            </button>
          )
        })}
        {isPending && (
          <svg className="animate-spin w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <p className="mt-2 text-[11px] text-emerald-600 font-medium">{toast}</p>
      )}
    </div>
  )
}
