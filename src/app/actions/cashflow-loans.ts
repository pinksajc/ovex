'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import {
  createCashflowLoan,
  updateCashflowLoan,
  deleteCashflowLoan,
  setTransactionLoan,
} from '@/lib/supabase/cashflow-loans'
import type { InsertCashflowLoan } from '@/types'

function assertOwner(role: string) {
  if (role !== 'owner' && role !== 'admin') throw new Error('No autorizado')
}

export interface LoanActionResult {
  ok: boolean
  id?: string
  error?: string
}

export async function createLoanAction(input: InsertCashflowLoan): Promise<LoanActionResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    if (!input.name?.trim()) return { ok: false, error: 'El nombre es obligatorio' }
    if (!input.counterparty?.trim()) return { ok: false, error: 'La contraparte es obligatoria' }
    const loan = await createCashflowLoan({
      name: input.name.trim(),
      counterparty: input.counterparty.trim(),
      direction: input.direction,
      notes: input.notes?.trim() || null,
    })
    revalidatePath('/cashflow')
    return { ok: true, id: loan.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function updateLoanAction(
  id: string,
  input: Partial<InsertCashflowLoan>,
): Promise<LoanActionResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await updateCashflowLoan(id, input)
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function deleteLoanAction(id: string): Promise<LoanActionResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await deleteCashflowLoan(id)
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

/** Assign a transaction to a loan, or clear it (loanId = null). */
export async function assignTransactionLoanAction(
  txId: string,
  loanId: string | null,
): Promise<LoanActionResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await setTransactionLoan(txId, loanId)
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
