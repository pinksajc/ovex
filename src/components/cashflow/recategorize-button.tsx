'use client'

import { useState, useTransition } from 'react'
import { recategorizeAllAction } from '@/app/actions/cashflow'

type State =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; updated: number }
  | { status: 'error'; message: string }

export function RecategorizeButton() {
  const [state, setState] = useState<State>({ status: 'idle' })
  const [, startTransition] = useTransition()

  function handleClick() {
    setState({ status: 'running' })
    startTransition(async () => {
      const result = await recategorizeAllAction()
      if (result.ok) {
        setState({ status: 'done', updated: result.updated })
        // Auto-reset after 4 s
        setTimeout(() => setState({ status: 'idle' }), 4000)
      } else {
        setState({ status: 'error', message: result.error ?? 'Error' })
        setTimeout(() => setState({ status: 'idle' }), 4000)
      }
    })
  }

  if (state.status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
        ✓ {state.updated} transacciones actualizadas
      </span>
    )
  }

  if (state.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
        Error: {state.message}
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state.status === 'running'}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-400 hover:text-zinc-900 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {state.status === 'running' ? (
        <>
          <span className="w-3 h-3 border border-zinc-400 border-t-zinc-700 rounded-full animate-spin" />
          Recategorizando…
        </>
      ) : (
        <>
          <IconRefresh className="w-3 h-3" />
          Recategorizar todo
        </>
      )}
    </button>
  )
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1.5 7A5.5 5.5 0 0 1 12 4.5" strokeLinecap="round" />
      <path d="M12.5 7A5.5 5.5 0 0 1 2 9.5" strokeLinecap="round" />
      <path d="M10 2.5 12 4.5 10 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7.5 2 9.5 4 11.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
