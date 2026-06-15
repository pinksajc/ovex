'use client'

import { useEffect, useState } from 'react'

interface Props {
  connected: boolean
  flashStatus: string | null  // 'connected' | 'error' | 'no_refresh' | null
}

export function GmailConnectButton({ connected, flashStatus }: Props) {
  const [flash, setFlash] = useState<string | null>(flashStatus)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 5000)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <div className="mb-6 flex items-center gap-3 flex-wrap">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm ${
        connected
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-zinc-200 bg-white'
      }`}>
        {/* Gmail logo colours approximated with SVG */}
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <path d="M3 8l9 6 9-6M3 8v10a1 1 0 001 1h4v-7h8v7h4a1 1 0 001-1V8M3 8a1 1 0 011-1h16a1 1 0 011 1"
            stroke={connected ? '#059669' : '#71717a'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {connected ? (
          <span className="text-emerald-700 font-medium">Gmail conectado ✓</span>
        ) : (
          <span className="text-zinc-500">Gmail no conectado</span>
        )}
      </div>

      {connected ? (
        <a
          href="/api/auth/gmail/connect"
          className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2 transition-colors"
        >
          Reconectar
        </a>
      ) : (
        <a
          href="/api/auth/gmail/connect"
          className="inline-flex items-center gap-1.5 text-sm font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-4 py-2 rounded-lg transition-colors"
        >
          Conectar Gmail
        </a>
      )}

      {flash === 'connected' && (
        <span className="text-xs text-emerald-600 font-medium">¡Gmail conectado correctamente!</span>
      )}
      {(flash === 'error' || flash === 'no_refresh') && (
        <span className="text-xs text-red-500">
          {flash === 'no_refresh'
            ? 'Gmail no devolvió permiso de refresco — intenta de nuevo.'
            : 'Error al conectar Gmail. Inténtalo de nuevo.'}
        </span>
      )}
    </div>
  )
}
