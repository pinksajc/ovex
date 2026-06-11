'use client'

import { useState, useTransition } from 'react'
import { updateDueDateAction } from '@/app/actions/invoices'

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface Props {
  invoiceId: string
  dueAt: string | null
  dueDateEnabled: boolean
}

export function DueDateEditor({ invoiceId, dueAt, dueDateEnabled }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(dueAt?.slice(0, 10) ?? '')
  const [currentDueAt, setCurrentDueAt] = useState(dueAt)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!dueDateEnabled) return <span>—</span>

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateDueDateAction(invoiceId, value || null)
      if (result.ok) {
        setCurrentDueAt(value || null)
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        setError(result.error ?? 'Error al guardar')
      }
    })
  }

  const handleCancel = () => {
    setValue(currentDueAt?.slice(0, 10) ?? '')
    setError(null)
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1.5">
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            className="text-xs border border-zinc-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-400"
          />
          <button
            onClick={handleSave}
            disabled={isPending}
            title="Confirmar"
            className="text-emerald-600 hover:text-emerald-800 disabled:opacity-40 text-sm font-bold leading-none"
          >
            ✓
          </button>
          <button
            onClick={handleCancel}
            disabled={isPending}
            title="Cancelar"
            className="text-red-400 hover:text-red-600 disabled:opacity-40 text-sm font-bold leading-none"
          >
            ✗
          </button>
        </span>
        {error && <span className="text-[10px] text-red-600">{error}</span>}
      </span>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 group text-right"
      title="Editar fecha de vencimiento"
    >
      <span className="text-xs font-medium text-zinc-800">
        {formatDate(currentDueAt)}
      </span>
      <svg
        className="w-3 h-3 text-zinc-300 group-hover:text-zinc-500 transition-colors flex-shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 1.5l2.5 2.5L3.5 11H1v-2.5L8 1.5z" />
      </svg>
      {saved && (
        <span className="text-[10px] text-emerald-500 font-medium">✓ Guardado</span>
      )}
    </button>
  )
}
