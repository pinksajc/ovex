'use client'

import { useEffect, useState } from 'react'

export function PdfViewer({ dealId, configId }: { dealId: string; configId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null

    fetch('/api/propuestas/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, configId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? `Error ${res.status}`)
        }
        return res.blob()
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error generando PDF')
      })

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [dealId, configId])

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-100">
        <p className="text-red-500 text-sm px-6 text-center">{error}</p>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-100">
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
            <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
          </svg>
          Generando PDF…
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={url}
      title="Propuesta Comercial"
      className="fixed inset-0 w-full h-full border-0 z-[9999]"
    />
  )
}
