'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateInvoiceStatusAction } from '@/app/actions/invoices'
import type { InvoiceStatus } from '@/types'

const TRANSITIONS: Record<InvoiceStatus, { label: string; next: InvoiceStatus; color: string }[]> = {
  draft: [
    { label: 'Marcar como Emitida', next: 'issued', color: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  ],
  issued: [
    { label: 'Marcar como Pagada', next: 'paid', color: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
    { label: 'Marcar como Vencida', next: 'overdue', color: 'border-red-200 text-red-700 hover:bg-red-50' },
  ],
  paid: [],
  overdue: [
    { label: 'Marcar como Pagada', next: 'paid', color: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
  ],
}

export function InvoiceActions({ invoiceId, currentStatus }: { invoiceId: string; currentStatus: InvoiceStatus }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const actions = TRANSITIONS[currentStatus]

  if (actions.length === 0) {
    return <p className="text-xs text-zinc-400 italic">No hay acciones disponibles para este estado.</p>
  }

  function handleAction(next: InvoiceStatus) {
    setError(null)
    startTransition(async () => {
      const result = await updateInvoiceStatusAction(invoiceId, next)
      if (!result.ok) {
        setError(result.error ?? 'Error desconocido')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {actions.map(({ label, next, color }) => (
        <button
          key={next}
          onClick={() => handleAction(next)}
          disabled={isPending}
          className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${color}`}
        >
          {isPending ? 'Actualizando...' : label}
        </button>
      ))}
    </div>
  )
}
