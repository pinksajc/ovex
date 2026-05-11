'use client'

import { useState, useTransition } from 'react'
import { toggleRequiresSignatureAction } from '@/app/actions/presupuestos'

export function RequiresSignatureToggle({
  presupuestoId,
  initialValue,
}: {
  presupuestoId: string
  initialValue: boolean
}) {
  const [enabled, setEnabled]     = useState(initialValue)
  const [isPending, startTransition] = useTransition()
  const [error, setError]         = useState<string | null>(null)

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    setError(null)
    startTransition(async () => {
      const result = await toggleRequiresSignatureAction(presupuestoId, next)
      if (!result.ok) {
        setEnabled(!next) // revert
        setError(result.error ?? 'Error al guardar')
      }
    })
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="flex items-center justify-between w-full group disabled:opacity-60"
        aria-pressed={enabled}
      >
        <span className="text-xs font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors">
          Requiere firma
        </span>
        {/* Toggle switch */}
        <span
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
            enabled ? 'bg-emerald-500' : 'bg-zinc-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </span>
      </button>

      {isPending && (
        <p className="text-[10px] text-zinc-400">Guardando…</p>
      )}
      {error && (
        <p className="text-[10px] text-red-500">{error}</p>
      )}
      {enabled && !isPending && (
        <p className="text-[10px] text-emerald-600">
          El PDF incluirá bloque de firmas
        </p>
      )}
    </div>
  )
}
