'use client'

import { useState } from 'react'

interface ExportPdfButtonProps {
  dateFrom: string
  dateTo: string
}

export function ExportPdfButton({ dateFrom, dateTo }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(false)

  async function handleExport() {
    setLoading(true)
    setError(false)
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
      console.error('[ExportPdfButton]', err)
      setError(true)
      setTimeout(() => setError(false), 4000)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-400 cursor-not-allowed"
      >
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
        </svg>
        Generando…
      </button>
    )
  }

  if (error) {
    return (
      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
      >
        Error · Reintentar
      </button>
    )
  }

  return (
    <button
      onClick={handleExport}
      title={`Exportar informe PDF (${dateFrom} — ${dateTo})`}
      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
    >
      <PdfIcon className="w-3.5 h-3.5" />
      Exportar informe
    </button>
  )
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1" width="10" height="13" rx="1.5" />
      <path d="M5 5h6M5 8h4M5 11h3" />
      <path d="M12 9l2.5 2.5M14.5 9 12 11.5" strokeWidth="1.2" />
    </svg>
  )
}
