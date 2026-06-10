'use client'

import { useState, useEffect, useRef } from 'react'
import { UploadZone } from './upload-zone'
import { ManageCategoriesModal } from './manage-categories-modal'

// ── More Actions Dropdown ──────────────────────────────────────────────────────

interface MoreActionsDropdownProps {
  dateFrom: string
  dateTo: string
}

export function MoreActionsDropdown({ dateFrom, dateTo }: MoreActionsDropdownProps) {
  const [dropdownOpen, setDropdownOpen]     = useState(false)
  const [modalOpen, setModalOpen]           = useState(false)
  const [catModalOpen, setCatModalOpen]     = useState(false)
  const [pdfLoading, setPdfLoading]         = useState(false)
  const [pdfError, setPdfError]             = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return
      setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  // Close dropdown on Escape
  useEffect(() => {
    if (!dropdownOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [dropdownOpen])

  function openImportModal() {
    setDropdownOpen(false)
    setModalOpen(true)
  }

  function openCatModal() {
    setDropdownOpen(false)
    setCatModalOpen(true)
  }

  async function handleExportPdf() {
    setDropdownOpen(false)
    setPdfLoading(true)
    setPdfError(false)
    try {
      const url = `/api/cashflow/report/pdf?from=${dateFrom}&to=${dateTo}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = `informe-cashflow-${dateFrom}-${dateTo}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
    } catch (err) {
      console.error('[MoreActionsDropdown] export PDF', err)
      setPdfError(true)
      setTimeout(() => setPdfError(false), 4000)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <>
      {/* Trigger button */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setDropdownOpen((v) => !v)}
          title="Más opciones"
          className="rounded-[6px] p-2 transition-colors text-text-tertiary hover:text-text-secondary hover:bg-hover"
        >
          <DotsIcon className="w-4 h-4" />
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            ref={dropdownRef}
            className="absolute right-0 top-full mt-1.5 w-44 bg-elevated border border-border-subtle rounded-[6px] shadow-lg py-1 z-30"
          >
            {/* Importar CSV */}
            <button
              onClick={openImportModal}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-secondary hover:bg-hover transition-colors text-left"
            >
              <IconUpload className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              Importar CSV
            </button>

            {/* Gestionar categorías */}
            <button
              onClick={openCatModal}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-secondary hover:bg-hover transition-colors text-left"
            >
              <IconTag className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              Gestionar categorías
            </button>

            {/* Exportar informe PDF */}
            <button
              onClick={handleExportPdf}
              disabled={pdfLoading}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-secondary hover:bg-hover transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfLoading ? (
                <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                </svg>
              ) : (
                <IconDownload className={`w-3.5 h-3.5 shrink-0 ${pdfError ? 'text-danger' : 'text-text-tertiary'}`} />
              )}
              <span className={pdfError ? 'text-danger' : ''}>
                {pdfLoading ? 'Generando…' : pdfError ? 'Error · Reintentar' : 'Exportar informe PDF'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Manage Categories Modal */}
      {catModalOpen && (
        <ManageCategoriesModal onClose={() => setCatModalOpen(false)} />
      )}

      {/* Import CSV Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="w-full max-w-lg">
            <div className="flex items-center justify-end mb-2">
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <UploadZone />
          </div>
        </div>
      )}
    </>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  )
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" />
      <path d="M8 2v8M5.5 4.5 8 2l2.5 2.5" />
    </svg>
  )
}

function IconDownload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" />
      <path d="M8 2v8M5.5 7.5 8 10l2.5-2.5" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 1l10 10M11 1L1 11" />
    </svg>
  )
}

function IconTag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2H13.5V6L8 11.5a1.5 1.5 0 01-2.1 0l-3.4-3.4a1.5 1.5 0 010-2.1L9.5 2Z" />
      <circle cx="11.5" cy="4.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}
