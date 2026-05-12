'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updatePresupuestoStatusAction, acceptContratoAction } from '@/app/actions/presupuestos'
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

// ---- Toast ----
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed bottom-6 right-6 z-[70] flex items-center gap-2.5 bg-emerald-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-2">
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 8l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </div>
  )
}

// ---- Modal ----
function AceptarContratoModal({
  presupuestoId,
  onClose,
  onSuccess,
}: {
  presupuestoId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const todayStr = new Date().toISOString().split('T')[0]

  const [hasFirmado, setHasFirmado]         = useState(false)
  const [contractRef, setContractRef]       = useState('')
  const [acceptanceDate, setAcceptanceDate] = useState(todayStr)
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [error, setError]                   = useState<string | null>(null)
  const [isPending, startTransition]        = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!contractRef.trim()) {
      setError('La referencia del contrato es obligatoria.')
      return
    }
    startTransition(async () => {
      const result = await acceptContratoAction(
        presupuestoId,
        contractRef.trim(),
        acceptanceDate,
        additionalNotes,
      )
      if (!result.ok) {
        setError(result.error ?? 'Error desconocido')
      } else {
        onSuccess()
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Aceptar bajo contrato</h2>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700 transition-colors text-lg leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasFirmado}
                onChange={(e) => setHasFirmado(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
              />
              <span className="text-xs text-zinc-700 leading-relaxed">
                El cliente ha firmado un contrato marco previo con Platomico
              </span>
            </label>

            {/* Referencia */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Referencia del contrato <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={contractRef}
                onChange={(e) => setContractRef(e.target.value)}
                placeholder="NDA-2026-001 / Contrato Marco Enero 2026"
                required
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Fecha de aceptación
              </label>
              <input
                type="date"
                value={acceptanceDate}
                onChange={(e) => setAcceptanceDate(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Notas adicionales <span className="text-zinc-400">(opcional)</span>
              </label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Condiciones adicionales, contexto…"
                rows={3}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isPending ? 'Guardando…' : 'Confirmar aceptación'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ---- Revert confirmation modal ----
function RevertirModal({
  onClose,
  onConfirm,
  isPending,
}: {
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Revertir estado</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors text-lg leading-none" aria-label="Cerrar">×</button>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-zinc-600 leading-relaxed">
              ¿Revertir esta oferta a estado <strong className="text-zinc-900">Enviado</strong>? Esta acción cambiará el estado actual.
            </p>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isPending ? 'Actualizando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ---- Main component ----
export function OfertaActions({
  presupuestoId,
  currentStatus,
}: {
  presupuestoId: string
  currentStatus: PresupuestoStatus
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [modalOpen, setModalOpen]       = useState(false)
  const [revertModalOpen, setRevertModalOpen] = useState(false)
  const [toast, setToast]               = useState<string | null>(null)

  const actions = TRANSITIONS[currentStatus]
  const showContratoBtn = currentStatus === 'draft' || currentStatus === 'sent'
  const showRevertBtn   = currentStatus === 'accepted' || currentStatus === 'rejected'

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

  function handleContratoSuccess() {
    setModalOpen(false)
    setToast('Oferta aceptada bajo contrato existente')
    router.refresh()
  }

  function handleRevert() {
    setError(null)
    startTransition(async () => {
      const result = await updatePresupuestoStatusAction(presupuestoId, 'sent')
      if (!result.ok) {
        setError(result.error ?? 'Error desconocido')
      } else {
        setRevertModalOpen(false)
        setToast('Estado revertido a Enviado')
        router.refresh()
      }
    })
  }

  if (actions.length === 0 && !showContratoBtn && !showRevertBtn) {
    return <p className="text-xs text-zinc-400 italic">No hay acciones disponibles para este estado.</p>
  }

  return (
    <>
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

        {showContratoBtn && (
          <button
            onClick={() => setModalOpen(true)}
            disabled={isPending}
            className="w-full text-left px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-medium transition-colors disabled:opacity-50"
          >
            Aceptar bajo contrato
          </button>
        )}

        {showRevertBtn && (
          <button
            onClick={() => setRevertModalOpen(true)}
            disabled={isPending}
            className="w-full text-left px-3 py-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 text-xs font-medium transition-colors disabled:opacity-50"
          >
            Volver a Enviado
          </button>
        )}
      </div>

      {revertModalOpen && (
        <RevertirModal
          onClose={() => setRevertModalOpen(false)}
          onConfirm={handleRevert}
          isPending={isPending}
        />
      )}

      {modalOpen && (
        <AceptarContratoModal
          presupuestoId={presupuestoId}
          onClose={() => setModalOpen(false)}
          onSuccess={handleContratoSuccess}
        />
      )}

      {toast && (
        <Toast message={toast} onDone={() => setToast(null)} />
      )}
    </>
  )
}
