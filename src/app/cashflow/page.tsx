import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getCashflowTransactions } from '@/lib/supabase/cashflow'
import { formatCurrency } from '@/lib/format'
import { UploadZone } from '@/components/cashflow/upload-zone'
import { RecategorizeButton } from '@/components/cashflow/recategorize-button'
import { TransactionsTable } from '@/components/cashflow/transactions-table'
import {
  IncomeExpenseChart,
  ExpenseCategoryDonut,
  BalanceTrendChart,
} from '@/components/cashflow/cashflow-charts'

export default async function CashflowPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'owner' && user.role !== 'admin') redirect('/dashboard')

  const transactions = await getCashflowTransactions()

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const income  = transactions.filter((t) => t.type === 'income')
  const expense = transactions.filter((t) => t.type === 'expense')

  const totalIncome  = income.reduce((s, t) => s + t.amount, 0)
  const totalExpense = expense.reduce((s, t) => s + Math.abs(t.amount), 0)
  const netBalance   = totalIncome - totalExpense

  // Last balance value (most recent transaction with a balance field)
  const lastBalance = transactions.find((t) => t.balance != null)?.balance ?? null

  const now = new Date()
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthTxs = transactions.filter((t) => t.date.startsWith(thisMonthKey))
  const thisMonthIncome  = thisMonthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const thisMonthExpense = thisMonthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div className="min-h-full bg-[#f5f5f7] p-8 space-y-5">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Flujo de Caja</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {transactions.length} transacciones · datos de Revolut
          </p>
        </div>
        <div className="pt-1">
          <RecategorizeButton />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-4">
        <CfKpi label="Total ingresos"    value={formatCurrency(totalIncome)}  color="#34c759" />
        <CfKpi label="Total gastos"      value={formatCurrency(totalExpense)} color="#ff3b30" />
        <CfKpi
          label="Saldo neto"
          value={formatCurrency(Math.abs(netBalance))}
          color={netBalance >= 0 ? '#0071e3' : '#ff3b30'}
          prefix={netBalance >= 0 ? '+' : '−'}
        />
        <CfKpi
          label="Saldo actual"
          value={lastBalance != null ? formatCurrency(Math.abs(lastBalance)) : '—'}
          color={lastBalance != null && lastBalance >= 0 ? '#34c759' : '#ff3b30'}
        />
        <CfKpi
          label={`Neto ${now.toLocaleDateString('es-ES', { month: 'long' })}`}
          value={formatCurrency(Math.abs(thisMonthIncome - thisMonthExpense))}
          color={(thisMonthIncome - thisMonthExpense) >= 0 ? '#34c759' : '#ff3b30'}
          sub={`+${formatCurrency(thisMonthIncome)} · −${formatCurrency(thisMonthExpense)}`}
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
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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
