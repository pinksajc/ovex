'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markSentForSignatureAction } from '@/app/actions/mark-sent'
import type { DocuSealStatus } from '@/types'

export function SendForSignatureButton({
  dealId,
  configId,
  sentAt,
  docusealStatus,
  signedAt,
  signerName,
  signerEmail,
}: {
  dealId: string
  configId: string
  sentAt: string | null
  docusealStatus: DocuSealStatus
  signedAt: string | null
  signerName: string
  signerEmail: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function send() {
    setError(null)
    startTransition(async () => {
      const result = await markSentForSignatureAction(dealId, configId, signerName, signerEmail)
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error ?? 'Error desconocido')
      }
    })
  }

  // ── Signed ──
  if (docusealStatus === 'completed' || signedAt) {
    const date = new Date(signedAt ?? sentAt ?? '').toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 text-white px-3 py-1.5 rounded-lg">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Firmado ✓ · {date}
      </span>
    )
  }

  // ── Pending DocuSeal signature ──
  if (docusealStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        Pendiente firma…
      </span>
    )
  }

  // ── Sent without DocuSeal (legacy fallback) ──
  if (sentAt && !docusealStatus) {
    const date = new Date(sentAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Enviado · {date}
      </span>
    )
  }

  // ── Declined / expired → allow re-send ──
  const isRetry = docusealStatus === 'declined' || docusealStatus === 'expired'
  const retryLabel = docusealStatus === 'declined' ? 'Rechazado' : 'Expirado'

  // ── Send / re-send button ──
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={isPending}
        onClick={send}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isRetry
            ? 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
            : 'bg-zinc-900 text-white hover:bg-zinc-700'
        }`}
      >
        {isPending ? (
          <>
            <span className={`w-2 h-2 rounded-full border animate-spin shrink-0 ${isRetry ? 'border-red-300 border-t-red-600' : 'border-white/40 border-t-white'}`} />
            Enviando…
          </>
        ) : (
          <>
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1.5 6h9M7 2.5l4 3.5-4 3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isRetry ? `${retryLabel} · Reenviar` : 'Enviar para firma'}
          </>
        )}
      </button>
      {error && (
        <span className="text-[10px] text-red-500 max-w-[220px] text-right leading-tight">{error}</span>
      )}
    </div>
  )
}
