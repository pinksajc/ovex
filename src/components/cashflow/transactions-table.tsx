'use client'

import { useState, useMemo, useTransition, useOptimistic, useEffect } from 'react'
import { updateCashflowCategoryAction } from '@/app/actions/cashflow'
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
    <div className="relative">
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

// ── Transaction row (shared between flat + expanded grouped) ──────────────────

function TxRow({ t }: { t: CashflowTransaction }) {
  return (
    <tr className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
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
            </tr>
          </thead>
          <tbody>
            {grouped ? (
              // ── Grouped view ────────────────────────────────────────────────
              groupedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-zinc-400">
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
                        <td colSpan={3} />
                      </tr>
                      {/* Expanded transaction rows */}
                      {isExpanded && group.transactions.map((t) => (
                        <TxRow key={t.id} t={t} />
                      ))}
                    </>
                  )
                })
              )
            ) : (
              // ── Flat view ────────────────────────────────────────────────────
              paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-zinc-400">
                    Sin transacciones para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                paged.map((t) => <TxRow key={t.id} t={t} />)
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
