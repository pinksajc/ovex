'use client'

import { useState, useEffect } from 'react'

interface PdfPreviewPanelProps {
  /** URL used inside the iframe — must return Content-Disposition: inline */
  previewUrl: string
  /** URL used for the download button — Content-Disposition: attachment */
  downloadUrl: string
  /** Optional document code shown in the header (e.g. "O-2026-0001") */
  title?: string
  /** Optional close/dismiss callback — renders an × button when provided */
  onClose?: () => void
}

export function PdfPreviewPanel({ previewUrl, downloadUrl, title, onClose }: PdfPreviewPanelProps) {
  const [loaded, setLoaded] = useState(false)

  // Reset spinner whenever the URL changes (new document selected)
  useEffect(() => { setLoaded(false) }, [previewUrl])

  return (
    // The parent shell already handles display:none on small screens.
    // w-full h-full fills exactly whatever the animated outer container gives us.
    <div className="flex flex-col w-full h-full bg-zinc-50">
      {/* Header bar: [×] [title] ··· [download] */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-zinc-200 bg-white shrink-0">
        {/* ✕ close button — top-left of the panel, first thing you reach */}
        {onClose && (
          <button
            onClick={onClose}
            title="Cerrar preview"
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <span className="flex-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest truncate">
          {title ?? 'Vista previa'}
        </span>

        <a
          href={downloadUrl}
          download
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors shrink-0"
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
          key={previewUrl}
          src={previewUrl}
          className={`w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          title="Vista previa PDF"
        />
      </div>
    </div>
  )
}
