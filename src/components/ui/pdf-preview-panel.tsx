'use client'

import { useState } from 'react'

interface PdfPreviewPanelProps {
  /** URL used inside the iframe — must return Content-Disposition: inline */
  previewUrl: string
  /** URL used for the download button — Content-Disposition: attachment */
  downloadUrl: string
}

export function PdfPreviewPanel({ previewUrl, downloadUrl }: PdfPreviewPanelProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="hidden lg:flex flex-col w-[40%] shrink-0 sticky top-0 h-screen border-l border-zinc-200 bg-zinc-50">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-white shrink-0">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
          Vista previa
        </span>
        <a
          href={downloadUrl}
          download
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 1v7M3.5 6l2.5 2.5L8.5 6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1.5 10.5h9" strokeLinecap="round" />
          </svg>
          Descargar
        </a>
      </div>

      {/* Preview area */}
      <div className="relative flex-1 min-h-0">
        {/* Skeleton shown while PDF loads */}
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 gap-3">
            <svg
              className="w-8 h-8 animate-spin text-zinc-300"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-xs text-zinc-400">Generando preview…</p>
          </div>
        )}
        <iframe
          src={previewUrl}
          className={`w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          title="Vista previa PDF"
        />
      </div>
    </div>
  )
}
