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
    // overflow-x:hidden on the shell prevents any inner overflow from leaking
    // into main's scroll container (does not affect sticky because sticky is
    // scoped to the inner right-panel div, not the shell itself).
    <div className="flex min-h-full overflow-x-hidden">
      {/* ── Left column — min-w-0 prevents flex blowout ─────────────────── */}
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

      {/* ── Right panel — animates width 0 → 40% ────────────────────────── */}
      {/*
        overflow:hidden clips the inner content during the open animation.
        The inner div is 100% wide (= outer) so the iframe fills exactly the
        visible area — no content ever overflows the viewport.
      */}
      <div
        className="hidden lg:flex shrink-0 sticky top-0 h-screen overflow-hidden transition-[width] duration-300"
        style={{
          width: isOpen ? '40%' : '0',
          borderLeft: isOpen ? '1px solid #e4e4e7' : 'none',
        }}
      >
        {/* 100% width = exactly matches the animated outer container */}
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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
