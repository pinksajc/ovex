'use client'

import { useTransition } from 'react'
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

  function handleClick(value: number) {
    if (value === initialValue) return
    startTransition(async () => {
      await updateCloseProbabilityAction(dealId, value)
      router.refresh()
    })
  }

  return (
    <div className={`flex items-center gap-1.5 flex-wrap transition-opacity ${isPending ? 'opacity-50' : ''}`}>
      {isPending && (
        <svg className="animate-spin w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {PROB_OPTIONS.map((v) => {
        const isSelected = v === initialValue
        return (
          <button
            key={v}
            onClick={() => handleClick(v)}
            disabled={isPending}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              isSelected
                ? SELECTED_COLORS[v]
                : 'border border-zinc-200 text-zinc-400 hover:bg-zinc-50'
            }`}
          >
            {v}%
          </button>
        )
      })}
    </div>
  )
}
