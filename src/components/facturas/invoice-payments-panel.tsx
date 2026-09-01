'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { addPaymentAction, deletePaymentAction } from '@/app/actions/invoice-payments'
import type { InvoicePayment } from '@/lib/supabase/invoice-payments'

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  invoiceId: string
  invoiceTotal: number
  initialPayments: InvoicePayment[]
  invoiceStatus: string
}

export function InvoicePaymentsPanel({ invoiceId, invoiceTotal, initialPayments, invoiceStatus }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [optimisticPayments, addOptimistic] = useOptimistic(
    initialPayments,
    (state: InvoicePayment[], action: { type: 'add'; payment: InvoicePayment } | { type: 'delete'; id: string }) => {
      if (action.type === 'add') return [...state, action.payment]
      if (action.type === 'delete') return state.filter((p) => p.id !== action.id)
      return state
    },
  )

  // Form state
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(today())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const totalPaid = optimisticPayments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, invoiceTotal - totalPaid)
  const pctPaid = invoiceTotal > 0 ? Math.min(100, (totalPaid / invoiceTotal) * 100) : 0
  const isFullyPaid = totalPaid >= invoiceTotal

  const canAdd = invoiceStatus !== 'draft' && invoiceStatus !== 'converted'

  const handleAdd = () => {
    setError(null)
    const parsed = parseFloat(amount.replace(',', '.'))
    if (!parsed || parsed <= 0) { setError('Introduce un monto válido'); return }
    if (!paidAt) { setError('Selecciona una fecha'); return }

    const tempId = `temp-${Date.now()}`
    const optimistic: InvoicePayment = {
      id: tempId,
      invoiceId,
      amount: parsed,
      paidAt,
      notes: notes.trim() || null,
      createdBy: null,
      createdAt: new Date().toISOString(),
    }

    startTransition(async () => {
      addOptimistic({ type: 'add', payment: optimistic })
      try {
        await addPaymentAction(invoiceId, parsed, paidAt, notes)
        setAmount('')
        setNotes('')
        setPaidAt(today())
        setShowForm(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al registrar el pago')
      }
    })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      addOptimistic({ type: 'delete', id })
      try {
        await deletePaymentAction(id, invoiceId)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al eliminar el pago')
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Pagos registrados</h2>
        {canAdd && !isFullyPaid && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 uppercase tracking-wide transition-colors"
          >
            + Añadir pago
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-zinc-500">
            Pagado: <span className="font-mono font-semibold text-zinc-800">{formatEur(totalPaid)}</span>
          </span>
          <span className="text-zinc-400">
            {isFullyPaid ? (
              <span className="text-emerald-600 font-semibold">Pagado completo ✓</span>
            ) : (
              <>Pendiente: <span className="font-mono font-semibold text-zinc-700">{formatEur(remaining)}</span></>
            )}
          </span>
        </div>
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isFullyPaid ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${pctPaid}%` }}
          />
        </div>
        <p className="text-right text-[10px] text-zinc-400 mt-1">{Math.round(pctPaid)}% del total {formatEur(invoiceTotal)}</p>
      </div>

      {/* Payments list */}
      {optimisticPayments.length === 0 && !showForm && (
        <p className="text-xs text-zinc-400 text-center py-3">Sin pagos registrados</p>
      )}

      {optimisticPayments.length > 0 && (
        <div className="divide-y divide-zinc-50 mb-3">
          {optimisticPayments.map((p) => (
            <div
              key={p.id}
              className={`flex items-start justify-between py-2.5 group ${deletingId === p.id ? 'opacity-40' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-zinc-900">{formatEur(p.amount)}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{formatDate(p.paidAt)}</p>
                {p.notes && <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{p.notes}</p>}
              </div>
              {canAdd && (
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={isPending || p.id.startsWith('temp-')}
                  className="ml-3 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all disabled:opacity-30 text-[10px] shrink-0"
                  title="Eliminar pago"
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && canAdd && (
        <div className="border-t border-zinc-100 pt-4 mt-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1 block">Monto (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 font-mono"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1 block">Fecha de pago</label>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1 block">Notas (opcional)</label>
            <input
              type="text"
              placeholder="Transferencia, referencia…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </div>
          {error && <p className="text-[10px] text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={isPending}
              className="flex-1 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? 'Guardando…' : 'Registrar pago'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); setAmount(''); setNotes('') }}
              className="text-xs text-zinc-400 hover:text-zinc-700 px-3 py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
