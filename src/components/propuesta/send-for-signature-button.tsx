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
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Firmado · {date}
      </span>
    )
  }

  // ── Pending DocuSeal signature ──
  if (docusealStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        Pendiente firma…
      </span>
    )
  }

  // ── Text send / re-send button ──
  const isResend =
    (sentAt && !docusealStatus) ||
    docusealStatus === 'declined' ||
    docusealStatus === 'expired'

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
