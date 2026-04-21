'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePresupuestoStatusAction } from '@/app/actions/presupuestos'
import type { PresupuestoStatus } from '@/types'

const TRANSITIONS: Record<PresupuestoStatus, { label: string; next: PresupuestoStatus; color: string }[]> = {
  draft: [
    { label: 'Marcar como Enviado', next: 'sent', color: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  ],
  sent: [
    { label: 'Marcar como Aceptado', next: 'accepted', color: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
    { label: 'Marcar como Rechazado', next: 'rejected', color: 'border-red-200 text-red-700 hover:bg-red-50' },
  ],
  accepted: [],
  rejected: [],
  expired: [
    { label: 'Marcar como Enviado', next: 'sent', color: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  ],
}

export function PresupuestoActions({ presupuestoId, currentStatus }: { presupuestoId: string; currentStatus: PresupuestoStatus }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const actions = TRANSITIONS[currentStatus]

  if (actions.length === 0) {
    return <p className="text-xs text-zinc-400 italic">No hay acciones disponibles para este estado.</p>
  }

  function handleAction(next: PresupuestoStatus) {
    setError(null)
    startTransition(async () => {
      const result = await updatePresupuestoStatusAction(presupuestoId, next)
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
