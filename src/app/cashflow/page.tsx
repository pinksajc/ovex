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
  const now = new Date()

  // KPI 1: Saldo neto — excludes Traspaso interno
  const operational = transactions.filter((t) => t.category !== 'Traspaso interno')
  const totalIncome  = operational.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpense = operational.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const netBalance   = totalIncome - totalExpense

  // KPI 2: Préstamos netos
  const prestamosNet = transactions
    .filter((t) => t.category === 'Préstamos')
    .reduce((s, t) => s + t.amount, 0)

  // KPI 3: Ingreso mes actual — income only, excludes Traspaso interno
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthIncome = transactions
    .filter((t) => t.date.startsWith(thisMonthKey) && t.amount > 0 && t.category !== 'Traspaso interno')
    .reduce((s, t) => s + t.amount, 0)

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
      <div className="grid grid-cols-3 gap-4">
        <CfKpi
          label="Saldo neto"
          value={formatCurrency(Math.abs(netBalance))}
          color={netBalance >= 0 ? '#34c759' : '#ff3b30'}
          prefix={netBalance >= 0 ? '+' : '−'}
          sub="Total ingresos − gastos del período"
        />
        <CfKpi
          label="Total préstamos"
          value={formatCurrency(Math.abs(prestamosNet))}
          color={prestamosNet >= 0 ? '#34c759' : '#ff3b30'}
          prefix={prestamosNet >= 0 ? '+' : '−'}
          sub="Préstamos netos del período"
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
