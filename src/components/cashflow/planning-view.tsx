'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { upsertPresupuestoAction } from '@/app/actions/cashflow-presupuesto'
import type { Presupuesto } from '@/lib/supabase/cashflow-presupuesto'
import type { CashflowTransaction } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const BUDGET_CATEGORIES = [
  'Nómina', 'Hardware', 'Administrativo', 'Impuestos', 'Préstamos',
  'Oficina', 'Viajes', 'Servidores/Hosting', 'Base de datos', 'Herramientas IA',
  'Comunicaciones', 'Marketing', 'Otras herramientas', 'Traspaso interno', 'Refunds', 'Otros',
] as const

type Period = 'semana' | 'mes'

// ── Formatters ─────────────────────────────────────────────────────────────────

const _EUR2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function eur(n: number) { return `${_EUR2.format(n)} €` }

// ── Date helpers ───────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCurrentWeekRange(): { from: string; to: string } {
  const now = new Date()
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1  // Mon=0 … Sun=6
  const mon = new Date(now)
  mon.setDate(now.getDate() - dow)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: toDateKey(mon), to: toDateKey(sun) }
}

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(lastDay).padStart(2, '0')}` }
}

// ── Traffic-light helpers (for balance strip) ─────────────────────────────────

type TrafficLight = 'green' | 'yellow' | 'red'
function semaforo(b: number): TrafficLight {
  return b > 5000 ? 'green' : b > 1000 ? 'yellow' : 'red'
}
const TRAFFIC_COLORS: Record<TrafficLight, string> = {
  green: '#34c759', yellow: '#ff9f0a', red: '#ff3b30',
}
function TrafficDot({ status, size = 8 }: { status: TrafficLight; size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: TRAFFIC_COLORS[status] }}
    />
  )
}

// ── Budget row computation ─────────────────────────────────────────────────────

interface BudgetRow {
  categoria: string
  presupuestado: number
  real: number
  diferencia: number
  pct: number
}

function computeBudgetRows(
  period: Period,
  presupuestos: Presupuesto[],
  transactions: CashflowTransaction[],
): BudgetRow[] {
  const range = period === 'semana' ? getCurrentWeekRange() : getCurrentMonthRange()
  const periodTx = transactions.filter((t) => t.date >= range.from && t.date <= range.to)

  const presMap = new Map<string, number>(presupuestos.map((p) => [p.categoria, p.presupuestoMensual]))

  const realMap = new Map<string, number>()
  for (const t of periodTx) {
    if (t.amount < 0) {
      realMap.set(t.category, (realMap.get(t.category) ?? 0) + Math.abs(t.amount))
    }
  }

  const rows: BudgetRow[] = []
  for (const cat of BUDGET_CATEGORIES) {
    const monthly = presMap.get(cat) ?? 0
    const presupuestado = period === 'semana' ? monthly / 4 : monthly
    const real = realMap.get(cat) ?? 0
    if (presupuestado === 0 && real === 0) continue
    const diferencia = presupuestado - real
    const pct = presupuestado > 0 ? (real / presupuestado) * 100 : 0
    rows.push({ categoria: cat, presupuestado, real, diferencia, pct })
  }
  return rows
}

// ── Balance strip ──────────────────────────────────────────────────────────────

function BalanceStrip({ currentBalance }: { currentBalance: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center gap-3 sm:gap-0">
      <BalanceChip label="Saldo hoy" value={currentBalance} highlight />
    </div>
  )
}

function BalanceChip({
  label, value, highlight,
}: { label: string; value: number; highlight?: boolean }) {
  const st = semaforo(value)
  return (
    <div className="flex items-center gap-2.5 px-0 sm:px-5 first:pl-0 last:pr-0">
      <TrafficDot status={st} size={10} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
        <p
          className={`font-bold tracking-tight ${highlight ? 'text-xl text-zinc-900' : 'text-lg'}`}
          style={{ color: highlight ? undefined : TRAFFIC_COLORS[st] }}
        >
          {eur(value)}
        </p>
      </div>
    </div>
  )
}

// ── Inline presupuesto editor ─────────────────────────────────────────────────

function InlineEdit({
  categoria,
  value,
  onSaved,
}: {
  categoria: string
  value: number
  onSaved: (categoria: string, val: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const [saving, setSaving]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(value === 0 ? '' : String(value))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commit() {
    const parsed = parseFloat(draft.replace(',', '.'))
    const next   = isNaN(parsed) || parsed < 0 ? value : parsed
    if (next !== value) {
      setSaving(true)
      const res = await upsertPresupuestoAction(categoria, next)
      setSaving(false)
      if (res.ok) onSaved(categoria, next)
    }
    setEditing(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); void commit() }
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKeyDown}
        disabled={saving}
        className="w-28 text-right text-xs font-mono bg-zinc-100 border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        placeholder="0,00"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="text-xs font-mono text-zinc-700 hover:text-zinc-900 hover:underline decoration-dotted underline-offset-2 transition-colors cursor-text"
      title="Clic para editar"
    >
      {value === 0 ? <span className="text-zinc-300 italic">—</span> : eur(value)}
    </button>
  )
}

// ── Budget table ──────────────────────────────────────────────────────────────

function BudgetTable({
  rows,
  onPresupuestoSaved,
  presupuestos,
  period,
}: {
  rows: BudgetRow[]
  onPresupuestoSaved: (categoria: string, val: number) => void
  presupuestos: Presupuesto[]
  period: Period
}) {
  // For inline edit we need the raw monthly value per category
  const monthlyMap = new Map<string, number>(presupuestos.map((p) => [p.categoria, p.presupuestoMensual]))

  const totals = rows.reduce(
    (acc, r) => ({
      presupuestado: acc.presupuestado + r.presupuestado,
      real: acc.real + r.real,
      diferencia: acc.diferencia + r.diferencia,
    }),
    { presupuestado: 0, real: 0, diferencia: 0 },
  )
  const totalPct = totals.presupuestado > 0 ? (totals.real / totals.presupuestado) * 100 : 0

  const difColor = (d: number) => d >= 0 ? '#34c759' : '#ff3b30'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/60">
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Categoría
            </th>
            <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-36">
              Presupuestado {period === 'semana' ? '(semana)' : '(mes)'}
            </th>
            <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-32">
              Real
            </th>
            <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-32">
              Diferencia
            </th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400 w-44">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-sm text-zinc-300">
                Sin presupuesto configurado. Haz clic en — para añadir.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const over    = row.pct > 100
            const barPct  = Math.min(row.pct, 100)
            const monthly = monthlyMap.get(row.categoria) ?? 0

            return (
              <tr
                key={row.categoria}
                className="border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors"
              >
                {/* Categoría */}
                <td className="px-5 py-3">
                  <span className="text-xs font-medium text-zinc-700">{row.categoria}</span>
                </td>

                {/* Presupuestado — inline editable (always edits monthly value) */}
                <td className="px-4 py-3 text-right">
                  <InlineEdit
                    categoria={row.categoria}
                    value={monthly}
                    onSaved={onPresupuestoSaved}
                  />
                </td>

                {/* Real */}
                <td className="px-4 py-3 text-right">
                  <span className="text-xs font-mono text-zinc-700">{eur(row.real)}</span>
                </td>

                {/* Diferencia */}
                <td className="px-4 py-3 text-right">
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: difColor(row.diferencia) }}
                  >
                    {row.diferencia >= 0 ? '+' : '−'}{eur(Math.abs(row.diferencia))}
                  </span>
                </td>

                {/* % + progress bar */}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${barPct}%`,
                          background: over ? '#ff3b30' : '#0071e3',
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-mono shrink-0 w-12 text-right"
                      style={{ color: over ? '#ff3b30' : '#64748b' }}
                    >
                      {row.presupuestado > 0 ? `${Math.round(row.pct)}%` : '—'}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>

        {/* Totals row */}
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-zinc-200 bg-zinc-50/80">
              <td className="px-5 py-3">
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Total</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-xs font-mono font-bold text-zinc-700">{eur(totals.presupuestado)}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-xs font-mono font-bold text-zinc-700">{eur(totals.real)}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: difColor(totals.diferencia) }}
                >
                  {totals.diferencia >= 0 ? '+' : '−'}{eur(Math.abs(totals.diferencia))}
                </span>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(totalPct, 100)}%`,
                        background: totalPct > 100 ? '#ff3b30' : '#0071e3',
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-mono shrink-0 w-12 text-right font-bold"
                    style={{ color: totalPct > 100 ? '#ff3b30' : '#64748b' }}
                  >
                    {totals.presupuestado > 0 ? `${Math.round(totalPct)}%` : '—'}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ── Also render rows for categories with real spend but no budget ─────────────
// (already handled in computeBudgetRows — real > 0 || presupuesto > 0)

// ── Missing-budget rows (show all budget categories inline-editable) ──────────
//
// We also want to show ALL BUDGET_CATEGORIES as editable even if presupuesto=0
// and real=0, so the user can set budgets. This is handled by the table: if
// presupuestado=0 AND real=0 the row is hidden. User clicks an empty month/week
// cell to set a budget for the first time — but those rows are hidden.
//
// To allow first-time budget entry: show a secondary "Sin presupuesto" section
// listing categories not yet in the table, so user can click to add them.

function UnbudgetedCategories({
  existing,
  onSaved,
}: {
  existing: string[]
  onSaved: (categoria: string, val: number) => void
}) {
  const missing = BUDGET_CATEGORIES.filter((c) => !existing.includes(c))
  if (missing.length === 0) return null

  return (
    <div className="px-5 py-3 border-t border-zinc-100">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
        Sin presupuesto configurado
      </p>
      <div className="flex flex-wrap gap-2">
        {missing.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5">
            <span className="text-xs text-zinc-500">{cat}</span>
            <InlineEdit categoria={cat} value={0} onSaved={onSaved} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export interface PlanningViewProps {
  currentBalance: number
  presupuestos: Presupuesto[]
  allTransactions: CashflowTransaction[]
}

export function PlanningView({
  currentBalance,
  presupuestos: initialPresupuestos,
  allTransactions,
}: PlanningViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [period, setPeriod]                 = useState<Period>('mes')
  const [presupuestos, setPresupuestos]     = useState(initialPresupuestos)

  const handlePresupuestoSaved = useCallback((categoria: string, val: number) => {
    setPresupuestos((prev) => {
      const idx = prev.findIndex((p) => p.categoria === categoria)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], presupuestoMensual: val }
        return next
      }
      return [...prev, { id: '', categoria, presupuestoMensual: val, createdAt: '' }]
    })
    // Background revalidate
    startTransition(() => router.refresh())
  }, [router, startTransition])

  const rows = computeBudgetRows(period, presupuestos, allTransactions)
  const budgetedCategories = rows.map((r) => r.categoria)

  return (
    <div className="space-y-5">

      {/* Balance strip */}
      <BalanceStrip currentBalance={currentBalance} />

      {/* Budget section */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Presupuesto vs Real
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {period === 'semana' ? 'Semana actual' : 'Mes actual'} · haz clic en Presupuestado para editar
            </p>
          </div>

          {/* Period toggle */}
          <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5">
            {(['semana', 'mes'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {p === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <BudgetTable
          rows={rows}
          onPresupuestoSaved={handlePresupuestoSaved}
          presupuestos={presupuestos}
          period={period}
        />

        {/* Categories not yet budgeted */}
        <UnbudgetedCategories
          existing={budgetedCategories}
          onSaved={handlePresupuestoSaved}
        />
      </div>

    </div>
  )
}
