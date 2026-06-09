'use client'

// Client shell for /ofertas/[id].
// Holds the selectedDoc state and renders:
//   top       — back link + header (server-rendered RSC, passed as prop)
//   timeline  — DealTimelineInteractive (interactive, managed here)
//   bottom    — ClientHistoryCard + grid (server-rendered RSC, passed as prop)
//   right panel — animated PDF preview, opens on timeline code click

import { useState } from 'react'
import { DealTimelineInteractive, type PreviewDoc } from '@/components/deals/deal-timeline-interactive'
import { PdfPreviewPanel } from '@/components/ui/pdf-preview-panel'
import type { Presupuesto, Invoice } from '@/types'

interface Props {
  presupuestos: Presupuesto[]
  facturas: Invoice[]
  activePresupuestoId?: string
  /** true → render ClientHistoryCard slot via bottom prop */
  showTimeline: boolean
  top: React.ReactNode
  bottom: React.ReactNode
}

export function OfertaPageShell({
  presupuestos,
  facturas,
  activePresupuestoId,
  showTimeline,
  top,
  bottom,
}: Props) {
  const [selectedDoc, setSelectedDoc] = useState<PreviewDoc | null>(null)
  const isOpen = selectedDoc !== null

  return (
    <div className="flex min-h-full">
      {/* ── Left column ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 p-8">
        {top}

        {showTimeline && (
          <DealTimelineInteractive
            presupuestos={presupuestos}
            facturas={facturas}
            activePresupuestoId={activePresupuestoId}
            selectedDocId={selectedDoc?.id ?? null}
            onSelectDoc={setSelectedDoc}
          />
        )}

        {bottom}
      </div>

      {/* ── Right panel — animates in/out ────────────────────────────────── */}
      {/* The outer div keeps sticky/height; width transitions via inline style */}
      <div
        className="hidden lg:block shrink-0 sticky top-0 h-screen overflow-hidden border-l border-zinc-200 transition-[width] duration-300"
        style={{ width: isOpen ? '40%' : '0', borderLeftWidth: isOpen ? 1 : 0 }}
      >
        {/* Inner div is always 40vw wide so content doesn't reflow during animation */}
        <div style={{ width: '40vw', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {selectedDoc && (
            <PdfPreviewPanel
              previewUrl={selectedDoc.previewUrl}
              downloadUrl={selectedDoc.downloadUrl}
              title={selectedDoc.number}
              onClose={() => setSelectedDoc(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
