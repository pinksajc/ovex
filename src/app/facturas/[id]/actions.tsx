'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateInvoiceStatusAction } from '@/app/actions/invoices'
import type { InvoiceStatus } from '@/types'

const TRANSITIONS: Record<InvoiceStatus, { label: string; next: InvoiceStatus; color: string; confirm?: boolean }[]> = {
  draft: [
    { label: 'Marcar como Emitida', next: 'issued', color: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  ],
  issued: [
    { label: 'Marcar como Pagada', next: 'paid', color: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
    { label: 'Marcar como Vencida', next: 'overdue', color: 'border-red-200 text-red-700 hover:bg-red-50' },
  ],
  paid: [
    { label: 'Revertir a Emitida', next: 'issued', color: 'border-amber-200 text-amber-700 hover:bg-amber-50', confirm: true },
  ],
  overdue: [
    { label: 'Marcar como Pagada', next: 'paid', color: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
  ],
}

export function InvoiceActions({ invoiceId, currentStatus }: { invoiceId: string; currentStatus: InvoiceStatus }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError]           = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast]           = useState<string | null>(null)

  // Auto-dismiss toast after 3 s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const actions = TRANSITIONS[currentStatus]

  function handleAction(next: InvoiceStatus, toastMsg?: string) {
    setError(null)
    startTransition(async () => {
      const result = await updateInvoiceStatusAction(invoiceId, next)
      if (!result.ok) {
        setError(result.error ?? 'Error desconocido')
      } else {
        if (toastMsg) setToast(toastMsg)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="space-y-2">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {actions.map(({ label, next, color, confirm }) => (
          <button
            key={next}
            onClick={() => confirm ? setConfirming(true) : handleAction(next)}
            disabled={isPending}
            className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${color}`}
          >
            {isPending ? 'Actualizando...' : label}
          </button>
        ))}
      </div>

      {/* ── Confirmation modal (revert to Emitida) ─────────────────────────── */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Revertir factura</h3>
            <p className="text-xs text-zinc-500 mb-5">
              ¿Revertir esta factura a estado <span className="font-semibold text-zinc-700">Emitida</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setConfirming(false)
                  handleAction('issued', 'Factura revertida a Emitida')
                }}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Actualizando...' : 'Revertir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </>
  )
}
