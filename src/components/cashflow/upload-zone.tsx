'use client'

import { useState, useCallback, useRef } from 'react'
import { importCashflowAction } from '@/app/actions/cashflow'

// ── CSV helpers ────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

interface ParsedRow {
  date: string
  description: string
  amount: number
  currency: string
  state: string | null
  balance: number | null
}

function parseRevolutCSV(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  // Normalise header: lowercase + collapse whitespace for flexible matching
  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ' '))

  // Real Revolut Business CSV columns (as of 2024-2025):
  //   "Date started (UTC)", "Date completed (UTC)", "ID", "Type", "State",
  //   "Description", "Reference", "Payer", "Card number", "Card label",
  //   "Card state", "Orig currency", "Orig amount", "Payment currency",
  //   "Amount", "Total amount", "Exchange rate", "Fee", "Fee currency",
  //   "Balance", "Account", …
  const idx = {
    completedDate: header.indexOf('date completed (utc)'),
    startedDate:   header.indexOf('date started (utc)'),
    description:   header.indexOf('description'),
    amount:        header.indexOf('amount'),
    currency:      header.indexOf('payment currency'),
    state:         header.indexOf('state'),
    balance:       header.indexOf('balance'),
  }

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 4) continue

    // Skip non-completed rows (PENDING, REVERTED, FAILED, etc.)
    const state = idx.state >= 0 ? (cols[idx.state] || '').toUpperCase() : ''
    if (state && state !== 'COMPLETED') continue

    // Date: use "Date completed (UTC)", fall back to "Date started (UTC)"
    const rawDate =
      (idx.completedDate >= 0 ? cols[idx.completedDate] : '') ||
      (idx.startedDate   >= 0 ? cols[idx.startedDate]   : '') ||
      ''
    const date = rawDate.split(' ')[0] // "YYYY-MM-DD"
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

    const description = idx.description >= 0 ? cols[idx.description] || '' : ''
    if (!description) continue

    // Amount: already signed in Revolut CSVs (negative = expense, positive = income)
    // Strip unicode minus (−) and thousands separators; keep ASCII minus and decimal
    const rawAmount = idx.amount >= 0 ? cols[idx.amount] : '0'
    const cleanAmount = rawAmount
      .replace(/−/g, '-')              // unicode minus → ASCII minus
      .replace(/[^\d.\-]/g, '')        // remove everything else
    const amount = parseFloat(cleanAmount)
    if (isNaN(amount)) continue

    const currency = idx.currency >= 0 ? cols[idx.currency] || 'EUR' : 'EUR'

    const rawBalance = idx.balance >= 0 ? cols[idx.balance] : ''
    const cleanBalance = rawBalance
      .replace(/−/g, '-')
      .replace(/[^\d.\-]/g, '')
    const balance = cleanBalance ? parseFloat(cleanBalance) : null

    rows.push({
      date,
      description,
      amount,
      currency,
      state: state || null,
      balance: balance !== null && isNaN(balance) ? null : balance,
    })
  }

  return rows
}

// ── Component ─────────────────────────────────────────────────────────────────

type UploadState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'uploading'; count: number }
  | { status: 'success'; inserted: number; skipped: number }
  | { status: 'error'; message: string }

export function UploadZone() {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setState({ status: 'error', message: 'Solo se aceptan archivos CSV de Revolut.' })
      return
    }

    setState({ status: 'parsing' })
    try {
      const text = await file.text()
      const rows = parseRevolutCSV(text)

      if (rows.length === 0) {
        setState({ status: 'error', message: 'No se encontraron transacciones en el CSV.' })
        return
      }

      setState({ status: 'uploading', count: rows.length })
      const result = await importCashflowAction({ rows, sourceFile: file.name })

      if (!result.ok) {
        setState({ status: 'error', message: result.error ?? 'Error desconocido' })
        return
      }

      setState({ status: 'success', inserted: result.inserted, skipped: result.skipped })
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Error procesando el archivo',
      })
    }
  }, [])

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return
      processFile(files[0])
    },
    [processFile],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">Importar CSV</p>
          <p className="text-[13px] text-text-tertiary mt-0.5">Formato Revolut · detecta duplicados automáticamente</p>
        </div>
        {state.status === 'success' && (
          <button
            onClick={() => setState({ status: 'idle' })}
            className="text-xs text-text-tertiary hover:text-text-secondary border border-border-subtle px-3 h-8 rounded-[6px] transition-colors"
          >
            Importar otro
          </button>
        )}
      </div>

      {state.status === 'success' ? (
        <div className="flex items-center gap-3 bg-success/8 border border-success/20 rounded-[6px] px-5 py-4">
          <span className="text-success text-xl">✓</span>
          <div>
            <p className="text-[13px] font-semibold text-success">
              {state.inserted} transaccion{state.inserted !== 1 ? 'es' : ''} importada{state.inserted !== 1 ? 's' : ''}
            </p>
            {state.skipped > 0 && (
              <p className="text-xs text-success/70 mt-0.5">
                {state.skipped} omitida{state.skipped !== 1 ? 's' : ''} por duplicado
              </p>
            )}
          </div>
        </div>
      ) : state.status === 'error' ? (
        <div className="flex items-center gap-3 bg-danger/8 border border-danger/20 rounded-[6px] px-5 py-4">
          <span className="text-danger text-xl">✗</span>
          <div>
            <p className="text-[13px] font-semibold text-danger">Error al importar</p>
            <p className="text-xs text-danger/70 mt-0.5">{state.message}</p>
          </div>
          <button
            onClick={() => setState({ status: 'idle' })}
            className="ml-auto text-xs text-danger/70 hover:text-danger"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-[6px] px-6 py-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors select-none ${
            dragging
              ? 'border-accent bg-accent/5'
              : 'border-border-strong hover:border-border-strong bg-elevated hover:bg-hover'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {state.status === 'parsing' || state.status === 'uploading' ? (
            <>
              <div className="w-8 h-8 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
              <p className="text-[13px] text-text-tertiary">
                {state.status === 'parsing'
                  ? 'Procesando CSV…'
                  : `Importando ${state.count} transacciones…`}
              </p>
            </>
          ) : (
            <>
              <IconUpload className="w-8 h-8 text-text-tertiary" />
              <div className="text-center">
                <p className="text-[13px] font-medium text-text-secondary">
                  Arrastra un CSV de Revolut o haz clic para seleccionarlo
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  Columnas: Type · Started Date · Completed Date · Description · Amount · Currency · State · Balance
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
      <path d="M12 3v13M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
