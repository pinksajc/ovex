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
        setTimeout(() => setState({ status: 'idle' }), 3000)
      } else {
        setState({ status: 'error', message: result.error ?? 'Error' })
        setTimeout(() => setState({ status: 'idle' }), 3000)
      }
    })
  }

  const isRunning = state.status === 'running'

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isRunning}
        title={
          state.status === 'done'
            ? `${state.updated} transacciones actualizadas`
            : state.status === 'error'
            ? state.message
            : 'Recategorizar todo'
        }
        className={`rounded-[6px] p-2 transition-colors disabled:cursor-not-allowed ${
          state.status === 'done'
            ? 'text-success bg-success/10 hover:bg-success/15'
            : state.status === 'error'
            ? 'text-danger bg-danger/10 hover:bg-danger/15'
            : 'text-text-tertiary hover:text-text-secondary hover:bg-hover'
        }`}
      >
        {isRunning ? (
          <span className="block w-4 h-4 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
        ) : (
          <IconRefresh className="w-4 h-4" />
        )}
      </button>

      {/* Ephemeral badge (done / error) */}
      {(state.status === 'done' || state.status === 'error') && (
        <span className={`absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap text-[10px] font-semibold px-2 py-1 rounded-[4px] shadow-sm pointer-events-none ${
          state.status === 'done'
            ? 'text-success bg-success/10 border border-success/20'
            : 'text-danger bg-danger/10 border border-danger/20'
        }`}>
          {state.status === 'done' ? `✓ ${state.updated} actualizadas` : state.message}
        </span>
      )}
    </div>
  )
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 8A6.5 6.5 0 0 1 13.5 4.5" />
      <path d="M14.5 8A6.5 6.5 0 0 1 2.5 11.5" />
      <path d="M11 2l2.5 2.5L11 7" />
      <path d="M5 9L2.5 11.5 5 14" />
    </svg>
  )
}
