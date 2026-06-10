'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addManualTransactionAction } from '@/app/actions/cashflow'
import { CASHFLOW_CATEGORIES } from '@/lib/cashflow-categories'

interface FormState {
  date: string
  description: string
  amount: string
  type: 'income' | 'expense'
  category: string
  notes: string
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function defaultForm(): FormState {
  return {
    date: todayISO(),
    description: '',
    amount: '',
    type: 'income',
    category: 'Ingreso cliente',
    notes: '',
  }
}

export function AddTransactionButton() {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [form, setForm]         = useState<FormState>(defaultForm)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTrans] = useTransition()

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleTypeChange(t: 'income' | 'expense') {
    setForm((f) => ({
      ...f,
      type: t,
      category: t === 'income' ? 'Ingreso cliente' : 'Sin categoría',
    }))
  }

  function handleOpen() {
    setForm(defaultForm())
    setError(null)
    setOpen(true)
  }

  function handleClose() {
    if (!isPending) setOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      setError('El importe debe ser mayor que 0')
      return
    }
    if (!form.description.trim()) {
      setError('La descripción es obligatoria')
      return
    }
    startTrans(async () => {
      const result = await addManualTransactionAction({
        date: form.date,
        description: form.description.trim(),
        amount,
        type: form.type,
        category: form.category,
        notes: form.notes.trim() || undefined,
      })
      if (result.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Error al guardar')
      }
    })
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 hover:border-zinc-400 px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <PlusIcon className="w-3 h-3" />
        Añadir
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Nueva transacción</h2>
              <button
                onClick={handleClose}
                disabled={isPending}
                className="text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Tipo toggle */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Tipo
                </label>
                <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 w-fit">
                  {(['income', 'expense'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={`px-5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        form.type === t
                          ? 'bg-white text-zinc-900 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      {t === 'income' ? 'Ingreso' : 'Gasto'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha + Importe row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => set('date', e.target.value)}
                    required
                    className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Importe (€)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => set('amount', e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  required
                  placeholder="Ej. Factura cliente XYZ"
                  className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Categoría
                </label>
                <select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                >
                  {CASHFLOW_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Notas <span className="normal-case font-normal text-zinc-400">(opcional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  placeholder="Información adicional…"
                  className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors px-2 py-1.5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 1v10M1 6h10" />
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
