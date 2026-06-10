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
import { chartColors, colors } from '@/lib/design-tokens'
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
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="bg-surface border border-border-subtle rounded-lg shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-text-primary">
            {type === 'income' ? '+ Ingreso esperado' : '+ Gasto planificado'}
          </h2>
          <button onClick={onClose} disabled={saving} className="text-text-tertiary hover:text-text-secondary transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">
                Fecha esperada
              </label>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                className="w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">
                Importe (€)
              </label>
              <input
                type="number" min="0.01" step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)} required placeholder="0"
                className="w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">Descripción</label>
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)} required
              placeholder={type === 'income' ? 'Ej. Pago cliente ABC' : 'Ej. Suscripción mensual'}
              className="w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">Categoría</label>
            <select
              value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {CASHFLOW_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {type === 'expense' && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setRecurring(!isRecurring)}
                className={`w-9 h-5 rounded-full transition-colors relative ${isRecurring ? 'bg-accent' : 'bg-border-strong'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isRecurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-text-secondary">¿Es recurrente? (mensual)</span>
            </label>
          )}

          {error && <p className="text-xs text-danger bg-danger/8 border border-danger/20 px-3 py-2 rounded-[6px]">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="text-[13px] text-text-tertiary hover:text-text-secondary px-2 py-1.5 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="text-[13px] font-medium text-base bg-accent hover:bg-accent-hover px-5 h-9 rounded-[6px] disabled:opacity-50 transition-colors">
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
    <div className="rounded-[6px] px-4 py-3 text-xs border" style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}>
      <p className="font-semibold mb-1" style={{ color: chartColors.tooltipText }}>{label}</p>
      <p className="font-mono" style={{ color: bal > 5000 ? colors.success : bal > 1000 ? colors.warning : colors.danger }}>
        Saldo: {formatEurFull(bal)}
      </p>
    </div>
  )
}

// ── Semáforo dot ───────────────────────────────────────────────────────────────

const SEMAFORO_COLORS = { green: colors.success, yellow: colors.warning, red: colors.danger }

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
        <div className="bg-surface border border-border-subtle rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
              Ingresos esperados
            </p>
            <button
              onClick={() => { setSaveError(null); setAddModal('income') }}
              className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 hover:bg-success/15 border border-success/20 px-2.5 h-7 rounded-[6px] transition-colors"
            >
              <PlusIcon className="w-3 h-3" /> Añadir
            </button>
          </div>

          <div className="space-y-2">
            {/* Pending invoices (from orvex) */}
            {pendingInvoices.length === 0 && plannedItems.filter((p) => p.type === 'income').length === 0 && (
              <p className="text-xs text-text-tertiary py-4 text-center">Sin ingresos esperados</p>
            )}

            {pendingInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b border-border-subtle">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {inv.number} · {inv.clientName}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    Vence: {inv.dueAt ? new Date(inv.dueAt + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—'}
                    {' · '}
                    <span className="text-warning font-medium">pendiente de cobro</span>
                  </p>
                </div>
                <span className="text-xs font-semibold font-mono text-success shrink-0">
                  +{formatEurFull(inv.amountTotal)}
                </span>
              </div>
            ))}

            {/* Manual planned incomes */}
            {plannedItems.filter((p) => p.type === 'income').map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b border-border-subtle">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{item.description}</p>
                  <p className="text-[11px] text-text-tertiary">
                    {new Date(item.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                    {' · '}{item.category}
                    {item.isRecurring && ' · 🔄 recurrente'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold font-mono text-success">
                    +{formatEurFull(item.amount)}
                  </span>
                  <button onClick={() => handleDelete(item.id)} className="text-text-tertiary hover:text-danger transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gastos planificados */}
        <div className="bg-surface border border-border-subtle rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
              Gastos planificados
            </p>
            <button
              onClick={() => { setSaveError(null); setAddModal('expense') }}
              className="inline-flex items-center gap-1 text-xs font-medium text-danger bg-danger/10 hover:bg-danger/15 border border-danger/20 px-2.5 h-7 rounded-[6px] transition-colors"
            >
              <PlusIcon className="w-3 h-3" /> Añadir
            </button>
          </div>

          <div className="space-y-2">
            {/* Suggested recurring */}
            {visibleSuggestions.map((s) => (
              <div key={s.description} className="flex items-start justify-between gap-3 py-2 border-b border-border-subtle">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-warning bg-warning/10 px-1.5 py-0.5 rounded-[3px]">sugerido</span>
                  </div>
                  <p className="text-xs font-medium text-text-primary truncate">{s.description}</p>
                  <p className="text-[11px] text-text-tertiary">{s.category} · ~{formatEurFull(s.averageAmount)}/mes</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleConfirm(s)}
                    disabled={pendingConfirm.has(s.description)}
                    className="text-[11px] font-medium text-success bg-success/10 hover:bg-success/15 border border-success/20 px-2 h-6 rounded-[4px] transition-colors disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setIgnored((p) => new Set(p).add(s.description))}
                    className="text-[11px] font-medium text-text-tertiary bg-hover hover:bg-elevated px-2 h-6 rounded-[4px] transition-colors"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            ))}

            {/* Manual planned expenses */}
            {plannedItems.filter((p) => p.type === 'expense').length === 0 && visibleSuggestions.length === 0 && (
              <p className="text-xs text-text-tertiary py-4 text-center">Sin gastos planificados</p>
            )}

            {plannedItems.filter((p) => p.type === 'expense').map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b border-border-subtle">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{item.description}</p>
                  <p className="text-[11px] text-text-tertiary">
                    {new Date(item.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                    {' · '}{item.category}
                    {item.isRecurring && ' · 🔄 recurrente'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold font-mono text-danger">
                    −{formatEurFull(item.amount)}
                  </span>
                  <button onClick={() => handleDelete(item.id)} className="text-text-tertiary hover:text-danger transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Projection table ──────────────────────────────────────────── */}
      <div className="bg-surface border border-border-subtle rounded-lg p-6">
        <p className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary mb-4">
          Proyección mes a mes · próximos 6 meses
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="pb-3 text-left text-[11px] font-medium uppercase tracking-wider text-text-tertiary">Mes</th>
                <th className="pb-3 text-right text-[11px] font-medium uppercase tracking-wider text-text-tertiary">Ingresos esp.</th>
                <th className="pb-3 text-right text-[11px] font-medium uppercase tracking-wider text-text-tertiary">Gastos plan.</th>
                <th className="pb-3 text-right text-[11px] font-medium uppercase tracking-wider text-text-tertiary">Saldo proy.</th>
                <th className="pb-3 text-center text-[11px] font-medium uppercase tracking-wider text-text-tertiary w-16"></th>
              </tr>
            </thead>
            <tbody>
              {projection.map((p) => (
                <tr key={p.monthKey} className="border-b border-border-subtle hover:bg-hover transition-colors duration-150">
                  <td className="py-3 text-xs font-medium text-text-primary capitalize">{p.label}</td>
                  <td className="py-3 text-xs font-mono text-right text-success">
                    {p.income > 0 ? `+${formatEurFull(p.income)}` : '—'}
                  </td>
                  <td className="py-3 text-xs font-mono text-right text-danger">
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
        <p className="text-[11px] text-text-tertiary mt-3">
          🟢 &gt;5.000 € · 🟡 1.000–5.000 € · 🔴 &lt;1.000 €
          {' · '}Saldo inicial: {formatEurFull(currentBalance)}
        </p>
      </div>

      {/* ── Row 3: Projection chart ──────────────────────────────────────────── */}
      <div className="bg-surface border border-border-subtle rounded-lg p-6">
        <p className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary mb-4">
          Saldo proyectado
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={projection} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            {/* Background zones */}
            <ReferenceArea y1={5000} fill={`${colors.success}08`} stroke="none" />
            <ReferenceArea y1={1000} y2={5000} fill={`${colors.warning}08`} stroke="none" />
            <ReferenceArea y2={1000} fill={`${colors.danger}08`} stroke="none" />
            <CartesianGrid strokeDasharray="0" stroke={chartColors.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartColors.axis }} axisLine={false} tickLine={false} dy={4} />
            <YAxis
              tickFormatter={(v: number) => formatEur(v)}
              tick={{ fontSize: 10, fill: chartColors.axis }}
              axisLine={false}
              tickLine={false}
              dx={-4}
              width={48}
              domain={[yMin - yPad, yMax + yPad]}
            />
            <Tooltip content={<ProjectionTooltip />} />
            <ReferenceLine y={1000} stroke={colors.warning} strokeDasharray="4 2" strokeWidth={1} />
            <ReferenceLine y={5000} stroke={colors.success} strokeDasharray="4 2" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="balance"
              stroke={colors.accent}
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 4, fill: colors.accent, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: colors.accent, strokeWidth: 0 }}
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
