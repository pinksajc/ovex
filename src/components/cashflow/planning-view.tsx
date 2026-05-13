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

// ── Slim invoice shape needed for planning ─────────────────────────────────────

export interface PendingInvoice {
  id: string
  number: string
  clientName: string
  amountTotal: number
  dueAt: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const _EUR2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function formatEurFull(n: number) { return `${_EUR2.format(n)} €` }
function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n)
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
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
  balance: number
  status: 'green' | 'yellow' | 'red'
}

function computeProjection(
  currentBalance: number,
  pendingInvoices: PendingInvoice[],
  plannedItems: PlannedItem[],
): ProjectionPoint[] {
  const months = getNextMonths(6)
  let running = currentBalance

  return months.map((monthKey) => {
    // Invoice income due this month
    const invoiceIncome = pendingInvoices
      .filter((inv) => inv.dueAt?.startsWith(monthKey))
      .reduce((s, inv) => s + inv.amountTotal, 0)

    // Planned incomes: date matches OR recurring (every month)
    const plannedIncome = plannedItems
      .filter((p) => p.type === 'income' && (p.isRecurring || p.date.startsWith(monthKey)))
      .reduce((s, p) => s + p.amount, 0)

    // Planned expenses: date matches OR recurring (every month)
    const plannedExpense = plannedItems
      .filter((p) => p.type === 'expense' && (p.isRecurring || p.date.startsWith(monthKey)))
      .reduce((s, p) => s + p.amount, 0)

    const totalIncome = invoiceIncome + plannedIncome
    running = running + totalIncome - plannedExpense

    const status: ProjectionPoint['status'] =
      running > 5000 ? 'green' : running > 1000 ? 'yellow' : 'red'

    return {
      monthKey,
      label: monthLabel(monthKey),
      income: Math.round(totalIncome),
      expense: Math.round(plannedExpense),
      balance: Math.round(running),
      status,
    }
  })
}

// ── Add item modal ─────────────────────────────────────────────────────────────

interface AddModalProps {
  type: 'income' | 'expense'
  onSave: (payload: {
    date: string; description: string; amount: number
    type: 'income' | 'expense'; category: string; isRecurring: boolean
  }) => void
  onClose: () => void
  saving: boolean
  error: string | null
}

function AddItemModal({ type, onSave, onClose, saving, error }: AddModalProps) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]               = useState(today)
  const [description, setDescription] = useState('')
  const [amount, setAmount]           = useState('')
  const [category, setCategory]       = useState(type === 'income' ? 'Ingreso cliente' : 'Sin categoría')
  const [isRecurring, setRecurring]   = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return
    onSave({ date, description: description.trim(), amount: amt, type, category, isRecurring })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            {type === 'income' ? '+ Ingreso esperado' : '+ Gasto planificado'}
          </h2>
          <button onClick={onClose} disabled={saving} className="text-zinc-400 hover:text-zinc-700">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Fecha esperada
              </label>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Importe (€)
              </label>
              <input
                type="number" min="0.01" step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)} required placeholder="0"
                className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Descripción</label>
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)} required
              placeholder={type === 'income' ? 'Ej. Pago cliente ABC' : 'Ej. Suscripción mensual'}
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Categoría</label>
            <select
              value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            >
              {CASHFLOW_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {type === 'expense' && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setRecurring(!isRecurring)}
                className={`w-9 h-5 rounded-full transition-colors relative ${isRecurring ? 'bg-zinc-900' : 'bg-zinc-200'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isRecurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-zinc-600">¿Es recurrente? (mensual)</span>
            </label>
          )}

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="text-sm text-zinc-500 hover:text-zinc-700 px-2 py-1.5">Cancelar</button>
            <button type="submit" disabled={saving} className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 px-5 py-2 rounded-lg disabled:opacity-50 transition-colors">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tooltip for projection chart ──────────────────────────────────────────────

interface TooltipEntry { name: string; value: number }

function ProjectionTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null
  const bal = payload[0]?.value ?? 0
  return (
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-zinc-100 text-xs">
      <p className="font-semibold text-zinc-700 mb-1">{label}</p>
      <p className="font-mono" style={{ color: bal > 5000 ? '#34c759' : bal > 1000 ? '#ff9f0a' : '#ff3b30' }}>
        Saldo: {formatEurFull(bal)}
      </p>
    </div>
  )
}

// ── Semáforo dot ───────────────────────────────────────────────────────────────

const SEMAFORO_COLORS = { green: '#34c759', yellow: '#ff9f0a', red: '#ff3b30' }

function Semaforo({ status }: { status: 'green' | 'yellow' | 'red' }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ background: SEMAFORO_COLORS[status] }}
    />
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
  const router  = useRouter()
  const [, startTransition] = useTransition()

  const [addModal, setAddModal]   = useState<'income' | 'expense' | null>(null)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [ignored, setIgnored]     = useState<Set<string>>(new Set())
  const [pendingConfirm, setPendingConfirm] = useState<Set<string>>(new Set())

  // Filter out suggestions that are already confirmed as recurring
  const confirmedDescs = new Set(plannedItems.filter((p) => p.isRecurring).map((p) => p.description))
  const visibleSuggestions = suggestedRecurring.filter(
    (s) => !ignored.has(s.description) && !confirmedDescs.has(s.description),
  )

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

  // ── Y-axis domain for chart ──────────────────────────────────────────────────
  const balances = projection.map((p) => p.balance)
  const yMin = Math.min(0, ...balances)
  const yMax = Math.max(...balances)
  const yPad = Math.max((yMax - yMin) * 0.1, 1000)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Row 1: Ingresos + Gastos ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Ingresos esperados */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Ingresos esperados
            </p>
            <button
              onClick={() => { setSaveError(null); setAddModal('income') }}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <PlusIcon className="w-3 h-3" /> Añadir
            </button>
          </div>

          <div className="space-y-2">
            {/* Pending invoices (from orvex) */}
            {pendingInvoices.length === 0 && plannedItems.filter((p) => p.type === 'income').length === 0 && (
              <p className="text-xs text-zinc-400 py-4 text-center">Sin ingresos esperados</p>
            )}

            {pendingInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b border-zinc-50">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-700 truncate">
                    {inv.number} · {inv.clientName}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    Vence: {inv.dueAt ? new Date(inv.dueAt + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—'}
                    {' · '}
                    <span className="text-amber-600 font-medium">pendiente de cobro</span>
                  </p>
                </div>
                <span className="text-xs font-semibold font-mono text-emerald-600 shrink-0">
                  +{formatEurFull(inv.amountTotal)}
                </span>
              </div>
            ))}

            {/* Manual planned incomes */}
            {plannedItems.filter((p) => p.type === 'income').map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b border-zinc-50">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-700 truncate">{item.description}</p>
                  <p className="text-[10px] text-zinc-400">
                    {new Date(item.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                    {' · '}{item.category}
                    {item.isRecurring && ' · 🔄 recurrente'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold font-mono text-emerald-600">
                    +{formatEurFull(item.amount)}
                  </span>
                  <button onClick={() => handleDelete(item.id)} className="text-zinc-300 hover:text-red-400 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gastos planificados */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Gastos planificados
            </p>
            <button
              onClick={() => { setSaveError(null); setAddModal('expense') }}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <PlusIcon className="w-3 h-3" /> Añadir
            </button>
          </div>

          <div className="space-y-2">
            {/* Suggested recurring */}
            {visibleSuggestions.map((s) => (
              <div key={s.description} className="flex items-start justify-between gap-3 py-2 border-b border-zinc-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">sugerido</span>
                  </div>
                  <p className="text-xs font-medium text-zinc-700 truncate">{s.description}</p>
                  <p className="text-[10px] text-zinc-400">{s.category} · ~{formatEurFull(s.averageAmount)}/mes</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleConfirm(s)}
                    disabled={pendingConfirm.has(s.description)}
                    className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setIgnored((p) => new Set(p).add(s.description))}
                    className="text-[11px] font-medium text-zinc-500 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-md transition-colors"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            ))}

            {/* Manual planned expenses */}
            {plannedItems.filter((p) => p.type === 'expense').length === 0 && visibleSuggestions.length === 0 && (
              <p className="text-xs text-zinc-400 py-4 text-center">Sin gastos planificados</p>
            )}

            {plannedItems.filter((p) => p.type === 'expense').map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b border-zinc-50">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-700 truncate">{item.description}</p>
                  <p className="text-[10px] text-zinc-400">
                    {new Date(item.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                    {' · '}{item.category}
                    {item.isRecurring && ' · 🔄 recurrente'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold font-mono text-red-500">
                    −{formatEurFull(item.amount)}
                  </span>
                  <button onClick={() => handleDelete(item.id)} className="text-zinc-300 hover:text-red-400 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Projection table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">
          Proyección mes a mes · próximos 6 meses
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Mes</th>
                <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Ingresos esp.</th>
                <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Gastos plan.</th>
                <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Saldo proy.</th>
                <th className="pb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {projection.map((p) => (
                <tr key={p.monthKey} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                  <td className="py-3 text-xs font-medium text-zinc-700 capitalize">{p.label}</td>
                  <td className="py-3 text-xs font-mono text-right text-emerald-600">
                    {p.income > 0 ? `+${formatEurFull(p.income)}` : '—'}
                  </td>
                  <td className="py-3 text-xs font-mono text-right text-red-500">
                    {p.expense > 0 ? `−${formatEurFull(p.expense)}` : '—'}
                  </td>
                  <td className="py-3 text-xs font-mono font-semibold text-right" style={{ color: SEMAFORO_COLORS[p.status] }}>
                    {formatEurFull(p.balance)}
                  </td>
                  <td className="py-3 text-center">
                    <Semaforo status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-400 mt-3">
          🟢 &gt;5.000 € · 🟡 1.000–5.000 € · 🔴 &lt;1.000 €
          {' · '}Saldo inicial: {formatEurFull(currentBalance)}
        </p>
      </div>

      {/* ── Row 3: Projection chart ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">
          Saldo proyectado
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={projection} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            {/* Background zones */}
            <ReferenceArea y1={5000} fill="#34c75908" stroke="none" />
            <ReferenceArea y1={1000} y2={5000} fill="#ff9f0a08" stroke="none" />
            <ReferenceArea y2={1000} fill="#ff3b3008" stroke="none" />
            <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} dy={4} />
            <YAxis
              tickFormatter={(v: number) => formatEur(v)}
              tick={{ fontSize: 10, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
              dx={-4}
              width={48}
              domain={[yMin - yPad, yMax + yPad]}
            />
            <Tooltip content={<ProjectionTooltip />} />
            <ReferenceLine y={1000} stroke="#ff9f0a" strokeDasharray="4 2" strokeWidth={1} />
            <ReferenceLine y={5000} stroke="#34c759" strokeDasharray="4 2" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#0071e3"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 4, fill: '#0071e3', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#0071e3', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Add modal ────────────────────────────────────────────────────────── */}
      {addModal && (
        <AddItemModal
          type={addModal}
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
