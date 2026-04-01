'use client'

import { useState } from 'react'

interface PrintButtonProps {
  variant?: 'inline' | 'fab'
  /** Si se proporcionan dealId + configId, descarga el PDF server-side.
   *  Si no, hace window.print() como fallback. */
  dealId?: string
  configId?: string
}

export function PrintButton({ variant = 'inline', dealId, configId }: PrintButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    if (!dealId || !configId) {
      window.print()
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/propuestas/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, configId }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Error generando PDF' }))
        throw new Error(msg ?? `Error ${res.status}`)
      }

      // Obtener nombre de archivo del header Content-Disposition
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? 'propuesta-platomico.pdf'

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando PDF')
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'fab') {
    return (
      <div className="print:hidden fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        <button
          onClick={handleDownload}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-zinc-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg hover:bg-zinc-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="5" strokeOpacity="0.3"/>
                <path d="M7 2a5 5 0 0 1 5 5" strokeLinecap="round"/>
              </svg>
              Generando PDF…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 1v7M4.5 5.5 7 8l2.5-2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 10v1.5A1.5 1.5 0 0 0 3.5 13h7A1.5 1.5 0 0 0 12 11.5V10" strokeLinecap="round"/>
              </svg>
              Guardar PDF
            </>
          )}
        </button>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-1.5 rounded-lg max-w-xs text-right">
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="print:hidden flex flex-col items-start gap-1">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6" cy="6" r="4" strokeOpacity="0.3"/>
              <path d="M6 2a4 4 0 0 1 4 4" strokeLinecap="round"/>
            </svg>
            Generando…
          </>
        ) : (
          <>
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 1v6M4 5l2 2 2-2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 9v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" strokeLinecap="round"/>
            </svg>
            Guardar PDF
          </>
        )}
      </button>
      {error && (
        <span className="text-red-600 text-xs">{error}</span>
      )}
    </div>
  )
}
