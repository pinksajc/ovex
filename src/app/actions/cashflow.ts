'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import {
  insertCashflowTransactions,
  getExistingDedupeKeys,
  updateCashflowCategory,
} from '@/lib/supabase/cashflow'
import type { InsertCashflowTransaction } from '@/types'

function assertOwner(role: string) {
  if (role !== 'owner' && role !== 'admin') throw new Error('No autorizado')
}

// ── Import ─────────────────────────────────────────────────────────────────────

export interface ImportCashflowPayload {
  rows: Array<{
    date: string        // "YYYY-MM-DD"
    description: string
    amount: number      // positive = income, negative = expense
    currency: string
    state: string | null
    balance: number | null
  }>
  sourceFile: string
}

export interface ImportCashflowResult {
  ok: boolean
  inserted: number
  skipped: number
  error?: string
}

export async function importCashflowAction(
  payload: ImportCashflowPayload,
): Promise<ImportCashflowResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)

    const { rows, sourceFile } = payload
    if (rows.length === 0) return { ok: true, inserted: 0, skipped: 0 }

    // Build dedupe keys for incoming rows
    const incomingKeys = rows.map((r) => `${r.date}|${r.description}|${r.amount}`)
    const existingKeys = await getExistingDedupeKeys(incomingKeys)

    const newRows: InsertCashflowTransaction[] = []
    const skipped = new Set<number>()

    rows.forEach((r, i) => {
      const key = `${r.date}|${r.description}|${r.amount}`
      if (existingKeys.has(key)) {
        skipped.add(i)
        return
      }
      newRows.push({
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.amount >= 0 ? 'income' : 'expense',
        category: 'Sin categoría',
        currency: r.currency || 'EUR',
        state: r.state,
        balance: r.balance,
        sourceFile,
      })
    })

    await insertCashflowTransactions(newRows)
    revalidatePath('/cashflow')

    return { ok: true, inserted: newRows.length, skipped: skipped.size }
  } catch (err) {
    return {
      ok: false,
      inserted: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}

// ── Update category ────────────────────────────────────────────────────────────

export async function updateCashflowCategoryAction(
  id: string,
  category: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await updateCashflowCategory(id, category)
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}
