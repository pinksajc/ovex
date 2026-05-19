import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getCashflowTransactions, backfillManualBalances } from '@/lib/supabase/cashflow'
import { getCashflowPlanned } from '@/lib/supabase/cashflow-planned'
import { getInvoices } from '@/lib/supabase/invoices'
import { formatCurrency } from '@/lib/format'
import { RecategorizeButton } from '@/components/cashflow/recategorize-button'
import { MoreActionsDropdown } from '@/components/cashflow/more-actions-dropdown'
import { DateRangeFilter } from '@/components/cashflow/date-range-filter'
import { AddTransactionButton } from '@/components/cashflow/add-transaction-button'
import { CashflowTabs } from '@/components/cashflow/cashflow-tabs'
import { PlanningView } from '@/components/cashflow/planning-view'
import { TransactionsTable } from '@/components/cashflow/transactions-table'
import {
  IncomeExpenseChart,
  ExpenseCategoryDonut,
  BalanceTrendChart,
} from '@/components/cashflow/cashflow-charts'
import type { CashflowTransaction } from '@/types'
import type { SuggestedRecurring } from '@/lib/supabase/cashflow-planned'
import type { TxHistoryItem } from '@/components/cashflow/planning-view'

// ── Recurring-expense detector (server-side) ──────────────────────────────────

function detectRecurring(transactions: CashflowTransaction[]): SuggestedRecurring[] {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`

  const thisMap = new Map<string, { amount: number; category: string }>()
  const prevMap = new Map<string, { amount: number; category: string }>()

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const m = t.date.slice(0, 7)
    if (m === thisMonth) thisMap.set(t.description, { amount: Math.abs(t.amount), category: t.category })
    else if (m === prevMonth) prevMap.set(t.description, { amount: Math.abs(t.amount), category: t.category })
  }

  const results: SuggestedRecurring[] = []
  for (const [desc, thisData] of thisMap) {
    const prevData = prevMap.get(desc)
    if (!prevData) continue
    const diff = Math.abs(thisData.amount - prevData.amount) / Math.max(thisData.amount, prevData.amount)
    if (diff <= 0.2) {
      results.push({
        description: desc,
        averageAmount: (thisData.amount + prevData.amount) / 2,
        category: thisData.category,
      })
    }
  }

  return results.sort((a, b) => b.averageAmount - a.averageAmount).slice(0, 15)
}

// ── Transaction history builder (for planning-view modal) ────────────────────

function computeTxHistory(transactions: CashflowTransaction[]): TxHistoryItem[] {
  type Acc = { amounts: number[]; type: 'income' | 'expense'; category: string; lastDate: string }
  const map = new Map<string, Acc>()

  for (const t of transactions) {
    if (t.category === 'Traspaso interno') continue
    const type = t.amount >= 0 ? 'income' : 'expense'
    const abs = Math.abs(t.amount)
    const existing = map.get(t.description)
    if (!existing) {
      map.set(t.description, { amounts: [abs], type, category: t.category, lastDate: t.date })
    } else {
      existing.amounts.push(abs)
      if (t.date > existing.lastDate) existing.lastDate = t.date
    }
  }

  return Array.from(map.entries())
    .map(([description, data]) => ({
      description,
      category: data.category,
      avgAmount: data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length,
      type: data.type,
      count: data.amounts.length,
      lastDate: data.lastDate,
    }))
    .sort((a, b) => b.count - a.count)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'owner' && user.role !== 'admin') redirect('/dashboard')

  const now = new Date()
  const { from: fromParam, to: toParam, tab: tabParam } = await searchParams

  const activeTab = tabParam === 'planning' ? 'planning' : 'transactions'

  // ── Always fetch transactions (needed in both tabs for recurring detection) ──
  let allTransactions = await getCashflowTransactions()

  // ── Debug: log first manual transaction to verify balance field ──────────────
  const firstManual = allTransactions.find((t) => t.sourceFile === 'manual')
  console.log('[cashflow/page] first manual tx (post-fetch):', firstManual
    ? { id: firstManual.id, balance: firstManual.balance, state: firstManual.state, sourceFile: firstManual.sourceFile }
    : 'none found')

  // ── Auto-heal: always run backfill for any null-balance manual txs ────────────
  // Runs one SELECT; only issues UPDATEs when rows actually need fixing.
  const backfilled = await backfillManualBalances()
  if (backfilled > 0) {
    console.log(`[cashflow/page] backfilled ${backfilled} manual tx balance(s) — re-fetching`)
    allTransactions = await getCashflowTransactions()
  }

  // ── Planning tab: additional fetches ─────────────────────────────────────────
  const [plannedItems, allInvoices] =
    activeTab === 'planning'
      ? await Promise.all([getCashflowPlanned(), getInvoices()])
      : [[], [] as Awaited<ReturnType<typeof getInvoices>>]

  const pendingInvoices = allInvoices
    .filter((inv) => inv.status === 'issued')
    .map((inv) => ({
      id: inv.id,
      number: inv.number,
      clientName: inv.clientName,
      amountTotal: inv.amountTotal,
      dueAt: inv.dueAt,
    }))

  const suggestedRecurring = activeTab === 'planning' ? detectRecurring(allTransactions) : []
  const txHistory = activeTab === 'planning' ? computeTxHistory(allTransactions) : []
  const currentBalance = allTransactions.find((t) => t.balance != null)?.balance ?? 0

  // ── Transactions tab: date filtering + KPIs ───────────────────────────────────
  const defaultFrom = `${now.getFullYear()}-01-01`
  const defaultTo   = now.toISOString().split('T')[0]
  const dateFrom    = fromParam ?? defaultFrom
  const dateTo      = toParam   ?? defaultTo

  const transactions = allTransactions.filter((t) => t.date >= dateFrom && t.date <= dateTo)

  // Operational = exclude internal transfers AND loans (loans are tracked separately)
  const operational  = transactions.filter(
    (t) => t.category !== 'Traspaso interno' && t.category !== 'Préstamos',
  )
  const totalIncome  = operational.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpense = operational.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const netBalance   = totalIncome - totalExpense

  const prestamosRows     = transactions.filter((t) => t.category === 'Préstamos')
  const prestamosRecibido = prestamosRows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const prestamosDevuelto = prestamosRows.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const prestamosPendiente = prestamosRecibido - prestamosDevuelto

  const thisMonthKey    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthIncome = transactions
    .filter((t) => t.date.startsWith(thisMonthKey) && t.amount > 0 && t.category !== 'Traspaso interno')
    .reduce((s, t) => s + t.amount, 0)

  return (
    <div className="min-h-full bg-[#f5f5f7] p-8 space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Flujo de Caja</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {allTransactions.length} transacciones · datos de Revolut
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          {activeTab === 'transactions' && (
            <>
              <DateRangeFilter from={dateFrom} to={dateTo} />
              <AddTransactionButton />
              <RecategorizeButton />
              <MoreActionsDropdown />
            </>
          )}
          <CashflowTabs activeTab={activeTab} />
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      {activeTab === 'planning' ? (
        <PlanningView
          plannedItems={plannedItems}
          pendingInvoices={pendingInvoices}
          suggestedRecurring={suggestedRecurring}
          currentBalance={currentBalance}
          transactionHistory={txHistory}
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-4">
            <CfKpi
              label="Saldo neto"
              value={formatCurrency(Math.abs(netBalance))}
              color={netBalance >= 0 ? '#34c759' : '#ff3b30'}
              prefix={netBalance >= 0 ? '+' : '−'}
              sub="Total ingresos − gastos del período"
            />
            <CfLoansKpi
              recibido={prestamosRecibido}
              devuelto={prestamosDevuelto}
              pendiente={prestamosPendiente}
            />
            <CfKpi
              label={`Ingresos ${now.toLocaleDateString('es-ES', { month: 'long' })}`}
              value={formatCurrency(thisMonthIncome)}
              color="#0071e3"
              sub={`Ingresos ${now.toLocaleDateString('es-ES', { month: 'long' })} (sin traspasos)`}
            />
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2">
              <IncomeExpenseChart transactions={transactions} />
            </div>
            <ExpenseCategoryDonut transactions={transactions} />
          </div>

          {/* Charts row 2 */}
          <BalanceTrendChart transactions={transactions} />

          {/* Transactions table */}
          <TransactionsTable transactions={transactions} />
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CfLoansKpi({
  recibido,
  devuelto,
  pendiente,
}: {
  recibido: number
  devuelto: number
  pendiente: number
}) {
  // Positive pendiente = outstanding debt (we owe money) → orange/red
  // Zero or negative = fully repaid → green
  const pendienteColor = pendiente > 0 ? '#ff9f0a' : '#34c759'

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3 leading-tight">
        Total préstamos
      </p>
      <p className="text-2xl font-bold tracking-tight leading-none" style={{ color: pendienteColor }}>
        {formatCurrency(pendiente)}
      </p>
      <p className="text-[10px] text-zinc-400 mt-1.5 leading-tight mb-4">Pendiente de devolver</p>
      <div className="flex items-center gap-4 pt-3 border-t border-zinc-50">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">Recibido</p>
          <p className="text-xs font-semibold font-mono text-emerald-600">+{formatCurrency(recibido)}</p>
        </div>
        <div className="w-px h-7 bg-zinc-100" />
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">Devuelto</p>
          <p className="text-xs font-semibold font-mono text-red-500">−{formatCurrency(devuelto)}</p>
        </div>
      </div>
    </div>
  )
}

function CfKpi({
  label,
  value,
  color = '#18181b',
  prefix,
  sub,
}: {
  label: string
  value: string
  color?: string
  prefix?: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3 leading-tight">
        {label}
      </p>
      <p className="text-2xl font-bold tracking-tight leading-none" style={{ color }}>
        {prefix && <span className="mr-0.5">{prefix}</span>}
        {value}
      </p>
      {sub && <p className="text-[10px] text-zinc-400 mt-2 leading-tight">{sub}</p>}
    </div>
  )
}
