// =========================================
// CASHFLOW LOANS — Supabase CRUD
// server-only
// =========================================

import { getSupabaseClient } from './client'
import type { CashflowLoan, InsertCashflowLoan, LoanDirection } from '@/types'

interface LoanRow {
  id: string
  name: string
  counterparty: string
  direction: string
  notes: string | null
  created_at: string
}

function loansTable(db: ReturnType<typeof getSupabaseClient>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as unknown as { from(t: string): any }).from('cashflow_loans')
}
function txTable(db: ReturnType<typeof getSupabaseClient>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as unknown as { from(t: string): any }).from('cashflow_transactions')
}

function rowToLoan(row: LoanRow): CashflowLoan {
  return {
    id: row.id,
    name: row.name,
    counterparty: row.counterparty,
    direction: (row.direction === 'borrowed' ? 'borrowed' : 'lent') as LoanDirection,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export async function getCashflowLoans(): Promise<CashflowLoan[]> {
  const db = getSupabaseClient()
  const { data, error } = await loansTable(db)
    .select('id, name, counterparty, direction, notes, created_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getCashflowLoans: ${error.message}`)
  return (data as LoanRow[]).map(rowToLoan)
}

// ── Writes ─────────────────────────────────────────────────────────────────────

export async function createCashflowLoan(input: InsertCashflowLoan): Promise<CashflowLoan> {
  const db = getSupabaseClient()
  const { data, error } = await loansTable(db)
    .insert({
      name: input.name,
      counterparty: input.counterparty,
      direction: input.direction,
      notes: input.notes ?? null,
    })
    .select('id, name, counterparty, direction, notes, created_at')
    .single()

  if (error) throw new Error(`createCashflowLoan: ${error.message}`)
  return rowToLoan(data as LoanRow)
}

export async function updateCashflowLoan(
  id: string,
  input: Partial<InsertCashflowLoan>,
): Promise<void> {
  const db = getSupabaseClient()
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined)         patch.name = input.name
  if (input.counterparty !== undefined) patch.counterparty = input.counterparty
  if (input.direction !== undefined)    patch.direction = input.direction
  if (input.notes !== undefined)        patch.notes = input.notes
  const { error } = await loansTable(db).update(patch).eq('id', id)
  if (error) throw new Error(`updateCashflowLoan: ${error.message}`)
}

export async function deleteCashflowLoan(id: string): Promise<void> {
  const db = getSupabaseClient()
  // loan_id on transactions is ON DELETE SET NULL, so movements are simply unlinked.
  const { error } = await loansTable(db).delete().eq('id', id)
  if (error) throw new Error(`deleteCashflowLoan: ${error.message}`)
}

/** Assigns (or clears, when loanId is null) a transaction's loan link. */
export async function setTransactionLoan(txId: string, loanId: string | null): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await txTable(db).update({ loan_id: loanId }).eq('id', txId)
  if (error) throw new Error(`setTransactionLoan: ${error.message}`)
}
