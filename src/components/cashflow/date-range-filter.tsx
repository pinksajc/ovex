'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateKey(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Format "YYYY-MM-DD" → "DD/MM/YYYY" */
function displayFmt(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

/** Monday-first day of week: Mon=0 … Sun=6 */
function dowMon(d: Date): number {
  const n = d.getDay()
  return n === 0 ? 6 : n - 1
}

function addMonths(y: number, m: number, n: number): [number, number] {
  const d = new Date(y, m + n, 1)
  return [d.getFullYear(), d.getMonth()]
}

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const DAY_NAMES = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

// ── Single calendar month ─────────────────────────────────────────────────────

interface CalProps {
  year: number
  month: number
  /** Effective range low (sorted). Null = no highlight. */
  lo: string | null
  /** Effective range high (sorted). Null = no highlight. */
  hi: string | null
  onDayClick: (key: string) => void
  onDayHover: (key: string | null) => void
  onPrev?: () => void
  onNext?: () => void
}

function CalendarMonth({ year, month, lo, hi, onDayClick, onDayHover, onPrev, onNext }: CalProps) {
  const today   = toDateKey(new Date())
  const days    = new Date(year, month + 1, 0).getDate()
  const offset  = dowMon(new Date(year, month, 1))
  const isSingle = lo !== null && lo === hi

  // Cells: nulls for leading blanks, then 1…days
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ width: 224 }}>
      {/* Month header */}
      <div className="flex items-center justify-between mb-3 h-7">
        {onPrev ? (
          <button
            type="button" onClick={onPrev}
            className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <ChevLeft />
          </button>
        ) : <div className="w-6" />}

        <span className="text-xs font-semibold text-zinc-700">
          {MONTH_NAMES[month]} {year}
        </span>

        {onNext ? (
          <button
            type="button" onClick={onNext}
            className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <ChevRight />
          </button>
        ) : <div className="w-6" />}
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold text-zinc-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} className="h-8" />

          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isStart   = lo !== null && key === lo
          const isEnd     = hi !== null && key === hi
          const inRange   = !!(lo && hi && !isSingle && key > lo && key < hi)
          const isToday   = key === today

          // Band halves: the bg-zinc-100 strip that connects adjacent selected days
          const showLeft  = inRange || (isEnd  && !isSingle)
          const showRight = inRange || (isStart && !isSingle)

          const circleClass = isStart || isEnd
            ? 'bg-zinc-900 text-white font-semibold'
            : inRange
              ? 'text-zinc-700'
              : isToday
                ? 'text-zinc-900 font-semibold ring-1 ring-inset ring-zinc-300'
                : 'text-zinc-500 hover:bg-zinc-100'

          return (
            <div key={key} className="relative h-8">
              {showLeft  && <div className="absolute left-0  top-0 bottom-0 w-1/2 bg-zinc-100" />}
              {showRight && <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-zinc-100" />}
              <button
                type="button"
                onClick={() => onDayClick(key)}
                onMouseEnter={() => onDayHover(key)}
                onMouseLeave={() => onDayHover(null)}
                className={`absolute inset-[2px] rounded-full flex items-center justify-center text-[11px] transition-colors z-10 ${circleClass}`}
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Date range filter ─────────────────────────────────────────────────────────

interface DateRangeFilterProps {
  from: string   // "YYYY-MM-DD"
  to: string     // "YYYY-MM-DD"
}

export function DateRangeFilter({ from, to }: DateRangeFilterProps) {
  const router   = useRouter()
  const pathname = usePathname()

  const [open, setOpen]             = useState(false)
  const [selecting, setSelecting]   = useState<'start' | 'end'>('start')
  const [draftStart, setDraftStart] = useState<string | null>(null)
  const [hovering, setHovering]     = useState<string | null>(null)
  const [leftYear, setLeftYear]     = useState(() => parseDateKey(from).getFullYear())
  const [leftMonth, setLeftMonth]   = useState(() => parseDateKey(from).getMonth())
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function openPicker() {
    const d = parseDateKey(from)
    setLeftYear(d.getFullYear())
    setLeftMonth(d.getMonth())
    setDraftStart(null)
    setSelecting('start')
    setHovering(null)
    setOpen(true)
  }

  function handleDayClick(key: string) {
    if (selecting === 'start') {
      setDraftStart(key)
      setSelecting('end')
      setHovering(null)
    } else {
      let start = draftStart!
      let end   = key
      if (start > end) [start, end] = [end, start]
      const params = new URLSearchParams(window.location.search)
      params.set('from', start)
      params.set('to', end)
      router.replace(`${pathname}?${params.toString()}`)
      setOpen(false)
    }
  }

  function navigate(dir: -1 | 1) {
    const [ny, nm] = addMonths(leftYear, leftMonth, dir)
    setLeftYear(ny)
    setLeftMonth(nm)
  }

  const [rightYear, rightMonth] = addMonths(leftYear, leftMonth, 1)

  // What to highlight in the calendars:
  //   Before clicking (selecting='start') → show committed from/to
  //   After first click (selecting='end') → show draftStart + hovering preview
  const rawStart = selecting === 'end' ? draftStart : from
  const rawEnd   = selecting === 'end' ? (hovering ?? draftStart) : to

  // Sort so lo ≤ hi
  const lo = rawStart && rawEnd
    ? (rawStart <= rawEnd ? rawStart : rawEnd)
    : (rawStart ?? null)
  const hi = rawStart && rawEnd
    ? (rawStart <= rawEnd ? rawEnd : rawStart)
    : (rawStart ?? null)

  const statusMsg = selecting === 'start'
    ? 'Selecciona el inicio del período'
    : `Inicio: ${displayFmt(draftStart!)} — ahora selecciona el fin`

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger button ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={openPicker}
        className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-300"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span className="font-medium tabular-nums">
          {displayFmt(from)}
        </span>
        <span className="text-zinc-400">—</span>
        <span className="font-medium tabular-nums">
          {displayFmt(to)}
        </span>
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="absolute top-full mt-2 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-5 select-none"
          style={{ minWidth: 520 }}
        >
          <div className="flex items-start gap-5">
            <CalendarMonth
              year={leftYear} month={leftMonth}
              lo={lo} hi={hi}
              onDayClick={handleDayClick}
              onDayHover={setHovering}
              onPrev={() => navigate(-1)}
            />

            <div className="self-stretch w-px bg-zinc-100 mx-1" />

            <CalendarMonth
              year={rightYear} month={rightMonth}
              lo={lo} hi={hi}
              onDayClick={handleDayClick}
              onDayHover={setHovering}
              onNext={() => navigate(1)}
            />
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-zinc-50 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">{statusMsg}</span>
            {selecting === 'end' && (
              <button
                type="button"
                onClick={() => { setSelecting('start'); setDraftStart(null); setHovering(null) }}
                className="text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                ← Volver
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" />
      <path d="M5 1v3M11 1v3M1.5 6.5h13" />
    </svg>
  )
}

function ChevLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2L4 6l4 4" />
    </svg>
  )
}

function ChevRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2l4 4-4 4" />
    </svg>
  )
}
