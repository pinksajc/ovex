import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getCashflowTransactions, backfillManualBalances } from '@/lib/supabase/cashflow'
import { getCashflowPresupuesto } from '@/lib/supabase/cashflow-presupuesto'
import { formatCurrency } from '@/lib/format'
import { buildCounterpartyMap } from '@/lib/cashflow-counterparty'
import { OPERATIONAL_EXCLUDED, NET_BALANCE_EXCLUDED } from '@/lib/cashflow-categories'
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
  const presupuestos = activeTab === 'planning' ? await getCashflowPresupuesto() : []
  const currentBalance = allTransactions.find((t) => t.balance != null)?.balance ?? 0

  // ── Transactions tab: date filtering + KPIs ───────────────────────────────────
  // Default range = full span of available data (allTransactions sorted desc)
  const defaultTo   = allTransactions.length > 0
    ? allTransactions[0].date
    : now.toISOString().split('T')[0]
  const defaultFrom = allTransactions.length > 0
    ? allTransactions[allTransactions.length - 1].date
    : `${now.getFullYear()}-01-01`
  const dateFrom    = fromParam ?? defaultFrom
  const dateTo      = toParam   ?? defaultTo

  const transactions = allTransactions.filter((t) => t.date >= dateFrom && t.date <= dateTo)

  // ── Operational P&L (excludes Traspaso interno + all Préstamos variants) ─────
  // OPERATIONAL_EXCLUDED = { Traspaso interno, Préstamos recibidos, Devolución de préstamos, Préstamos }
  const operational  = transactions.filter((t) => !OPERATIONAL_EXCLUDED.has(t.category))
  const totalIncome  = operational.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpense = operational.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  // ── Saldo neto = SUM(amount) of all transactions except Traspaso interno ──────
  // Includes loan movements because they genuinely affect the bank balance.
  const netBalance = transactions
    .filter((t) => !NET_BALANCE_EXCLUDED.has(t.category))
    .reduce((s, t) => s + t.amount, 0)

  // ── Debug logs ────────────────────────────────────────────────────────────────
  console.log('[cashflow] KPI audit:', {
    dateFrom, dateTo,
    totalTransactions: transactions.length,
    operationalCount: operational.length,
    excludedCount: transactions.length - operational.length,
    totalIncome: Math.round(totalIncome),
    totalExpense: Math.round(totalExpense),
    netBalance: Math.round(netBalance),
    excludedCats: Array.from(OPERATIONAL_EXCLUDED),
  })
  // Expense breakdown by category (mirrors what the donut will show)
  const expenseCatBreakdown: Record<string, number> = {}
  for (const t of operational.filter((t) => t.amount < 0)) {
    expenseCatBreakdown[t.category] = (expenseCatBreakdown[t.category] ?? 0) + Math.abs(t.amount)
  }
  console.log('[cashflow] expense breakdown (operational, amount<0):', expenseCatBreakdown)
  // Categories that ARE excluded — verify Préstamos is out
  const excludedByCategory: Record<string, number> = {}
  for (const t of transactions.filter((t) => OPERATIONAL_EXCLUDED.has(t.category))) {
    excludedByCategory[t.category] = (excludedByCategory[t.category] ?? 0) + t.amount
  }
  console.log('[cashflow] excluded-category totals:', excludedByCategory)

  // ── Smashburger Préstamos debug ───────────────────────────────────────────────
  const smashTxs = transactions.filter(
    (t) => t.category === 'Devolución de préstamos' && t.description.toLowerCase().includes('smashburger'),
  )
  const smashTotal = smashTxs.reduce((s, t) => s + t.amount, 0)
  console.log('[cashflow] Smashburger "Devolución de préstamos" transactions:', {
    count: smashTxs.length,
    total: Math.round(smashTotal),
    rows: smashTxs.map((t) => ({ date: t.date, description: t.description, amount: t.amount })),
  })

  // ── Préstamos KPI ─────────────────────────────────────────────────────────────
  const prestamosRecibido  = transactions.filter((t) => t.category === 'Préstamos recibidos' && t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const prestamosDevuelto  = transactions.filter((t) => t.category === 'Devolución de préstamos'     && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const prestamosPendiente = prestamosRecibido - prestamosDevuelto
  console.log('[cashflow] préstamos KPI:', { prestamosRecibido: Math.round(prestamosRecibido), prestamosDevuelto: Math.round(prestamosDevuelto), prestamosPendiente: Math.round(prestamosPendiente) })

  // Counterparty breakdown (uses allTransactions so it's always complete, not date-filtered)
  const loanCounterparties = buildCounterpartyMap(allTransactions)

  const thisMonthKey    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  // Use allTransactions so the KPI is always the current month regardless of the selected date range
  const thisMonthIncome = allTransactions
    .filter((t) =>
      t.date.startsWith(thisMonthKey) &&
      t.amount > 0 &&
      !OPERATIONAL_EXCLUDED.has(t.category),
    )
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
              <MoreActionsDropdown dateFrom={dateFrom} dateTo={dateTo} />
            </>
          )}
          <CashflowTabs activeTab={activeTab} />
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      {activeTab === 'planning' ? (
        <PlanningView
          currentBalance={currentBalance}
          presupuestos={presupuestos}
          allTransactions={allTransactions}
        />
      ) : (
        <>
          {/* KPI strip — 4-col: Saldo neto | Préstamos (span-2) | Ingresos mes */}
          <div className="grid grid-cols-4 gap-4">
            <CfKpi
              label="Saldo neto"
              value={formatCurrency(Math.abs(netBalance))}
              color={netBalance >= 0 ? '#34c759' : '#ff3b30'}
              prefix={netBalance >= 0 ? '+' : '−'}
              sub="Total ingresos − gastos del período"
            />
            <CfLoansTableKpi
              counterparties={loanCounterparties}
              totalRecibido={prestamosRecibido}
              totalDado={prestamosDevuelto}
              totalNeto={prestamosPendiente}
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
              <IncomeExpenseChart transactions={transactions} dateFrom={dateFrom} dateTo={dateTo} />
            </div>
            <ExpenseCategoryDonut transactions={transactions} />
          </div>

          {/* Charts row 2 */}
          <BalanceTrendChart transactions={transactions} dateFrom={dateFrom} dateTo={dateTo} />

          {/* Transactions table */}
          <TransactionsTable transactions={transactions} />
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CfLoansTableKpi({
  counterparties,
  totalRecibido,
  totalDado,
  totalNeto,
}: {
  counterparties: { name: string; recibido: number; dado: number; neto: number }[]
  totalRecibido: number
  totalDado: number
  totalNeto: number
}) {
  return (
    <div className="col-span-2 bg-white rounded-2xl shadow-sm p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3 leading-tight">
        Préstamos
      </p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-100">
            <th className="text-left pb-1.5 text-[10px] font-semibold text-zinc-400 pr-3">Contraparte</th>
            <th className="text-right pb-1.5 text-[10px] font-semibold text-emerald-600 pr-2">Recibido</th>
            <th className="text-right pb-1.5 text-[10px] font-semibold text-red-500 pr-2">Pagado de vuelta</th>
            <th className="text-right pb-1.5 text-[10px] font-semibold text-zinc-500">Deuda neta</th>
          </tr>
        </thead>
        <tbody>
          {counterparties.map((cp) => (
            <tr key={cp.name} className="border-b border-zinc-50">
              <td className="py-1 pr-3 text-zinc-700 font-medium whitespace-nowrap">{cp.name}</td>
              <td className="py-1 pr-2 text-right font-mono text-emerald-600 whitespace-nowrap">
                {cp.recibido > 0 ? `+${formatCurrency(cp.recibido)}` : '—'}
              </td>
              <td className="py-1 pr-2 text-right font-mono text-red-500 whitespace-nowrap">
                {cp.dado > 0 ? `−${formatCurrency(cp.dado)}` : '—'}
              </td>
              <td className="py-1 text-right whitespace-nowrap">
                {cp.neto <= 0 ? (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                    Saldado
                  </span>
                ) : (
                  <span className="font-mono font-bold" style={{ color: '#ff9f0a' }}>
                    {formatCurrency(cp.neto)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-zinc-50 rounded">
            <td className="pt-2 pr-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Total</td>
            <td className="pt-2 pr-2 text-right font-mono font-bold text-emerald-600 whitespace-nowrap text-[11px]">
              +{formatCurrency(totalRecibido)}
            </td>
            <td className="pt-2 pr-2 text-right font-mono font-bold text-red-500 whitespace-nowrap text-[11px]">
              −{formatCurrency(totalDado)}
            </td>
            <td
              className="pt-2 text-right font-mono font-bold whitespace-nowrap text-[11px]"
              style={{ color: totalNeto > 0 ? '#ff9f0a' : totalNeto < 0 ? '#34c759' : '#71717a' }}
            >
              {formatCurrency(Math.abs(totalNeto))}
            </td>
          </tr>
        </tfoot>
      </table>
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
