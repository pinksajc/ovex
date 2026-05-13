'use client'

import { useState, useMemo, useTransition, useOptimistic } from 'react'
import { updateCashflowCategoryAction } from '@/app/actions/cashflow'
import type { CashflowTransaction } from '@/types'

const CATEGORIES = [
  'Sin categoría',
  'Ingreso cliente',
  'Nómina',
  'Proveedor',
  'Impuestos',
  'Software',
  'Marketing',
  'Oficina',
  'Otros',
] as const

function formatEur(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1000)
    return `${n < 0 ? '−' : '+'}${(abs / 1000).toFixed(2).replace(/\.?0+$/, '')}k €`
  return `${n < 0 ? '−' : '+'}${abs.toFixed(2)} €`
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

const PAGE_SIZE = 50

// ── Category cell with inline dropdown ────────────────────────────────────────

function CategoryCell({
  id,
  category,
}: {
  id: string
  category: string
}) {
  const [editing, setEditing] = useState(false)
  const [optimistic, setOptimistic] = useOptimistic(category)
  const [, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    startTransition(async () => {
      setOptimistic(next)
      setEditing(false)
      await updateCashflowCategoryAction(id, next)
    })
  }

  if (editing) {
    return (
      <select
        value={optimistic}
        onChange={handleChange}
        onBlur={() => setEditing(false)}
        autoFocus
        className="text-xs border border-blue-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
    >
      <span>{optimistic}</span>
      <PencilIcon className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TransactionsTable({ transactions }: { transactions: CashflowTransaction[] }) {
  const [search, setSearch]       = useState('')
  const [typeFilter, setType]     = useState<'all' | 'income' | 'expense'>('all')
  const [catFilter, setCat]       = useState('all')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [page, setPage]           = useState(1)

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Summary for filtered set
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

        <div className="ml-auto text-xs text-zinc-400">
          <span className="font-semibold text-emerald-600">+{formatEur(sumIncome)}</span>
          {' · '}
          <span className="font-semibold text-red-500">{formatEur(sumExpense)}</span>
          {' · '}
          {filtered.length} registros
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-28">
                Fecha
              </th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                Descripción
              </th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-32">
                Importe
              </th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-40">
                Categoría
              </th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-28">
                Estado
              </th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-400 whitespace-nowrap w-32">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-zinc-400">
                  Sin transacciones para los filtros seleccionados
                </td>
              </tr>
            ) : (
              paged.map((t) => (
                <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                  <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap font-mono">
                    {formatDate(t.date)}
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-700 max-w-xs truncate">
                    {t.description}
                  </td>
                  <td
                    className={`px-5 py-3 text-xs font-semibold font-mono text-right whitespace-nowrap ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {formatEur(t.amount)}
                  </td>
                  <td className="px-5 py-3">
                    <CategoryCell id={t.id} category={t.category} />
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {t.state ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-zinc-400 text-right whitespace-nowrap">
                    {t.balance != null ? `${t.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
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

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8.5 1.5 10.5 3.5 4 10H2V8L8.5 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
