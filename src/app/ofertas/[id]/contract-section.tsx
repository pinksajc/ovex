'use client'

import { useState, useTransition, useRef } from 'react'
import {
  updateContractStartDateAction,
  uploadContractAction,
  removeContractAction,
} from '@/app/actions/contract'

interface ContractSectionProps {
  presupuestoId: string
  initialContractStartDate: string | null
  initialSignedContractUrl: string | null
  initialSignedContractFilename: string | null
  initialSignedAt: string | null
}

function formatDate(s: string | null) {
  if (!s) return null
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function ContractSection({
  presupuestoId,
  initialContractStartDate,
  initialSignedContractUrl,
  initialSignedContractFilename,
  initialSignedAt,
}: ContractSectionProps) {
  const [contractStartDate, setContractStartDate] = useState(initialContractStartDate ?? '')
  const [signedContractUrl, setSignedContractUrl] = useState(initialSignedContractUrl)
  const [signedContractFilename, setSignedContractFilename] = useState(initialSignedContractFilename)
  const [signedAt, setSignedAt] = useState(initialSignedAt)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleDateBlur() {
    const value = contractStartDate.trim() || null
    if (value === (initialContractStartDate ?? '')) return
    startTransition(async () => {
      setError(null)
      const res = await updateContractStartDateAction(presupuestoId, value)
      if (!res.ok) setError(res.error ?? 'Error')
      else showToast('Fecha guardada')
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('presupuestoId', presupuestoId)
    formData.append('file', file)
    startTransition(async () => {
      setError(null)
      const res = await uploadContractAction(formData)
      if (!res.ok) {
        setError(res.error ?? 'Error al subir')
      } else {
        setSignedContractUrl(res.url ?? null)
        setSignedContractFilename(res.filename ?? null)
        setSignedAt(new Date().toISOString())
        showToast('Contrato subido ✓')
      }
      // Reset input so the same file can be re-uploaded
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  function handleRemove() {
    startTransition(async () => {
      setError(null)
      const res = await removeContractAction(presupuestoId)
      if (!res.ok) {
        setError(res.error ?? 'Error')
      } else {
        setSignedContractUrl(null)
        setSignedContractFilename(null)
        setSignedAt(null)
        showToast('Contrato eliminado')
      }
    })
  }

  const hasContract = !!signedContractUrl

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Contrato</h2>
        {/* Status badge */}
        {hasContract ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Firmado ✓
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            Sin contrato
          </span>
        )}
      </div>

      {/* Contract start date */}
      <div className="mb-4">
        <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">
          Inicio de facturación
        </label>
        <input
          type="date"
          value={contractStartDate}
          onChange={(e) => setContractStartDate(e.target.value)}
          onBlur={handleDateBlur}
          disabled={isPending}
          className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50"
        />
      </div>

      {/* Signed contract */}
      <div>
        <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">
          Contrato firmado (PDF)
        </label>

        {hasContract ? (
          <div className="bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2.5 flex items-center gap-3">
            {/* File icon */}
            <svg className="w-5 h-5 text-red-500 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="1" width="12" height="14" rx="1.5" />
              <path d="M5 5h6M5 8h6M5 11h3" strokeLinecap="round" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-800 truncate">
                {signedContractFilename ?? 'contrato-firmado.pdf'}
              </p>
              {signedAt && (
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Subido el {formatDate(signedAt)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={signedContractUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold text-blue-700 hover:underline"
              >
                Descargar
              </a>
              <span className="text-zinc-200">·</span>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={isPending}
                className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
              >
                Reemplazar
              </button>
              <span className="text-zinc-200">·</span>
              <button
                onClick={handleRemove}
                disabled={isPending}
                className="text-[10px] font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="w-full border border-dashed border-zinc-200 hover:border-zinc-400 rounded-lg px-3 py-4 text-xs text-zinc-400 hover:text-zinc-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 12V4M5 7l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 13h12" strokeLinecap="round" />
            </svg>
            {isPending ? 'Subiendo…' : 'Subir contrato firmado'}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && (
        <p className="mt-3 text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-zinc-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
