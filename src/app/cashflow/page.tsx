import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getCashflowTransactions, backfillManualBalances } from '@/lib/supabase/cashflow'
import { getCashflowPlanned } from '@/lib/supabase/cashflow-planned'
import { getInvoices } from '@/lib/supabase/invoices'
import { formatCurrency } from '@/lib/format'
import { UploadZone } from '@/components/cashflow/upload-zone'
import { RecategorizeButton } from '@/components/cashflow/recategorize-button'
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
  const currentBalance = allTransactions.find((t) => t.balance != null)?.balance ?? 0

  // ── Transactions tab: date filtering + KPIs ───────────────────────────────────
  const defaultFrom = `${now.getFullYear()}-01-01`
  const defaultTo   = now.toISOString().split('T')[0]
  const dateFrom    = fromParam ?? defaultFrom
  const dateTo      = toParam   ?? defaultTo

  const transactions = allTransactions.filter((t) => t.date >= dateFrom && t.date <= dateTo)

  const operational  = transactions.filter((t) => t.category !== 'Traspaso interno')
  const totalIncome  = operational.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpense = operational.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const netBalance   = totalIncome - totalExpense

  const prestamosNet = transactions
    .filter((t) => t.category === 'Préstamos')
    .reduce((s, t) => s + t.amount, 0)

  const thisMonthKey    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthIncome = transactions
    .filter((t) => t.date.startsWith(thisMonthKey) && t.amount > 0 && t.category !== 'Traspaso interno')
    .reduce((s, t) => s + t.amount, 0)

  return (
    <div className="min-h-full bg-base p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Flujo de Caja</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">
            {allTransactions.length} transacciones · datos de Revolut
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          {activeTab === 'transactions' && (
            <>
              <DateRangeFilter from={dateFrom} to={dateTo} />
              <AddTransactionButton />
              <RecategorizeButton />
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
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-4">
            <CfKpi
              label="Saldo neto"
              value={formatCurrency(Math.abs(netBalance))}
              success={netBalance >= 0}
              danger={netBalance < 0}
              prefix={netBalance >= 0 ? '+' : '−'}
              sub="Total ingresos − gastos del período"
            />
            <CfKpi
              label="Total préstamos"
              value={formatCurrency(Math.abs(prestamosNet))}
              warning={prestamosNet >= 0}
              danger={prestamosNet < 0}
              prefix={prestamosNet >= 0 ? '+' : '−'}
              sub="Préstamos netos del período"
            />
            <CfKpi
              label={`Ingresos ${now.toLocaleDateString('es-ES', { month: 'long' })}`}
              value={formatCurrency(thisMonthIncome)}
              accent
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

          {/* Upload zone */}
          <UploadZone />

          {/* Transactions table */}
          <TransactionsTable transactions={transactions} />
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CfKpi({
  label,
  value,
  prefix,
  sub,
  accent,
  success,
  warning,
  danger,
}: {
  label: string
  value: string
  prefix?: string
  sub?: string
  accent?: boolean
  success?: boolean
  warning?: boolean
  danger?: boolean
}) {
  const valueColor = accent ? '#A9A2F2' : success ? '#4ADE80' : warning ? '#FBBF24' : danger ? '#F87171' : '#EDEDEF'
  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-5">
      <p className="text-[12px] font-medium uppercase tracking-widest text-text-tertiary mb-3 leading-tight">
        {label}
      </p>
      <p className="text-[28px] font-semibold font-mono tracking-tight leading-none" style={{ color: valueColor }}>
        {prefix && <span className="mr-0.5">{prefix}</span>}
        {value}
      </p>
      {sub && <p className="text-[11px] text-text-tertiary mt-2 leading-tight">{sub}</p>}
    </div>
  )
}
