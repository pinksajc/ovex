// =========================================
// CASHFLOW LOANS — balance computation
// Shared between the dashboard and the PDF report.
// =========================================

import type { CashflowLoan, CashflowTransaction, LoanDirection } from '@/types'

export interface LoanSummary {
  loan: CashflowLoan
  /** Money moved in the loan's disbursement direction (principal put out). */
  desembolsado: number
  /** Money moved in the opposite direction (paid back). */
  pagado: number
  /**
   * Outstanding in the loan's natural direction:
   *   'lent'     → what the counterparty still owes us
   *   'borrowed' → what we still owe the counterparty
   * Can go negative if repayments exceed the disbursed principal.
   */
  pendiente: number
  transactions: CashflowTransaction[]
}

/**
 * For a 'lent' loan: disbursement = money OUT (amount < 0), repayment = money IN.
 * For a 'borrowed' loan: disbursement = money IN (amount > 0), repayment = money OUT.
 */
function summarize(
  loan: CashflowLoan,
  txs: CashflowTransaction[],
): LoanSummary {
  let inflow = 0   // amount > 0
  let outflow = 0  // |amount < 0|
  for (const t of txs) {
    if (t.amount > 0) inflow += t.amount
    else              outflow += Math.abs(t.amount)
  }
  const lent = loan.direction === 'lent'
  const desembolsado = lent ? outflow : inflow
  const pagado       = lent ? inflow  : outflow
  return { loan, desembolsado, pagado, pendiente: desembolsado - pagado, transactions: txs }
}

/** Builds one summary per loan, using the transactions linked via loanId. */
export function buildLoanSummaries(
  loans: CashflowLoan[],
  transactions: CashflowTransaction[],
): LoanSummary[] {
  const byLoan = new Map<string, CashflowTransaction[]>()
  for (const t of transactions) {
    if (!t.loanId) continue
    const arr = byLoan.get(t.loanId) ?? []
    arr.push(t)
    byLoan.set(t.loanId, arr)
  }
  return loans.map((loan) =>
    summarize(loan, (byLoan.get(loan.id) ?? []).sort((a, b) => a.date.localeCompare(b.date))),
  )
}

export const LOAN_DIRECTION_LABELS: Record<LoanDirection, string> = {
  lent:     'Les prestamos',
  borrowed: 'Nos prestaron',
}

/** Label for the outstanding balance, given direction + sign of pendiente. */
export function outstandingLabel(direction: LoanDirection, pendiente: number): string {
  if (pendiente === 0) return 'Saldado'
  if (direction === 'lent')  return pendiente > 0 ? 'Nos deben'   : 'Pagado de más'
  /* borrowed */             return pendiente > 0 ? 'Les debemos' : 'Pagado de más'
}
