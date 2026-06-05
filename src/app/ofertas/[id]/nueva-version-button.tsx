'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createVersionAction } from '@/app/actions/presupuestos'

export function NuevaVersionButton({ presupuestoId }: { presupuestoId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const result = await createVersionAction(presupuestoId)
    setLoading(false)
    if (result.ok && result.id) {
      router.push(`/ofertas/${result.id}`)
    } else {
      setError(result.error ?? 'Error al crear versión')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium border border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 1a6 6 0 1 1-6 6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 2v10M2 7h10" strokeLinecap="round" />
          </svg>
        )}
        Nueva versión
      </button>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  )
}
