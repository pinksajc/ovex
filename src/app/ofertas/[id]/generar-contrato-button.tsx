'use client'

// "Generar contrato" button + modal form.
// Only rendered for accepted offers (enforced by the parent server component).
//
// Flow:
//   1. Click button → modal opens with defaults pre-filled
//   2. User reviews / edits fields
//   3. Click "Generar y descargar"
//      → saves record to Supabase (saveContratoAction)
//      → triggers PDF download from the API route

import { useState, useTransition } from 'react'
import { saveContratoAction } from '@/app/actions/contratos'

interface Props {
  presupuestoId: string
  dealId: string | null
  clientName: string
  clientCif: string | null
  clientAddress: string | null
}

export function GenerarContratoButton({
  presupuestoId,
  dealId,
  clientName,
  clientCif,
  clientAddress,
}: Props) {
  const [isOpen, setIsOpen]           = useState(false)
  const [isPending, startTransition]  = useTransition()
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)

  // Form state
  const today = new Date().toISOString().split('T')[0]
  const [duracion,    setDuracion]    = useState('12')
  const [permanencia, setPermanencia] = useState('12')
  const [pago,        setPago]        = useState('Transferencia bancaria')
  const [inicio,      setInicio]      = useState(today)
  const [notas,       setNotas]       = useState('')

  function buildDownloadUrl() {
    const params = new URLSearchParams({
      id:          presupuestoId,
      duracion:    duracion   || '12',
      permanencia: permanencia || '12',
      pago,
      inicio,
    })
    if (notas.trim()) params.set('notas', notas.trim())
    return `/api/contratos/generate-pdf?${params.toString()}`
  }

  function handleClose() {
    setIsOpen(false)
    setError(null)
    setSuccess(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const dur = parseInt(duracion,    10) || 12
    const per = parseInt(permanencia, 10) || 12

    startTransition(async () => {
      // 1. Save to DB
      const res = await saveContratoAction({
        presupuestoId,
        dealId,
        duracionMeses:    dur,
        permanenciaMeses: per,
        formaPago: pago,
        fechaInicio: inicio,
        notas: notas.trim() || null,
      })

      if (!res.ok) {
        setError(res.error)
        return
      }

      setSuccess(true)

      // 2. Trigger PDF download
      const url = buildDownloadUrl()
      const a = document.createElement('a')
      a.href = url
      a.download = `Contrato-${presupuestoId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Close modal after a short delay so the user sees the success state
      setTimeout(() => handleClose(), 1200)
    })
  }

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="1" width="10" height="12" rx="1.5" />
          <path d="M4 4h6M4 7h6M4 10h3" strokeLinecap="round" />
        </svg>
        Generar contrato
      </button>

      {/* ── Modal ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Generar contrato</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Configura los términos y descarga el PDF listo para firma.</p>
                </div>
                <button
                  onClick={handleClose}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">

                {/* ── Non-editable: Platomico ── */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Proveedor</p>
                  <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 space-y-0.5">
                    <p className="text-xs font-semibold text-zinc-800">Platomico, S.L.</p>
                    <p className="text-[11px] text-zinc-500">NIF: B22741094</p>
                    <p className="text-[11px] text-zinc-500">C/ Antonio Machado 9, Rozas de Puerto Real, Madrid 28649</p>
                    <p className="text-[11px] text-zinc-500">Representado por <span className="font-medium text-zinc-700">César Augusto Castro Sáder</span>, Administrador Único</p>
                  </div>
                </div>

                {/* ── Non-editable: Cliente ── */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Cliente</p>
                  <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 space-y-0.5">
                    <p className="text-xs font-semibold text-zinc-800">{clientName}</p>
                    {clientCif    && <p className="text-[11px] text-zinc-500">NIF/CIF: {clientCif}</p>}
                    {clientAddress && <p className="text-[11px] text-zinc-500">{clientAddress}</p>}
                  </div>
                </div>

                {/* ── Editable fields ── */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Términos del contrato</p>
                  <div className="grid grid-cols-2 gap-4">

                    {/* Duración */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                        Duración <span className="font-normal text-zinc-400">(meses)</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={duracion}
                        onChange={(e) => setDuracion(e.target.value)}
                        required
                        className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>

                    {/* Permanencia */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                        Período de permanencia <span className="font-normal text-zinc-400">(meses)</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={permanencia}
                        onChange={(e) => setPermanencia(e.target.value)}
                        required
                        className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>

                    {/* Forma de pago */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                        Forma de pago
                      </label>
                      <select
                        value={pago}
                        onChange={(e) => setPago(e.target.value)}
                        className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                      >
                        <option>Transferencia bancaria</option>
                        <option>Domiciliación bancaria (SEPA)</option>
                        <option>Tarjeta de crédito/débito</option>
                        <option>Cheque</option>
                      </select>
                    </div>

                    {/* Fecha de inicio */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                        Fecha de inicio
                      </label>
                      <input
                        type="date"
                        value={inicio}
                        onChange={(e) => setInicio(e.target.value)}
                        required
                        className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>

                  </div>

                  {/* Notas adicionales */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Notas adicionales <span className="font-normal text-zinc-400">(opcional)</span>
                    </label>
                    <textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      rows={3}
                      placeholder="Condiciones especiales, SLA personalizado…"
                      className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                    />
                  </div>
                </div>

                {/* Error / success */}
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    ✓ Contrato guardado y PDF descargando…
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isPending}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-800 px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center gap-2 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 14 14" fill="none">
                          <circle className="opacity-25" cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" />
                          <path className="opacity-75" fill="currentColor" d="M7 1.5A5.5 5.5 0 0 1 12.5 7h-2A3.5 3.5 0 0 0 7 3.5v-2z" />
                        </svg>
                        Generando…
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M2 11h10" strokeLinecap="round" />
                        </svg>
                        Generar y descargar PDF
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
