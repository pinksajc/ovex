'use client'

import { useState, useMemo, useTransition, useOptimistic, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateCashflowCategoryAction,
  updateManualTransactionAction,
  deleteManualTransactionAction,
} from '@/app/actions/cashflow'
import { CASHFLOW_CATEGORIES } from '@/lib/cashflow-categories'
import type { CashflowTransaction } from '@/types'

const _EUR2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function formatEur(n: number) {
  return `${n < 0 ? '−' : '+'}${_EUR2.format(Math.abs(n))} €`
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

function formatDateFull(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Split "base — notes" stored description into its two parts. */
function parseDescriptionNotes(description: string): { base: string; notes: string } {
  const idx = description.indexOf(' — ')
  if (idx === -1) return { base: description, notes: '' }
  return { base: description.slice(0, idx), notes: description.slice(idx + 3) }
}

const PAGE_SIZE = 50

// ── Category cell with inline dropdown + "Regla guardada" toast ───────────────

function CategoryCell({
  id,
  description,
  category,
}: {
  id: string
  description: string
  category: string
}) {
  const [editing, setEditing]       = useState(false)
  const [optimistic, setOptimistic] = useOptimistic(category)
  const [, startTransition]         = useTransition()
  const [toast, setToast]           = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 2500)
    return () => clearTimeout(t)
  }, [toast])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    startTransition(async () => {
      setOptimistic(next)
      setEditing(false)
      const result = await updateCashflowCategoryAction(id, description, next)
      if (result.ruleCreated) setToast(true)
    })
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {editing ? (
        <select
          value={optimistic}
          onChange={handleChange}
          onBlur={() => setEditing(false)}
          autoFocus
          className="text-xs border border-blue-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {CASHFLOW_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <span>{optimistic}</span>
          <PencilIcon className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
        </button>
      )}
      {toast && (
        <div className="absolute left-0 top-full mt-1 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
            ✓ Regla guardada
          </span>
        </div>
      )}
    </div>
  )
}

// ── Edit Transaction Modal ─────────────────────────────────────────────────────

interface EditFormState {
  date: string
  description: string
  amount: string
  type: 'income' | 'expense'
  category: string
  notes: string
}

function EditTransactionModal({
  transaction,
  onClose,
  onSaved,
}: {
  transaction: CashflowTransaction
  onClose: () => void
  onSaved: () => void
}) {
  const { base, notes: parsedNotes } = parseDescriptionNotes(transaction.description)
  const absAmount = Math.abs(transaction.amount)
  const txType: 'income' | 'expense' = transaction.amount >= 0 ? 'income' : 'expense'

  const [form, setForm] = useState<EditFormState>({
    date: transaction.date,
    description: base,
    amount: absAmount.toString(),
    type: txType,
    category: transaction.category,
    notes: parsedNotes,
  })
  const [error, setError]           = useState<string | null>(null)
  const [isPending, startTrans]     = useTransition()
  const [confirmDelete, setConfirm] = useState(false)
  const [isDeleting, startDelete]   = useTransition()

  function set<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleTypeChange(t: 'income' | 'expense') {
    setForm((f) => ({
      ...f,
      type: t,
      category: t === 'income' ? 'Ingreso cliente' : 'Sin categoría',
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      setError('El importe debe ser mayor que 0')
      return
    }
    if (!form.description.trim()) {
      setError('La descripción es obligatoria')
      return
    }
    startTrans(async () => {
      const result = await updateManualTransactionAction(transaction.id, {
        date: form.date,
        description: form.description.trim(),
        amount,
        type: form.type,
        category: form.category,
        notes: form.notes.trim() || undefined,
      })
      if (result.ok) {
        onSaved()
      } else {
        setError(result.error ?? 'Error al guardar')
      }
    })
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteManualTransactionAction(transaction.id)
      if (result.ok) {
        onSaved()
      } else {
        setError(result.error ?? 'Error al eliminar')
        setConfirm(false)
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isPending && !isDeleting) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Editar transacción</h2>
          <button
            onClick={onClose}
            disabled={isPending || isDeleting}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Tipo toggle */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Tipo
            </label>
            <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 w-fit">
              {(['income', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`px-5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    form.type === t
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {t === 'income' ? 'Ingreso' : 'Gasto'}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha + Importe row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Fecha
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                required
                className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Importe (€)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                required
                placeholder="0.00"
                className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Descripción
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
              placeholder="Ej. Factura cliente XYZ"
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Categoría
            </label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            >
              {CASHFLOW_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Notas <span className="normal-case font-normal text-zinc-400">(opcional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Información adicional…"
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-1">
            {/* Delete section */}
            <div className="flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-xs text-zinc-500">¿Eliminar?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(false)}
                    disabled={isDeleting}
                    className="text-xs text-zinc-500 hover:text-zinc-700 transition-colors px-1"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirm(true)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending || isDeleting}
                className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors px-2 py-1.5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || isDeleting}
                className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Transaction Detail Panel ───────────────────────────────────────────────────

function TransactionDetailPanel({
  transaction,
  onClose,
  onEdit,
}: {
  transaction: CashflowTransaction | null
  onClose: () => void
  onEdit: (t: CashflowTransaction) => void
}) {
  const visible = transaction !== null

  if (!transaction) {
    return (
      <>
        {/* Overlay */}
        <div
          className="fixed inset-0 z-40"
          style={{
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 200ms',
          }}
        />
        {/* Panel */}
        <div
          className="fixed top-0 right-0 h-full w-[380px] bg-white shadow-2xl z-40 flex flex-col"
          style={{
            transform: 'translateX(100%)',
            transition: 'transform 250ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </>
    )
  }

  const { base, notes } = parseDescriptionNotes(transaction.description)
  const isManual = transaction.sourceFile === 'manual'
  const isInvoice = transaction.sourceFile === 'orvex-facturas'
  const sourceLabel = isManual ? 'Manual' : isInvoice ? 'Orvex Facturas' : 'Revolut'

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{
          background: 'rgba(0,0,0,0.15)',
          pointerEvents: visible ? 'auto' : 'none',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full w-[380px] bg-white shadow-2xl z-50 flex flex-col"
        style={{
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 250ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Detalle
          </p>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Amount — large display */}
          <div>
            <p className={`text-3xl font-bold tracking-tight ${
              transaction.amount >= 0 ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {formatEur(transaction.amount)}
            </p>
            <p className="text-xs text-zinc-400 mt-1">{formatDateFull(transaction.date)}</p>
          </div>

          <hr className="border-zinc-100" />

          {/* Fields */}
          <div className="space-y-4">
            <DetailRow label="Descripción" value={base} />

            {notes && (
              <DetailRow label="Notas" value={notes} />
            )}

            <DetailRow label="Categoría" value={transaction.category} />

            <DetailRow
              label="Estado"
              value={
                transaction.state
                  ? transaction.state
                  : (
                    <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-400">
                      MANUAL
                    </span>
                  )
              }
            />

            <DetailRow
              label="Saldo tras operación"
              value={
                transaction.balance != null
                  ? `${_EUR2.format(transaction.balance)} €`
                  : '—'
              }
            />

            <DetailRow label="Moneda" value={transaction.currency} />

            <DetailRow
              label="Fuente"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {sourceLabel}
                  {isManual && (
                    <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-400">
                      MANUAL
                    </span>
                  )}
                </span>
              }
            />

            <DetailRow label="ID" value={<span className="font-mono text-[10px] text-zinc-400">{transaction.id}</span>} />
          </div>

          {/* Invoice link */}
          {isInvoice && (
            <a
              href="/facturas"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors mt-2"
            >
              Ver factura →
            </a>
          )}
        </div>

        {/* Footer (manual only) */}
        {isManual && (
          <div className="px-5 py-4 border-t border-zinc-100 shrink-0">
            <button
              onClick={() => { onEdit(transaction); onClose() }}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 px-4 py-2.5 rounded-xl transition-colors"
            >
              <PencilIcon className="w-3.5 h-3.5" />
              Editar transacción
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">
        {label}
      </p>
      <p className="text-sm text-zinc-700 leading-snug">{value}</p>
    </div>
  )
}

// ── Transaction row ────────────────────────────────────────────────────────────

function TxRow({
  t,
  onRowClick,
  onEditClick,
}: {
  t: CashflowTransaction
  onRowClick: (t: CashflowTransaction) => void
  onEditClick: (t: CashflowTransaction) => void
}) {
  const isManual = t.sourceFile === 'manual'
  return (
    <tr
      onClick={() => onRowClick(t)}
      className="group border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors cursor-pointer"
    >
      <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap font-mono">
        {formatDate(t.date)}
      </td>
      <td className="px-5 py-3 text-xs text-zinc-700 max-w-xs truncate">
        {t.description}
      </td>
      <td className={`px-5 py-3 text-xs font-semibold font-mono text-right whitespace-nowrap ${
        t.type === 'income' ? 'text-emerald-600' : 'text-red-500'
      }`}>
        {formatEur(t.amount)}
      </td>
      <td className="px-5 py-3">
        <CategoryCell id={t.id} description={t.description} category={t.category} />
      </td>
      <td className="px-5 py-3 text-xs text-zinc-400 whitespace-nowrap">
        {t.state
          ? t.state
          : <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-400">MANUAL</span>
        }
      </td>
      <td className="px-5 py-3 text-xs font-mono text-zinc-400 text-right whitespace-nowrap">
        {t.balance != null
          ? `${_EUR2.format(t.balance)} €`
          : '—'}
      </td>
      {/* Edit icon column — only visible for manual rows, shown on hover */}
      <td className="px-3 py-3 w-8 text-right">
        {isManual && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditClick(t) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 p-0.5 rounded"
            title="Editar"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface GroupEntry {
  category: string
  total: number
  count: number
  transactions: CashflowTransaction[]
}

export function TransactionsTable({ transactions }: { transactions: CashflowTransaction[] }) {
  const router = useRouter()

  // Debug: log first manual transaction on mount so balance field is visible in browser console
  useEffect(() => {
    const firstManual = transactions.find((t) => t.sourceFile === 'manual')
    console.log('[cashflow/table] first manual tx:', firstManual ?? 'none found')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch]       = useState('')
  const [typeFilter, setType]     = useState<'all' | 'income' | 'expense'>('all')
  const [catFilter, setCat]       = useState('all')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [page, setPage]           = useState(1)
  const [grouped, setGrouped]     = useState(false)
  const [expandedCats, setExpCats] = useState<Set<string>>(new Set())

  // Panel + edit modal state
  const [selectedTx, setSelectedTx]   = useState<CashflowTransaction | null>(null)
  const [editingTx, setEditingTx]     = useState<CashflowTransaction | null>(null)

  const handleRowClick = useCallback((t: CashflowTransaction) => {
    setSelectedTx(t)
  }, [])

  const handleEditClick = useCallback((t: CashflowTransaction) => {
    setEditingTx(t)
    setSelectedTx(null)
  }, [])

  const handleSaved = useCallback(() => {
    setEditingTx(null)
    setSelectedTx(null)
    router.refresh()
  }, [router])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (catFilter !== 'all' && t.category !== catFilter) return false
      if (dateFrom && t.date < dateFrom) return false
      if (dateTo   && t.date > dateTo)   return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [transactions, typeFilter, catFilter, dateFrom, dateTo, search])

  // ── Grouped data ─────────────────────────────────────────────────────────────
  const groupedData = useMemo<GroupEntry[]>(() => {
    const map = new Map<string, { total: number; txs: CashflowTransaction[] }>()
    for (const t of filtered) {
      const rec = map.get(t.category) ?? { total: 0, txs: [] }
      rec.total += t.amount
      rec.txs.push(t)
      map.set(t.category, rec)
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => Math.abs(b.total) - Math.abs(a.total))
      .map(([category, { total, txs }]) => ({
        category,
        total,
        count: txs.length,
        transactions: txs.sort((a, b) => b.date.localeCompare(a.date)),
      }))
  }, [filtered])

  function toggleCat(cat: string) {
    setExpCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }
  function expandAll()   { setExpCats(new Set(groupedData.map((g) => g.category))) }
  function collapseAll() { setExpCats(new Set()) }

  // ── Flat view pagination ──────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const sumIncome  = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const sumExpense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const allCategories = Array.from(new Set(transactions.map((t) => t.category))).sort()

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm">
        {/* Filters */}
        <div className="p-5 border-b border-zinc-100 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar descripción…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="text-xs bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-52"
          />

          {/* Type filter */}
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
            {(['all', 'income', 'expense'] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setType(v); setPage(1) }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  typeFilter === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {v === 'all' ? 'Todo' : v === 'income' ? 'Ingresos' : 'Gastos'}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <select
            value={catFilter}
            onChange={(e) => { setCat(e.target.value); setPage(1) }}
            className="text-xs bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-300"
          >
            <option value="all">Todas las categorías</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="text-xs bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-300"
          />
          <span className="text-xs text-zinc-400">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="text-xs bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-300"
          />

          {/* Group toggle */}
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
            <button
              onClick={() => { setGrouped(false) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !grouped ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Ver todas
            </button>
            <button
              onClick={() => { setGrouped(true); setExpCats(new Set()) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                grouped ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Agrupar por categoría
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {grouped && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={expandAll}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  Expandir todo
                </button>
                <span className="text-zinc-300">·</span>
                <button
                  onClick={collapseAll}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  Colapsar todo
                </button>
              </div>
            )}
            <div className="text-xs text-zinc-400">
              <span className="font-semibold text-emerald-600">+{formatEur(sumIncome)}</span>
              {' · '}
              <span className="font-semibold text-red-500">{formatEur(sumExpense)}</span>
              {' · '}
              {filtered.length} registros
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-28">Fecha</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Descripción</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-32">Importe</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-44">Categoría</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-28">Estado</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-32">Saldo</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {grouped ? (
                // ── Grouped view ────────────────────────────────────────────────
                groupedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-zinc-400">
                      Sin transacciones para los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  groupedData.map((group) => {
                    const isExpanded = expandedCats.has(group.category)
                    const isIncome   = group.total >= 0
                    return (
                      <>
                        {/* Group header row */}
                        <tr
                          key={`grp-${group.category}`}
                          onClick={() => toggleCat(group.category)}
                          className="border-b border-zinc-100 bg-zinc-50/70 hover:bg-zinc-100/60 cursor-pointer transition-colors select-none"
                        >
                          <td className="px-5 py-3" colSpan={2}>
                            <div className="flex items-center gap-2">
                              <ChevronIcon
                                open={isExpanded}
                                className="w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform"
                              />
                              <span className="text-xs font-semibold text-zinc-700">
                                {group.category}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {group.count} transacción{group.count !== 1 ? 'es' : ''}
                              </span>
                            </div>
                          </td>
                          <td className={`px-5 py-3 text-xs font-bold font-mono text-right whitespace-nowrap ${
                            isIncome ? 'text-emerald-600' : 'text-red-500'
                          }`}>
                            {formatEur(group.total)}
                          </td>
                          <td colSpan={4} />
                        </tr>
                        {/* Expanded transaction rows */}
                        {isExpanded && group.transactions.map((t) => (
                          <TxRow
                            key={t.id}
                            t={t}
                            onRowClick={handleRowClick}
                            onEditClick={handleEditClick}
                          />
                        ))}
                      </>
                    )
                  })
                )
              ) : (
                // ── Flat view ────────────────────────────────────────────────────
                paged.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-zinc-400">
                      Sin transacciones para los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  paged.map((t) => (
                    <TxRow
                      key={t.id}
                      t={t}
                      onRowClick={handleRowClick}
                      onEditClick={handleEditClick}
                    />
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination (flat view only) */}
        {!grouped && totalPages > 1 && (
          <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Página {safePage} de {totalPages} · {filtered.length} registros
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs border border-zinc-200 rounded-md text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <button
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs border border-zinc-200 rounded-md text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel — outside the card, fixed position */}
      <TransactionDetailPanel
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        onEdit={handleEditClick}
      />

      {/* Edit modal */}
      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8.5 1.5 10.5 3.5 4 10H2V8L8.5 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h10M4 3V1.5h4V3M5 5.5v3M7 5.5v3M2 3l.75 7.5h6.5L10 3" />
    </svg>
  )
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={className}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2l4 4-4 4" />
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
