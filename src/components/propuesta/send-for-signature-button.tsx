'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markSentForSignatureAction } from '@/app/actions/mark-sent'

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
  docusealStatus: 'pending' | 'completed' | null
  signedAt: string | null
  signerName: string
  signerEmail: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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

  // ── Default: send button ──
  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markSentForSignatureAction(dealId, configId, signerName, signerEmail)
          router.refresh()
        })
      }
      className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <>
          <span className="w-2 h-2 rounded-full border border-white/40 border-t-white animate-spin shrink-0" />
          Enviando…
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1.5 6h9M7 2.5l4 3.5-4 3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Enviar para firma
        </>
      )}
    </button>
  )
}
