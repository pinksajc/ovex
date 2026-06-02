'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  listCategoriesAction,
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
} from '@/app/actions/cashflow-categories'
import type { CategoryWithCount } from '@/app/actions/cashflow-categories'

// ── Colour palette for new categories ─────────────────────────────────────────

const COLOR_PALETTE = [
  '#22c55e', '#ef4444', '#f97316', '#6366f1', '#eab308',
  '#3b82f6', '#f43f5e', '#8b5cf6', '#06b6d4', '#14b8a6',
  '#0ea5e9', '#a855f7', '#ec4899', '#f59e0b', '#64748b',
  '#94a3b8', '#10b981', '#6b7280',
]

function nextColor(existing: (string | null)[]): string {
  const used = new Set(existing.filter(Boolean))
  return COLOR_PALETTE.find((c) => !used.has(c)) ?? COLOR_PALETTE[existing.length % COLOR_PALETTE.length]
}

// ── Category dot ──────────────────────────────────────────────────────────────

function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
      style={{ background: color ?? '#94a3b8' }}
    />
  )
}

// ── Inline rename row ─────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  allCategories,
  onRenamed,
  onDeleted,
}: {
  cat: CategoryWithCount
  allCategories: CategoryWithCount[]
  onRenamed: (oldName: string, newName: string) => void
  onDeleted: (name: string) => void
}) {
  const [editing, setEditing]         = useState(false)
  const [nameVal, setNameVal]         = useState(cat.name)
  const [showDelete, setShowDelete]   = useState(false)
  const [reassignTo, setReassignTo]   = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  // Reset if cat changes (after reload)
  useEffect(() => {
    setNameVal(cat.name)
    setEditing(false)
    setShowDelete(false)
    setError(null)
  }, [cat.name])

  function handleRename() {
    const trimmed = nameVal.trim()
    if (!trimmed || trimmed === cat.name) { setEditing(false); return }
    startTransition(async () => {
      const res = await renameCategoryAction(cat.id ?? '', cat.name, trimmed)
      if (res.ok) {
        onRenamed(cat.name, trimmed)
        setEditing(false)
        setError(null)
      } else {
        setError(res.error ?? 'Error al renombrar')
      }
    })
  }

  function handleDelete() {
    if (cat.txCount > 0 && !reassignTo) {
      setError('Selecciona una categoría destino para reasignar las transacciones')
      return
    }
    startTransition(async () => {
      const res = await deleteCategoryAction(cat.id, cat.name, reassignTo || undefined)
      if (res.ok) {
        onDeleted(cat.name)
        setShowDelete(false)
        setError(null)
      } else {
        setError(res.error ?? 'Error al eliminar')
      }
    })
  }

  const otherCats = allCategories.filter((c) => c.name !== cat.name)

  return (
    <div className="group">
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 rounded-lg transition-colors">
        {/* Dot */}
        <ColorDot color={cat.color} />

        {/* Name — inline edit or display */}
        {editing ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') { setEditing(false); setNameVal(cat.name) }
            }}
            onBlur={handleRename}
            disabled={isPending}
            className="flex-1 text-sm bg-white border border-blue-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
          />
        ) : (
          <span className="flex-1 text-sm text-zinc-800 font-medium truncate">{cat.name}</span>
        )}

        {/* Count badge */}
        <span className={`text-[11px] font-mono tabular-nums shrink-0 ${
          cat.txCount > 0 ? 'text-zinc-400' : 'text-zinc-300'
        }`}>
          {cat.txCount}
        </span>

        {/* Actions */}
        {!editing && !showDelete && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => { setEditing(true); setError(null) }}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              title="Renombrar"
            >
              <PencilIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setShowDelete(true); setError(null) }}
              className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Eliminar"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleRename}
              disabled={isPending}
              className="px-2.5 py-1 text-xs font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? '…' : 'Guardar'}
            </button>
            <button
              onClick={() => { setEditing(false); setNameVal(cat.name) }}
              disabled={isPending}
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Delete panel */}
      {showDelete && (
        <div className="mx-4 mb-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl space-y-3">
          <p className="text-xs font-medium text-red-700">
            {cat.txCount > 0
              ? `Esta categoría tiene ${cat.txCount} transacción${cat.txCount !== 1 ? 'es' : ''}. Reasígnalas antes de eliminar.`
              : `¿Eliminar "${cat.name}"?`}
          </p>
          {cat.txCount > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1">
                Reasignar a
              </label>
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                className="w-full text-xs bg-white border border-red-200 rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-red-300"
              >
                <option value="">— Selecciona categoría —</option>
                {otherCats.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={isPending || (cat.txCount > 0 && !reassignTo)}
              className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button
              onClick={() => { setShowDelete(false); setReassignTo(''); setError(null) }}
              disabled={isPending}
              className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && !showDelete && (
        <p className="mx-4 text-xs text-red-500 pb-1">{error}</p>
      )}
    </div>
  )
}

// ── Create category form ───────────────────────────────────────────────────────

function CreateCategoryForm({
  existingColors,
  onCreated,
}: {
  existingColors: (string | null)[]
  onCreated: (name: string, color: string) => void
}) {
  const [name, setName]       = useState('')
  const [color, setColor]     = useState(() => nextColor([]))
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTx]  = useTransition()

  // Pick a colour suggestion whenever existing changes
  useEffect(() => {
    setColor(nextColor(existingColors))
  }, [existingColors.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('El nombre no puede estar vacío'); return }
    startTx(async () => {
      const res = await createCategoryAction(trimmed, color)
      if (res.ok) {
        onCreated(trimmed, color)
        setName('')
        setError(null)
      } else {
        setError(res.error ?? 'Error al crear')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-4 border-t border-zinc-100 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        Nueva categoría
      </p>
      <div className="flex items-center gap-2">
        {/* Colour picker */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {/* cycle next colour */
              const idx = (COLOR_PALETTE.indexOf(color) + 1) % COLOR_PALETTE.length
              setColor(COLOR_PALETTE[idx])
            }}
            className="w-7 h-7 rounded-full border-2 border-white shadow-sm ring-1 ring-zinc-200 hover:scale-110 transition-transform"
            style={{ background: color }}
            title="Cambiar color"
          />
        </div>
        {/* Name input */}
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          placeholder="Nombre de la categoría…"
          disabled={isPending}
          className="flex-1 text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 placeholder:text-zinc-400 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="px-3 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {isPending ? '…' : 'Añadir'}
        </button>
      </div>
      {/* Colour palette row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${
              color === c ? 'border-zinc-900 scale-110' : 'border-transparent'
            }`}
            style={{ background: c }}
            title={c}
          />
        ))}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export function ManageCategoriesModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await listCategoriesAction()
    if (res.ok && res.data) {
      setCategories(res.data)
    } else {
      setLoadError(res.error ?? 'Error cargando categorías')
    }
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleRenamed(oldName: string, newName: string) {
    setCategories((prev) =>
      prev.map((c) => c.name === oldName ? { ...c, name: newName } : c)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    )
    router.refresh()
  }

  function handleDeleted(name: string) {
    setCategories((prev) => prev.filter((c) => c.name !== name))
    router.refresh()
  }

  function handleCreated(name: string, color: string) {
    setCategories((prev) =>
      [...prev, { id: null, name, color, txCount: 0 }]
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    )
    router.refresh()
  }

  const existingColors = categories.map((c) => c.color)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Gestionar categorías</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {loading ? 'Cargando…' : `${categories.length} categorías · haz clic en el lápiz para renombrar`}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable list */}
        <div className="flex-1 overflow-y-auto py-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-5 h-5 text-zinc-300 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
              </svg>
            </div>
          ) : loadError ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-red-500">{loadError}</p>
              <button onClick={reload} className="mt-3 text-xs text-zinc-500 hover:text-zinc-700 underline">
                Reintentar
              </button>
            </div>
          ) : categories.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-zinc-400">
              No hay categorías todavía. Crea la primera abajo.
            </p>
          ) : (
            <div className="px-2">
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 pb-1">
                <span className="w-2.5 shrink-0" />
                <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Nombre</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 shrink-0 w-8 text-right">Txs</span>
                <span className="w-16 shrink-0" />
              </div>
              {categories.map((cat) => (
                <CategoryRow
                  key={cat.name}
                  cat={cat}
                  allCategories={categories}
                  onRenamed={handleRenamed}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          )}
        </div>

        {/* Create form — pinned to bottom */}
        {!loading && !loadError && (
          <CreateCategoryForm
            existingColors={existingColors}
            onCreated={handleCreated}
          />
        )}
      </div>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8.5 1.5 10.5 3.5 4 10H2V8L8.5 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h10M4 3V1.5h4V3M5 5.5v3M7 5.5v3M2 3l.75 7.5h6.5L10 3" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 1l10 10M11 1L1 11" />
    </svg>
  )
}
