'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markSentForSignatureAction } from '@/app/actions/mark-sent'

export function SendForSignatureButton({
  dealId,
  configId,
  sentAt,
}: {
  dealId: string
  configId: string
  sentAt: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (sentAt) {
    const date = new Date(sentAt).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Enviado · {date}
      </span>
    )
  }

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markSentForSignatureAction(dealId, configId)
          router.refresh()
        })
      }
      className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? 'Enviando…' : 'Enviar para firma'}
    </button>
  )
}
