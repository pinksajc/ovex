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
  declineReason,
}: {
  dealId: string
  configId: string
  sentAt: string | null
  docusealStatus: DocuSealStatus
  signedAt: string | null
  signerName: string
  signerEmail: string
  declineReason?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Optimistic local status — overrides prop immediately after a successful send
  const [localStatus, setLocalStatus] = useState<DocuSealStatus>(null)

  // Effective status: local optimistic state wins over server prop
  const effectiveStatus = localStatus ?? docusealStatus

  function send() {
    setError(null)
    startTransition(async () => {
      const result = await markSentForSignatureAction(dealId, configId, signerName, signerEmail)
      if (result.ok) {
        setLocalStatus('pending') // show pending immediately
        router.refresh()          // sync server state in background
      } else {
        setError(result.error ?? 'Error desconocido')
      }
    })
  }

  // ── Signed ──
  if (effectiveStatus === 'completed' || signedAt) {
    const date = new Date(signedAt ?? sentAt ?? '').toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Firmado · {date}
      </span>
    )
  }

  // ── Pending DocuSeal signature ──
  if (effectiveStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        Pendiente firma…
      </span>
    )
  }

  // ── Declined ──
  if (effectiveStatus === 'declined') {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
          </svg>
          Rechazada
        </span>
        {declineReason && (
          <span className="text-[10px] text-red-400 max-w-[220px] text-right leading-tight">
            {declineReason}
          </span>
        )}
        <button
          disabled={isPending}
          onClick={send}
          className="text-[10px] text-zinc-500 hover:text-zinc-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors underline underline-offset-2 leading-tight"
        >
          {isPending ? 'Enviando…' : 'Reenviar propuesta'}
        </button>
        {error && (
          <span className="text-[10px] text-red-500 max-w-[220px] text-right leading-tight">{error}</span>
        )}
      </div>
    )
  }

  // ── Text send / re-send button ──
  const isResend =
    (sentAt && !effectiveStatus) ||
    effectiveStatus === 'expired'

  const label = isPending
    ? 'Enviando…'
    : isResend
      ? 'Reenviar propuesta'
      : 'Enviar para firma'

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        disabled={isPending}
        onClick={send}
        className="text-xs text-zinc-700 hover:text-zinc-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors leading-snug"
      >
        {label}
      </button>
      {error && (
        <span className="text-[10px] text-red-500 max-w-[220px] text-right leading-tight">{error}</span>
      )}
    </div>
  )
}
