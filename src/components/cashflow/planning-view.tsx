'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addPlannedItemAction,
  deletePlannedItemAction,
} from '@/app/actions/cashflow-planned'
import { CASHFLOW_CATEGORIES } from '@/lib/cashflow-categories'
import type { PlannedItem, SuggestedRecurring } from '@/lib/supabase/cashflow-planned'

// ── Public types (re-exported for page.tsx) ────────────────────────────────────

export interface PendingInvoice {
  id: string
  number: string
  clientName: string
  amountTotal: number
  dueAt: string | null   // "YYYY-MM-DD" or null
}

// SuggestedRecurring is re-exported so page.tsx can use it from here unchanged
export type { SuggestedRecurring } from '@/lib/supabase/cashflow-planned'

/** Pre-computed summary of a past cashflow transaction (deduped by description). */
export interface TxHistoryItem {
  description: string
  category: string
  avgAmount: number   // average absolute amount across all occurrences
  type: 'income' | 'expense'
  count: number       // how many times it appeared
  lastDate: string    // YYYY-MM-DD of most recent occurrence → used to pre-fill day-of-month
}

// ── Formatters ─────────────────────────────────────────────────────────────────

const _EUR2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function eur(n: number) { return `${_EUR2.format(n)} €` }
function eur0(n: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n) + ' €'
}

// ── Date helpers ───────────────────────────────────────────────────────────────

/** Monday of the ISO week that contains `d`. */
function weekStart(d: Date): Date {
  const day = d.getDay() // 0=Sun … 6=Sat
  const diff = (day === 0 ? -6 : 1 - day)
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateKey(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function formatFullDate(s: string): string {
  return parseDateKey(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ── Semáforo ───────────────────────────────────────────────────────────────────

type TrafficLight = 'green' | 'yellow' | 'red'

function semaforo(balance: number): TrafficLight {
  return balance > 5000 ? 'green' : balance > 1000 ? 'yellow' : 'red'
}

const TRAFFIC_COLORS: Record<TrafficLight, string> = {
  green:  '#34c759',
  yellow: '#ff9f0a',
  red:    '#ff3b30',
}

function TrafficDot({ status, size = 8 }: { status: TrafficLight; size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: TRAFFIC_COLORS[status] }}
    />
  )
}

// ── Week data ──────────────────────────────────────────────────────────────────

interface WeekRow {
  weekStart: Date        // Monday
  weekEnd: Date          // Sunday
  label: string          // "19–25 may"
  cobros: number
  pagos: number
  net: number            // cobros - pagos
  accumulated: number    // running balance at end of week
  status: TrafficLight
  incomeItems: LineItem[]
  expenseItems: LineItem[]
}

interface LineItem {
  id: string | null      // null = invoice (no delete)
  label: string
  amount: number
  type: 'income' | 'expense'
  date: string           // YYYY-MM-DD
  category?: string
  isRecurring?: boolean
  isInvoice?: boolean
}

/**
 * Expand recurring planned items into one entry per week within the range.
 * A monthly-recurring item (isRecurring=true) fires on the same day of
 * every month. Non-recurring items fire only on their exact date.
 */
function buildWeekRows(
  currentBalance: number,
  pendingInvoices: PendingInvoice[],
  plannedItems: PlannedItem[],
  weeks: number,
): WeekRow[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const rangeStart = weekStart(now)
  const rangeEnd   = addDays(rangeStart, weeks * 7 - 1)

  // Helper: generate all date keys for a planned item within range
  function itemDates(item: PlannedItem): string[] {
    if (!item.isRecurring) {
      const d = parseDateKey(item.date)
      if (d >= rangeStart && d <= rangeEnd) return [item.date]
      return []
    }
    // Recurring: same day-of-month every month within range
    const origDay = parseDateKey(item.date).getDate()
    const dates: string[] = []
    const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    while (cursor <= rangeEnd) {
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
      const day = Math.min(origDay, daysInMonth)
      const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), day)
      if (candidate >= rangeStart && candidate <= rangeEnd) {
        dates.push(toDateKey(candidate))
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return dates
  }

  // Build a map: YYYY-MM-DD → LineItem[]
  const dayMap = new Map<string, LineItem[]>()
  function push(key: string, item: LineItem) {
    if (!dayMap.has(key)) dayMap.set(key, [])
    dayMap.get(key)!.push(item)
  }

  // Pending invoices
  for (const inv of pendingInvoices) {
    const d = inv.dueAt ? parseDateKey(inv.dueAt) : now
    if (d >= rangeStart && d <= rangeEnd) {
      push(toDateKey(d), {
        id: null,
        label: `${inv.number} · ${inv.clientName}`,
        amount: inv.amountTotal,
        type: 'income',
        date: toDateKey(d),
        isInvoice: true,
      })
    }
  }

  // Planned items
  for (const item of plannedItems) {
    const dates = itemDates(item)
    for (const dateKey of dates) {
      push(dateKey, {
        id: item.id,
        label: item.description,
        amount: item.amount,
        type: item.type,
        date: dateKey,
        category: item.category,
        isRecurring: item.isRecurring,
      })
    }
  }

  // Build week rows
  const rows: WeekRow[] = []
  let running = currentBalance

  for (let w = 0; w < weeks; w++) {
    const mon = addDays(rangeStart, w * 7)
    const sun = addDays(mon, 6)

    const incomeItems: LineItem[] = []
    const expenseItems: LineItem[] = []

    for (let d = 0; d < 7; d++) {
      const key = toDateKey(addDays(mon, d))
      for (const item of dayMap.get(key) ?? []) {
        if (item.type === 'income') incomeItems.push(item)
        else expenseItems.push(item)
      }
    }

    const cobros = incomeItems.reduce((s, i) => s + i.amount, 0)
    const pagos  = expenseItems.reduce((s, i) => s + i.amount, 0)
    const net    = cobros - pagos
    running      = running + net

    const monStr = formatShortDate(mon)
    const sunStr = formatShortDate(sun)
    // Same month: "19–25 may", cross-month: "29 may–4 jun"
    const label  = mon.getMonth() === sun.getMonth()
      ? `${mon.getDate()}–${sunStr}`
      : `${monStr}–${sunStr}`

    rows.push({
      weekStart: mon,
      weekEnd:   sun,
      label,
      cobros,
      pagos,
      net,
      accumulated: Math.round(running),
      status: semaforo(running),
      incomeItems,
      expenseItems,
    })
  }

  return rows
}

// ── Balance strip ──────────────────────────────────────────────────────────────

function BalanceStrip({
  currentBalance,
  balance30,
  balance90,
}: {
  currentBalance: number
  balance30: number
  balance90: number
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center gap-3 sm:gap-0">
      <BalanceChip label="Saldo hoy" value={currentBalance} highlight />

      <ArrowSep />

      <BalanceChip label="Saldo en 30 días" value={balance30} />

      <ArrowSep />

      <BalanceChip label="Saldo en 90 días" value={balance90} />
    </div>
  )
}

function BalanceChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const st = semaforo(value)
  return (
    <div className="flex items-center gap-2.5 px-0 sm:px-5 first:pl-0 last:pr-0">
      <TrafficDot status={st} size={10} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
        <p className={`font-bold tracking-tight ${highlight ? 'text-xl text-zinc-900' : 'text-lg'}`}
           style={{ color: highlight ? undefined : TRAFFIC_COLORS[st] }}>
          {eur(value)}
        </p>
      </div>
    </div>
  )
}

function ArrowSep() {
  return (
    <div className="hidden sm:flex items-center flex-1 mx-2 min-w-[24px]">
      <div className="flex-1 h-px bg-zinc-100" />
      <span className="text-zinc-300 text-xs px-1">→</span>
      <div className="flex-1 h-px bg-zinc-100" />
    </div>
  )
}

// ── Add item modal (two-tab) ───────────────────────────────────────────────────

interface AddModalProps {
  type: 'income' | 'expense'
  transactionHistory: TxHistoryItem[]
  pendingInvoices: PendingInvoice[]
  onSave: (p: {
    date: string; description: string; amount: number
    type: 'income' | 'expense'; category: string; isRecurring: boolean
  }) => void
  onClose: () => void
  saving: boolean
  error: string | null
}

function AddItemModal({
  type, transactionHistory, pendingInvoices, onSave, onClose, saving, error,
}: AddModalProps) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const [activeTab, setActiveTab] = useState<'existing' | 'manual'>('existing')
  const [search, setSearch]       = useState('')

  // Manual-tab form fields
  const [description, setDescription] = useState('')
  const [amount, setAmount]           = useState('')
  const [category, setCategory]       = useState(type === 'income' ? 'Ingreso cliente' : 'Sin categoría')
  const [isRecurring, setRecurring]   = useState(false)
  const [date, setDate]               = useState(today)
  const [dayOfMonth, setDayOfMonth]   = useState(now.getDate())

  // ── Existing-tab filtered lists ──────────────────────────────────────────────

  const filteredHistory = useMemo(() => {
    const q = search.toLowerCase()
    return transactionHistory
      .filter((t) => t.type === type)
      .filter((t) => !q || t.description.toLowerCase().includes(q))
  }, [transactionHistory, type, search])

  const filteredInvoices = useMemo(() => {
    if (type !== 'income') return []
    const q = search.toLowerCase()
    return pendingInvoices.filter((inv) =>
      !q || inv.clientName.toLowerCase().includes(q) || inv.number.toLowerCase().includes(q),
    )
  }, [pendingInvoices, type, search])

  // ── Selection handlers ───────────────────────────────────────────────────────

  function selectHistoryItem(item: TxHistoryItem) {
    setDescription(item.description)
    setAmount(item.avgAmount.toFixed(2))
    setCategory(item.category)
    const day = parseDateKey(item.lastDate).getDate()
    setDayOfMonth(day)
    // Build a date in the current month with that day
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const safeDay = Math.min(day, daysInMonth)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(safeDay).padStart(2, '0')
    setDate(`${now.getFullYear()}-${mm}-${dd}`)
    setActiveTab('manual')
  }

  function selectInvoice(inv: PendingInvoice) {
    setDescription(`${inv.number} · ${inv.clientName}`)
    setAmount(inv.amountTotal.toFixed(2))
    setCategory('Ingreso cliente')
    if (inv.dueAt) {
      setDate(inv.dueAt)
      setDayOfMonth(parseDateKey(inv.dueAt).getDate())
    }
    setActiveTab('manual')
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0 || !description.trim()) return

    let finalDate: string
    if (isRecurring) {
      // Encode day-of-month into the date (year/month = current, day = chosen)
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const safeDay = Math.min(dayOfMonth, daysInMonth)
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(safeDay).padStart(2, '0')
      finalDate = `${now.getFullYear()}-${mm}-${dd}`
    } else {
      finalDate = date
    }

    onSave({ date: finalDate, description: description.trim(), amount: amt, type, category, isRecurring })
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-zinc-900">
            {type === 'income' ? 'Añadir cobro previsto' : 'Añadir pago comprometido'}
          </h2>
          <button onClick={onClose} disabled={saving} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-6 flex gap-4 border-b border-zinc-100 shrink-0">
          {(['existing', 'manual'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`pb-3 pt-3 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? 'text-zinc-900 border-b-2 border-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {tab === 'existing' ? 'Seleccionar existente' : 'Nuevo manual'}
            </button>
          ))}
        </div>

        {/* ── Tab: existing ─────────────────────────────────────────────────── */}
        {activeTab === 'existing' && (
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="px-4 py-3 shrink-0">
              <input
                autoFocus
                type="text"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-zinc-50">
              {/* Pending invoices (income only) */}
              {filteredInvoices.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => selectInvoice(inv)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-zinc-800 font-medium truncate">{inv.clientName}</p>
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">factura</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {inv.number}{inv.dueAt ? ` · vence ${formatFullDate(inv.dueAt)}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold font-mono text-emerald-600 shrink-0 ml-3">
                    +{eur(inv.amountTotal)}
                  </span>
                </button>
              ))}

              {/* Transaction history */}
              {filteredHistory.map((item) => (
                <button
                  key={item.description}
                  type="button"
                  onClick={() => selectHistoryItem(item)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-800 font-medium truncate">{item.description}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {item.category} · {item.count}× · día {parseDateKey(item.lastDate).getDate()} del mes
                    </p>
                  </div>
                  <span className={`text-sm font-bold font-mono shrink-0 ml-3 ${
                    type === 'income' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {type === 'income' ? '+' : '−'}{eur(item.avgAmount)}
                  </span>
                </button>
              ))}

              {filteredHistory.length === 0 && filteredInvoices.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-zinc-300">
                    {search ? 'Sin resultados' : 'Sin historial de transacciones'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: manual ───────────────────────────────────────────────────── */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Descripción</label>
              <input
                autoFocus type="text" value={description} required
                onChange={(e) => setDescription(e.target.value)}
                placeholder={type === 'income' ? 'Ej. Pago cliente XYZ' : 'Ej. Suscripción Slack'}
                className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Importe (€)</label>
                <input
                  type="number" min="0.01" step="0.01" value={amount} required
                  onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
                  className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>
              <div>
                {isRecurring ? (
                  <>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Día del mes</label>
                    <input
                      type="number" min="1" max="31" value={dayOfMonth} required
                      onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Fecha</label>
                    <input type="date" value={date} required onChange={(e) => setDate(e.target.value)}
                      className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300" />
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300">
                {CASHFLOW_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Toggle value={isRecurring} onChange={setRecurring} />
              <span className="text-xs text-zinc-600">Se repite cada mes</span>
            </label>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} disabled={saving}
                className="text-sm text-zinc-500 hover:text-zinc-700 px-2 py-1.5 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 px-5 py-2 rounded-lg disabled:opacity-50 transition-colors">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Toggle switch ──────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-zinc-900' : 'bg-zinc-200'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ── Weekly timeline ────────────────────────────────────────────────────────────

function WeeklyTimeline({
  rows,
  onDelete,
}: {
  rows: WeekRow[]
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<number | null>(null)

  function toggle(i: number) {
    setExpanded((prev) => (prev === i ? null : i))
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-100">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Previsión semanal · próximas 12 semanas
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/60">
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-32">Semana</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-36">Cobros previstos</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-36">Pagos comprometidos</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-32">Saldo semana</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-36">Saldo acumulado</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-16">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isExp = expanded === i
              const hasItems = row.incomeItems.length > 0 || row.expenseItems.length > 0
              return (
                <>
                  <tr
                    key={`row-${i}`}
                    onClick={() => hasItems && toggle(i)}
                    className={`border-b border-zinc-50 transition-colors ${
                      hasItems ? 'cursor-pointer hover:bg-zinc-50/80' : ''
                    } ${isExp ? 'bg-zinc-50/80' : ''}`}
                  >
                    {/* Semana */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {hasItems && (
                          <ChevronIcon open={isExp} className="w-3 h-3 text-zinc-300 shrink-0" />
                        )}
                        <span className="text-xs text-zinc-600 font-medium capitalize whitespace-nowrap">
                          {row.label}
                        </span>
                      </div>
                    </td>

                    {/* Cobros */}
                    <td className="px-4 py-3 text-right">
                      {row.cobros > 0 ? (
                        <span className="text-xs font-semibold font-mono text-emerald-600">
                          +{eur(row.cobros)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-200">—</span>
                      )}
                    </td>

                    {/* Pagos */}
                    <td className="px-4 py-3 text-right">
                      {row.pagos > 0 ? (
                        <span className="text-xs font-semibold font-mono text-red-500">
                          −{eur(row.pagos)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-200">—</span>
                      )}
                    </td>

                    {/* Saldo semana */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className="text-xs font-semibold font-mono"
                        style={{ color: row.net === 0 ? '#a1a1aa' : row.net > 0 ? '#34c759' : '#ff3b30' }}
                      >
                        {row.net === 0 ? '—' : `${row.net > 0 ? '+' : '−'}${eur(Math.abs(row.net))}`}
                      </span>
                    </td>

                    {/* Saldo acumulado */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className="text-sm font-bold font-mono"
                        style={{ color: TRAFFIC_COLORS[row.status] }}
                      >
                        {eur0(row.accumulated)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <TrafficDot status={row.status} size={10} />
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExp && (
                    <tr key={`exp-${i}`} className="bg-zinc-50/60 border-b border-zinc-100">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Income items */}
                          {row.incomeItems.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
                                Cobros
                              </p>
                              <div className="space-y-1.5">
                                {row.incomeItems.map((item, j) => (
                                  <DetailLine key={item.id ?? `inv-${j}`} item={item} onDelete={onDelete} />
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Expense items */}
                          {row.expenseItems.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
                                Pagos
                              </p>
                              <div className="space-y-1.5">
                                {row.expenseItems.map((item) => (
                                  <DetailLine key={item.id!} item={item} onDelete={onDelete} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DetailLine({ item, onDelete }: { item: LineItem; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <span className="text-xs text-zinc-700 truncate">{item.label}</span>
        {item.isRecurring && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">recurrente</span>
        )}
        {item.isInvoice && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">factura</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-semibold font-mono ${item.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
          {item.type === 'income' ? '+' : '−'}{eur(item.amount)}
        </span>
        {item.id && (
          <button onClick={() => onDelete(item.id!)} className="text-zinc-300 hover:text-red-400 transition-colors">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
        {item.isInvoice && (
          <a href="/facturas" className="text-zinc-300 hover:text-zinc-500 transition-colors text-[10px]">↗</a>
        )}
      </div>
    </div>
  )
}

// ── Item list panels ───────────────────────────────────────────────────────────

interface PanelItem {
  id: string
  label: string
  amount: number
  date: string
  category?: string
  isRecurring?: boolean
  isInvoice?: boolean
}

function ItemListPanel({
  title,
  type,
  items,
  onDelete,
  onAdd,
}: {
  title: string
  type: 'income' | 'expense'
  items: PanelItem[]
  onDelete: (id: string) => void
  onAdd: () => void
}) {
  const isIncome = type === 'income'
  const total = items.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{title}</h2>
          {items.length > 0 && (
            <p className={`text-sm font-bold mt-0.5 font-mono ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
              {isIncome ? '+' : '−'}{eur(total)}
            </p>
          )}
        </div>
        <button
          onClick={onAdd}
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            isIncome
              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
              : 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200'
          }`}
        >
          <PlusIcon className="w-3 h-3" />
          {isIncome ? 'Añadir cobro' : 'Añadir pago'}
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-zinc-50 flex-1">
        {items.length === 0 && (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-zinc-300">
              {isIncome ? 'Sin cobros previstos' : 'Sin pagos comprometidos'}
            </p>
            <p className="text-xs text-zinc-300 mt-1">
              {isIncome ? 'Añade facturas pendientes o cobros esperados' : 'Añade gastos recurrentes o pagos planificados'}
            </p>
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors group">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm text-zinc-800 truncate font-medium">{item.label}</p>
                {item.isRecurring && (
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                    mensual
                  </span>
                )}
                {item.isInvoice && (
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    factura
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {item.isRecurring
                  ? `Día ${parseDateKey(item.date).getDate()} de cada mes`
                  : formatFullDate(item.date)}
                {item.category ? ` · ${item.category}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-sm font-bold font-mono ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                {isIncome ? '+' : '−'}{eur(item.amount)}
              </span>
              {!item.isInvoice ? (
                <button
                  onClick={() => onDelete(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              ) : (
                <a href="/facturas" className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-zinc-500 transition-all text-xs">
                  ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

interface PlanningViewProps {
  plannedItems: PlannedItem[]
  pendingInvoices: PendingInvoice[]
  suggestedRecurring: SuggestedRecurring[]   // kept for prop-compat with page.tsx
  currentBalance: number
  transactionHistory: TxHistoryItem[]
}

export function PlanningView({
  plannedItems,
  pendingInvoices,
  currentBalance,
  transactionHistory,
}: PlanningViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [addModal, setAddModal]   = useState<'income' | 'expense' | null>(null)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Week rows ──────────────────────────────────────────────────────────────

  const weekRows = useMemo(
    () => buildWeekRows(currentBalance, pendingInvoices, plannedItems, 12),
    [currentBalance, pendingInvoices, plannedItems],
  )

  // ── Balance projections ────────────────────────────────────────────────────
  // Week at ~4 weeks out (index 3 end) and ~12 weeks out (last row)
  // Clamp to available weeks

  const balance30 = weekRows[Math.min(3, weekRows.length - 1)]?.accumulated ?? currentBalance
  const balance90 = weekRows[weekRows.length - 1]?.accumulated ?? currentBalance

  // ── Panel items ────────────────────────────────────────────────────────────

  const incomeItems: PanelItem[] = [
    ...pendingInvoices.map((inv) => ({
      id: inv.id,
      label: `${inv.number} · ${inv.clientName}`,
      amount: inv.amountTotal,
      date: inv.dueAt ?? new Date().toISOString().split('T')[0],
      isInvoice: true,
    })),
    ...plannedItems
      .filter((p) => p.type === 'income')
      .map((p) => ({ id: p.id, label: p.description, amount: p.amount, date: p.date, category: p.category, isRecurring: p.isRecurring })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const expenseItems: PanelItem[] = plannedItems
    .filter((p) => p.type === 'expense')
    .map((p) => ({ id: p.id, label: p.description, amount: p.amount, date: p.date, category: p.category, isRecurring: p.isRecurring }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleDelete(id: string) {
    startTransition(async () => {
      await deletePlannedItemAction(id)
      router.refresh()
    })
  }

  async function handleSave(payload: Parameters<AddModalProps['onSave']>[0]) {
    setSaving(true)
    setSaveError(null)
    const result = await addPlannedItemAction(payload)
    setSaving(false)
    if (result.ok) {
      setAddModal(null)
      router.refresh()
    } else {
      setSaveError(result.error ?? 'Error')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Section 1 — Balance strip */}
      <BalanceStrip
        currentBalance={currentBalance}
        balance30={balance30}
        balance90={balance90}
      />

      {/* Section 2 — Weekly timeline */}
      <WeeklyTimeline rows={weekRows} onDelete={handleDelete} />

      {/* Section 3 — Two panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ItemListPanel
          title="Cobros previstos"
          type="income"
          items={incomeItems}
          onDelete={handleDelete}
          onAdd={() => { setSaveError(null); setAddModal('income') }}
        />
        <ItemListPanel
          title="Pagos comprometidos"
          type="expense"
          items={expenseItems}
          onDelete={handleDelete}
          onAdd={() => { setSaveError(null); setAddModal('expense') }}
        />
      </div>

      {/* Add modal */}
      {addModal && (
        <AddItemModal
          type={addModal}
          transactionHistory={transactionHistory}
          pendingInvoices={pendingInvoices}
          onSave={handleSave}
          onClose={() => setAddModal(null)}
          saving={saving}
          error={saveError}
        />
      )}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 1v10M1 6h10" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h8M5 3V2h2v1M4 3v6.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5V3" />
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

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={className}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
      viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M4 2l4 4-4 4" />
    </svg>
  )
}
