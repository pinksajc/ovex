'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import {
  addPlannedItemAction,
  deletePlannedItemAction,
  confirmSuggestedRecurringAction,
} from '@/app/actions/cashflow-planned'
import { CASHFLOW_CATEGORIES } from '@/lib/cashflow-categories'
import type { PlannedItem, SuggestedRecurring } from '@/lib/supabase/cashflow-planned'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PendingInvoice {
  id: string
  number: string
  clientName: string
  amountTotal: number
  dueAt: string | null
}

// ── Formatters ─────────────────────────────────────────────────────────────────

const _EUR2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const _EUR0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
function eur2(n: number) { return `${_EUR2.format(n)} €` }
function eur0(n: number) { return _EUR0.format(n) }

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
}

function monthLabelFull(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

function getNextMonths(n: number): string[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

// ── Projection computation ─────────────────────────────────────────────────────

interface ProjectionPoint {
  monthKey: string
  label: string
  income: number
  expense: number
  net: number
  balance: number
  status: 'green' | 'yellow' | 'red'
}

function semaforo(balance: number): 'green' | 'yellow' | 'red' {
  return balance > 5000 ? 'green' : balance > 1000 ? 'yellow' : 'red'
}

const SEMAFORO_COLORS = { green: '#34c759', yellow: '#ff9f0a', red: '#ff3b30' } as const

function computeProjection(
  currentBalance: number,
  pendingInvoices: PendingInvoice[],
  plannedItems: PlannedItem[],
): ProjectionPoint[] {
  const months = getNextMonths(6)
  let running = currentBalance

  return months.map((monthKey) => {
    const invoiceIncome = pendingInvoices
      .filter((inv) => {
        if (!inv.dueAt) return monthKey === months[0]
        return inv.dueAt.startsWith(monthKey)
      })
      .reduce((s, inv) => s + inv.amountTotal, 0)

    const plannedIncome = plannedItems
      .filter((p) => p.type === 'income' && (p.isRecurring || p.date.startsWith(monthKey)))
      .reduce((s, p) => s + p.amount, 0)

    const plannedExpense = plannedItems
      .filter((p) => p.type === 'expense' && (p.isRecurring || p.date.startsWith(monthKey)))
      .reduce((s, p) => s + p.amount, 0)

    const totalIncome = invoiceIncome + plannedIncome
    running = running + totalIncome - plannedExpense

    return {
      monthKey,
      label: monthLabel(monthKey),
      income: Math.round(totalIncome),
      expense: Math.round(plannedExpense),
      net: Math.round(totalIncome - plannedExpense),
      balance: Math.round(running),
      status: semaforo(running),
    }
  })
}

// ── Semáforo dot ───────────────────────────────────────────────────────────────

function Semaforo({ status, size = 'md' }: { status: 'green' | 'yellow' | 'red'; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-4 h-4' : size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${sz}`}
      style={{ background: SEMAFORO_COLORS[status] }}
    />
  )
}

// ── Hero KPI ───────────────────────────────────────────────────────────────────

function HeroKpi({
  projection,
  currentBalance,
  incomeCount,
  expenseCount,
}: {
  projection: ProjectionPoint[]
  currentBalance: number
  incomeCount: number
  expenseCount: number
}) {
  const final = projection[projection.length - 1]
  if (!final) return null
  const color = SEMAFORO_COLORS[final.status]

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-8">
      {/* Main KPI */}
      <div className="flex-1">
        <div className="flex items-center gap-2.5 mb-1">
          <Semaforo status={final.status} size="lg" />
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Saldo proyectado en 6 meses
          </p>
        </div>
        <p className="text-4xl font-bold tracking-tight mt-2" style={{ color }}>
          {eur2(final.balance)}
        </p>
        <p className="text-xs text-zinc-400 mt-2">
          Basado en {incomeCount} ingreso{incomeCount !== 1 ? 's' : ''} esperado{incomeCount !== 1 ? 's' : ''} y {expenseCount} gasto{expenseCount !== 1 ? 's' : ''} planificado{expenseCount !== 1 ? 's' : ''}
          {' · '}Saldo actual: {eur2(currentBalance)}
        </p>
      </div>

      {/* Mini month breakdown */}
      <div className="hidden lg:flex items-end gap-3">
        {projection.map((p, i) => {
          const barH = Math.max(4, Math.abs(p.net) / Math.max(...projection.map((x) => Math.abs(x.net))) * 48)
          return (
            <div key={p.monthKey} className="flex flex-col items-center gap-1">
              <div
                className="w-5 rounded-sm"
                style={{
                  height: barH,
                  background: p.net >= 0 ? '#34c75930' : '#ff3b3030',
                  borderTop: `2px solid ${p.net >= 0 ? '#34c759' : '#ff3b30'}`,
                }}
                title={`${monthLabelFull(p.monthKey)}: ${p.net >= 0 ? '+' : '−'}${eur2(Math.abs(p.net))}`}
              />
              <Semaforo status={p.status} size="sm" />
              <p className="text-[9px] text-zinc-400 capitalize">{p.label.split(' ')[0]}</p>
              {i === projection.length - 1 && (
                <span className="text-[8px] font-semibold text-zinc-300 uppercase">fin</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Inline add form ────────────────────────────────────────────────────────────

interface InlineAddFormProps {
  type: 'income' | 'expense'
  monthKey: string
  onSave: (payload: {
    date: string; description: string; amount: number
    type: 'income' | 'expense'; category: string; isRecurring: boolean
  }) => void
  onCancel: () => void
  saving: boolean
  error: string | null
}

function InlineAddForm({ type, monthKey, onSave, onCancel, saving, error }: InlineAddFormProps) {
  const defaultDate = `${monthKey}-15`
  const [description, setDescription] = useState('')
  const [amount, setAmount]           = useState('')
  const [category, setCategory]       = useState(type === 'income' ? 'Ingreso cliente' : 'Sin categoría')
  const [isRecurring, setRecurring]   = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0 || !description.trim()) return
    onSave({ date: defaultDate, description: description.trim(), amount: amt, type, category, isRecurring })
  }

  const isIncome = type === 'income'
  const ringColor = isIncome ? 'focus:ring-emerald-300' : 'focus:ring-red-300'

  return (
    <form
      onSubmit={handleSubmit}
      className={`mt-2 rounded-xl border p-3 space-y-2 ${
        isIncome ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'
      }`}
    >
      <input
        autoFocus
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={isIncome ? 'Descripción ingreso…' : 'Descripción gasto…'}
        required
        className={`w-full text-xs bg-white border-0 rounded-lg px-2.5 py-1.5 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 shadow-sm ${ringColor}`}
      />
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Importe €"
        required
        className={`w-full text-xs bg-white border-0 rounded-lg px-2.5 py-1.5 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 shadow-sm ${ringColor}`}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className={`w-full text-xs bg-white border-0 rounded-lg px-2.5 py-1.5 text-zinc-600 focus:outline-none focus:ring-1 shadow-sm ${ringColor}`}
      >
        {CASHFLOW_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {type === 'expense' && (
        <label className="flex items-center gap-2 cursor-pointer select-none py-0.5">
          <div
            onClick={() => setRecurring(!isRecurring)}
            className={`w-7 h-4 rounded-full transition-colors relative shrink-0 ${isRecurring ? 'bg-zinc-700' : 'bg-zinc-200'}`}
          >
            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isRecurring ? 'translate-x-3' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-[10px] text-zinc-500">Recurrente mensual</span>
        </label>
      )}

      {error && <p className="text-[10px] text-red-500">{error}</p>}

      <div className="flex gap-1.5 pt-0.5">
        <button
          type="submit"
          disabled={saving}
          className={`flex-1 text-xs font-medium text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition-colors ${
            isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {saving ? '…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-xs text-zinc-500 hover:text-zinc-700 px-2.5 py-1.5 rounded-lg bg-white shadow-sm transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ── Item card ──────────────────────────────────────────────────────────────────

interface KanbanItemCardProps {
  label: string
  amount: number
  type: 'income' | 'expense'
  isRecurring?: boolean
  isInvoice?: boolean
  onRemove?: () => void
}

function KanbanItemCard({ label, amount, type, isRecurring, isInvoice, onRemove }: KanbanItemCardProps) {
  const isIncome = type === 'income'
  return (
    <div className={`flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 ${
      isIncome ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'
    }`}>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-zinc-700 truncate leading-tight">{label}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`text-[11px] font-semibold font-mono ${isIncome ? 'text-emerald-700' : 'text-red-600'}`}>
            {isIncome ? '+' : '−'}{eur2(amount)}
          </span>
          {isRecurring && (
            <span className="text-[8px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
              recurrente
            </span>
          )}
          {isInvoice && (
            <span className="text-[8px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              factura
            </span>
          )}
        </div>
      </div>
      {onRemove ? (
        <button
          onClick={onRemove}
          className={`shrink-0 mt-0.5 transition-colors ${
            isIncome ? 'text-emerald-300 hover:text-emerald-600' : 'text-red-300 hover:text-red-600'
          }`}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      ) : (
        <a href="/facturas" className="shrink-0 mt-0.5 text-amber-400 hover:text-amber-600 transition-colors text-[9px]">↗</a>
      )}
    </div>
  )
}

// ── Kanban column ──────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  point: ProjectionPoint
  incomeItems: Array<{ id: string | null; label: string; amount: number; isRecurring?: boolean; isInvoice?: boolean }>
  expenseItems: Array<{ id: string; label: string; amount: number; isRecurring?: boolean }>
  onDelete: (id: string) => void
  onAdd: (type: 'income' | 'expense', payload: {
    date: string; description: string; amount: number
    type: 'income' | 'expense'; category: string; isRecurring: boolean
  }) => void
  saving: boolean
  saveError: string | null
}

function KanbanColumn({ point, incomeItems, expenseItems, onDelete, onAdd, saving, saveError }: KanbanColumnProps) {
  const [adding, setAdding] = useState<'income' | 'expense' | null>(null)

  function handleAdd(payload: Parameters<KanbanColumnProps['onAdd']>[1]) {
    onAdd(adding!, payload)
    // form stays until parent clears saving (parent will set null on success)
  }

  const netColor = point.net >= 0 ? '#34c759' : '#ff3b30'

  return (
    <div className="flex flex-col min-w-[210px] max-w-[210px] bg-zinc-50/70 rounded-2xl border border-zinc-100 overflow-hidden">
      {/* Column header */}
      <div className="px-3 pt-3 pb-2 border-b border-zinc-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Semaforo status={point.status} size="sm" />
            <span className="text-xs font-semibold text-zinc-700 capitalize">{point.label}</span>
          </div>
          <span
            className="text-[11px] font-semibold font-mono"
            style={{ color: netColor }}
          >
            {point.net >= 0 ? '+' : '−'}{eur0(Math.abs(point.net))} €
          </span>
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 px-2.5 py-2.5 space-y-1.5 overflow-y-auto max-h-[360px]">
        {/* Income cards */}
        {incomeItems.map((item, i) => (
          <KanbanItemCard
            key={item.id ?? `inv-${i}`}
            label={item.label}
            amount={item.amount}
            type="income"
            isRecurring={item.isRecurring}
            isInvoice={item.isInvoice}
            onRemove={item.id ? () => onDelete(item.id!) : undefined}
          />
        ))}

        {/* Expense cards */}
        {expenseItems.map((item) => (
          <KanbanItemCard
            key={item.id}
            label={item.label}
            amount={item.amount}
            type="expense"
            isRecurring={item.isRecurring}
            onRemove={() => onDelete(item.id)}
          />
        ))}

        {incomeItems.length === 0 && expenseItems.length === 0 && !adding && (
          <p className="text-[10px] text-zinc-300 text-center py-4">Sin movimientos</p>
        )}

        {/* Inline add form */}
        {adding && (
          <InlineAddForm
            type={adding}
            monthKey={point.monthKey}
            onSave={handleAdd}
            onCancel={() => setAdding(null)}
            saving={saving}
            error={saveError}
          />
        )}
      </div>

      {/* Add buttons */}
      {!adding && (
        <div className="px-2.5 pb-2 flex gap-1.5">
          <button
            onClick={() => setAdding('income')}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 py-1.5 rounded-lg transition-colors"
          >
            <PlusIcon className="w-2.5 h-2.5" /> Ingreso
          </button>
          <button
            onClick={() => setAdding('expense')}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 py-1.5 rounded-lg transition-colors"
          >
            <PlusIcon className="w-2.5 h-2.5" /> Gasto
          </button>
        </div>
      )}

      {/* Column footer — projected balance */}
      <div className="px-3 py-2 border-t border-zinc-100 bg-white flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Saldo proy.</span>
        <span
          className="text-[11px] font-bold font-mono"
          style={{ color: SEMAFORO_COLORS[point.status] }}
        >
          {eur0(point.balance)} €
        </span>
      </div>
    </div>
  )
}

// ── Projection chart ───────────────────────────────────────────────────────────

function ProjectionTooltip({
  active, payload, label, projection,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  projection: ProjectionPoint[]
}) {
  if (!active || !payload?.length) return null
  const bal = payload[0]?.value ?? 0
  const idx = projection.findIndex((p) => p.label === label)
  const prev = idx > 0 ? projection[idx - 1].balance : null
  const delta = prev !== null ? bal - prev : null
  const color = bal > 5000 ? '#34c759' : bal > 1000 ? '#ff9f0a' : '#ff3b30'

  return (
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-zinc-100 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-zinc-700 capitalize">{label}</p>
      <p className="font-mono font-semibold text-base" style={{ color }}>{eur2(bal)}</p>
      {delta !== null && (
        <p className={`text-[10px] font-mono ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {delta >= 0 ? '↑ +' : '↓ −'}{eur2(Math.abs(delta))} vs mes anterior
        </p>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

interface PlanningViewProps {
  plannedItems: PlannedItem[]
  pendingInvoices: PendingInvoice[]
  suggestedRecurring: SuggestedRecurring[]
  currentBalance: number
}

export function PlanningView({
  plannedItems,
  pendingInvoices,
  suggestedRecurring,
  currentBalance,
}: PlanningViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Track which column's inline form is "active" (for clearing on save)
  const [savingFor, setSavingFor] = useState<string | null>(null)

  const [ignored, setIgnored]           = useState<Set<string>>(new Set())
  const [pendingConfirm, setPendingConfirm] = useState<Set<string>>(new Set())

  const confirmedDescs = new Set(plannedItems.filter((p) => p.isRecurring).map((p) => p.description))
  const visibleSuggestions = suggestedRecurring.filter(
    (s) => !ignored.has(s.description) && !confirmedDescs.has(s.description),
  )

  const months = useMemo(() => getNextMonths(6), [])

  const projection = useMemo(
    () => computeProjection(currentBalance, pendingInvoices, plannedItems),
    [currentBalance, pendingInvoices, plannedItems],
  )

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleDelete(id: string) {
    startTransition(async () => {
      await deletePlannedItemAction(id)
      router.refresh()
    })
  }

  function handleConfirm(s: SuggestedRecurring) {
    setPendingConfirm((p) => new Set(p).add(s.description))
    startTransition(async () => {
      await confirmSuggestedRecurringAction({ description: s.description, amount: s.averageAmount, category: s.category })
      router.refresh()
    })
  }

  async function handleAdd(
    _type: 'income' | 'expense',
    payload: {
      date: string; description: string; amount: number
      type: 'income' | 'expense'; category: string; isRecurring: boolean
    },
  ) {
    setSaving(true)
    setSaveError(null)
    setSavingFor(payload.date.slice(0, 7))
    const result = await addPlannedItemAction(payload)
    setSaving(false)
    setSavingFor(null)
    if (result.ok) {
      router.refresh()
    } else {
      setSaveError(result.error ?? 'Error')
    }
  }

  // ── Column data ──────────────────────────────────────────────────────────────

  // Y-axis domain
  const balances = projection.map((p) => p.balance)
  const yMin = Math.min(0, ...balances)
  const yMax = Math.max(...balances)
  const yPad = Math.max((yMax - yMin) * 0.15, 2000)

  const incomeCount = plannedItems.filter((p) => p.type === 'income').length + pendingInvoices.length
  const expenseCount = plannedItems.filter((p) => p.type === 'expense').length

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Hero KPI ─────────────────────────────────────────────────────────── */}
      <HeroKpi
        projection={projection}
        currentBalance={currentBalance}
        incomeCount={incomeCount}
        expenseCount={expenseCount}
      />

      {/* ── Suggested recurring banner ────────────────────────────────────────── */}
      {visibleSuggestions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-amber-700 mb-3">
            💡 Gastos recurrentes detectados — ¿confirmar para incluir en la proyección?
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleSuggestions.map((s) => (
              <div key={s.description} className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-zinc-700">{s.description}</p>
                  <p className="text-[10px] text-zinc-400">{s.category} · ~{eur2(s.averageAmount)}/mes</p>
                </div>
                <button
                  onClick={() => handleConfirm(s)}
                  disabled={pendingConfirm.has(s.description)}
                  className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg disabled:opacity-50 transition-colors"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setIgnored((p) => new Set(p).add(s.description))}
                  className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Kanban monthly columns ────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
          Planificación mensual · próximos 6 meses
        </p>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {months.map((monthKey, idx) => {
            const point = projection[idx]

            // Income items for this column (recurring appear in every month, non-recurring only in their month)
            const incomeItems: KanbanColumnProps['incomeItems'] = [
              // Pending invoices due this month (or first month if no dueAt)
              ...pendingInvoices
                .filter((inv) => {
                  if (!inv.dueAt) return monthKey === months[0]
                  return inv.dueAt.startsWith(monthKey)
                })
                .map((inv) => ({
                  id: null as null,
                  label: `${inv.number} · ${inv.clientName}`,
                  amount: inv.amountTotal,
                  isInvoice: true as const,
                })),
              // Manual planned incomes
              ...plannedItems
                .filter((p) => p.type === 'income' && (p.isRecurring || p.date.startsWith(monthKey)))
                .map((p) => ({
                  id: p.id,
                  label: p.description,
                  amount: p.amount,
                  isRecurring: p.isRecurring,
                })),
            ]

            const expenseItems: KanbanColumnProps['expenseItems'] = plannedItems
              .filter((p) => p.type === 'expense' && (p.isRecurring || p.date.startsWith(monthKey)))
              .map((p) => ({
                id: p.id,
                label: p.description,
                amount: p.amount,
                isRecurring: p.isRecurring,
              }))

            return (
              <KanbanColumn
                key={monthKey}
                point={point}
                incomeItems={incomeItems}
                expenseItems={expenseItems}
                onDelete={handleDelete}
                onAdd={handleAdd}
                saving={saving && savingFor === monthKey}
                saveError={savingFor === monthKey ? saveError : null}
              />
            )
          })}
        </div>
      </div>

      {/* ── Projection chart ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Evolución del saldo proyectado
          </p>
          <p className="text-[10px] text-zinc-400">
            🟢 &gt;5.000 € · 🟡 1.000–5.000 € · 🔴 &lt;1.000 €
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={projection} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            {/* Color zone backgrounds */}
            <ReferenceArea y1={5000} fill="#34c75912" stroke="none" />
            <ReferenceArea y1={1000} y2={5000} fill="#ff9f0a10" stroke="none" />
            <ReferenceArea y2={1000} fill="#ff3b3010" stroke="none" />

            <CartesianGrid strokeDasharray="0" stroke="#f4f4f5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={(v: number) => `${eur0(v)} €`}
              tick={{ fontSize: 10, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
              dx={-4}
              width={64}
              domain={[yMin - yPad, yMax + yPad]}
            />
            <Tooltip
              content={<ProjectionTooltip projection={projection} />}
              cursor={{ stroke: '#e4e4e7', strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <ReferenceLine y={1000} stroke="#ff9f0a" strokeDasharray="4 2" strokeWidth={1} label={{ value: '1k€', position: 'right', fontSize: 9, fill: '#ff9f0a' }} />
            <ReferenceLine y={5000} stroke="#34c759" strokeDasharray="4 2" strokeWidth={1} label={{ value: '5k€', position: 'right', fontSize: 9, fill: '#34c759' }} />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#0071e3"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 5, fill: '#0071e3', strokeWidth: 0 }}
              activeDot={{ r: 7, fill: '#0071e3', strokeWidth: 2, stroke: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 1l10 10M11 1L1 11" />
    </svg>
  )
}
