'use client'

// Client shell for /facturas/[id].
// Holds the panel open/closed state.
// The invoice number is rendered here as a toggle button; everything else is
// passed as server-rendered children.

import { useState } from 'react'
import { PdfPreviewPanel } from '@/components/ui/pdf-preview-panel'

interface Props {
  /** The invoice number shown as a toggle button in the header */
  number: string
  /** URL for the iframe preview */
  previewUrl: string
  /** URL for the download button */
  downloadUrl: string
  /** Content that appears before the number heading (e.g. back link) */
  before: React.ReactNode
  /** Content that appears after the number heading (status badge, client, actions) */
  after: React.ReactNode
  /** The main page body (amounts, dates, deal link, …) */
  children: React.ReactNode
}

export function FacturaPageShell({
  number,
  previewUrl,
  downloadUrl,
  before,
  after,
  children,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex min-h-full overflow-x-hidden">
      {/* ── Left column — min-w-0 prevents flex blowout ─────────────────── */}
      <div className="flex-1 min-w-0 p-8">
        {before}

        {/* Header — invoice number is a toggle button */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => setIsOpen((v) => !v)}
                title={isOpen ? 'Cerrar vista previa' : 'Abrir vista previa PDF'}
                className="text-2xl font-semibold font-mono tracking-tight transition-colors"
                style={{
                  color: isOpen ? '#0071e3' : '#18181b',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: isOpen ? 'underline' : 'none',
                  textUnderlineOffset: '3px',
                }}
                onMouseEnter={(e) => { if (!isOpen) (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
                onMouseLeave={(e) => { if (!isOpen) (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
              >
                {number}
              </button>
              {after}
            </div>
          </div>
        </div>

        {children}
      </div>

      {/* ── Right panel — animates width 0 → 40% ────────────────────────── */}
      <div
        className="hidden lg:flex shrink-0 sticky top-0 h-screen overflow-hidden transition-[width] duration-300"
        style={{
          width: isOpen ? '40%' : '0',
          borderLeft: isOpen ? '1px solid #e4e4e7' : 'none',
        }}
      >
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {isOpen && (
            <PdfPreviewPanel
              previewUrl={previewUrl}
              downloadUrl={downloadUrl}
              title={number}
              onClose={() => setIsOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
