'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import {
  insertCashflowTransactions,
  getExistingDedupeKeys,
  updateCashflowCategory,
  updateCashflowCategoryByDescription,
  getCategoryRulesMap,
  upsertCategoryRule,
  recategorizeAllTransactions,
  getLatestBalance,
  backfillManualBalances,
  updateManualTransaction,
  deleteManualTransaction,
  resetAndBackfillManualBalances,
  deleteTransaction,
  deleteTransactions,
} from '@/lib/supabase/cashflow'
import { CATEGORIZABLE } from '@/lib/cashflow-categories'
import type { InsertCashflowTransaction } from '@/types'

function assertOwner(role: string) {
  if (role !== 'owner' && role !== 'admin') throw new Error('No autorizado')
}

// ── Claude auto-categorisation ────────────────────────────────────────────────
// Batches unique unmatched descriptions into a single API call.
// Falls back silently to 'Sin categoría' if the API key is absent or the call fails.

async function autoCategorize(
  descriptions: string[],
): Promise<Map<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || descriptions.length === 0) return new Map()

  const categoriesStr = CATEGORIZABLE.join(', ')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Eres un asistente de contabilidad para una empresa española. Clasifica cada descripción de movimiento bancario en exactamente una de estas categorías: ${categoriesStr}.

Devuelve ÚNICAMENTE un objeto JSON válido donde las claves son exactamente las descripciones dadas y los valores son las categorías. Sin explicaciones, sin markdown, sin texto adicional.

Descripciones a clasificar:
${JSON.stringify(descriptions)}`,
          },
        ],
      }),
    })

    if (!res.ok) {
      console.warn('[cashflow] autoCategorize API error:', res.status)
      return new Map()
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text: string }>
    }
    const text = data.content?.find((c) => c.type === 'text')?.text ?? ''

    // Extract first JSON object from the response text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return new Map()

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>
    const valid = new Set(CATEGORIZABLE)

    const result = new Map<string, string>()
    for (const [desc, cat] of Object.entries(parsed)) {
      if (typeof cat === 'string' && valid.has(cat)) {
        result.set(desc, cat)
      }
    }
    return result
  } catch (err) {
    console.warn('[cashflow] autoCategorize threw:', err)
    return new Map()
  }
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

    // ── 1. Deduplicate — key is date|amount (description excluded so minor
    //    wording changes in Revolut exports don't cause double-imports) ─────────
    const incomingKeys = rows.map((r) => `${r.date}|${r.amount}`)
    const existingKeys = await getExistingDedupeKeys(incomingKeys)

    const newRows = rows.filter(
      (r) => !existingKeys.has(`${r.date}|${r.amount}`),
    )
    const skippedCount = rows.length - newRows.length

    if (newRows.length === 0) return { ok: true, inserted: 0, skipped: skippedCount }

    // ── 2. Apply saved category rules ─────────────────────────────────────────
    const rulesMap = await getCategoryRulesMap()

    const needsAI: string[] = []
    const uniqueUnmatched = new Set<string>()

    for (const r of newRows) {
      if (!rulesMap.has(r.description)) uniqueUnmatched.add(r.description)
    }

    if (uniqueUnmatched.size > 0) needsAI.push(...uniqueUnmatched)

    // ── 3. Auto-categorise via Claude (only unmatched) ─────────────────────────
    const aiMap = await autoCategorize(needsAI)

    // ── 4. Build insert payload ───────────────────────────────────────────────
    const toInsert: InsertCashflowTransaction[] = newRows.map((r) => ({
      date: r.date,
      description: r.description,
      amount: r.amount,
      type: r.amount >= 0 ? 'income' : 'expense',
      category: rulesMap.get(r.description) ?? aiMap.get(r.description) ?? 'Sin categoría',
      currency: r.currency || 'EUR',
      state: r.state,
      balance: r.balance,
      sourceFile,
    }))

    await insertCashflowTransactions(toInsert)
    revalidatePath('/cashflow')

    return { ok: true, inserted: toInsert.length, skipped: skippedCount }
  } catch (err) {
    return {
      ok: false,
      inserted: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}

// ── Recategorize all transactions from saved rules ────────────────────────────

export interface RecategorizeResult {
  ok: boolean
  updated: number
  error?: string
}

export async function recategorizeAllAction(): Promise<RecategorizeResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    const updated = await recategorizeAllTransactions()
    // Also repair any manual transactions that are missing their running balance
    await backfillManualBalances()
    revalidatePath('/cashflow')
    return { ok: true, updated }
  } catch (err) {
    return { ok: false, updated: 0, error: err instanceof Error ? err.message : 'Error' }
  }
}

// ── Update category (with rule save + bulk back-fill) ─────────────────────────

export interface UpdateCategoryResult {
  ok: boolean
  ruleCreated?: boolean
  error?: string
}

export async function updateCashflowCategoryAction(
  id: string,
  description: string,
  category: string,
): Promise<UpdateCategoryResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)

    await Promise.all([
      // Update the specific transaction
      updateCashflowCategory(id, category),
      // Bulk-update every transaction with the same description
      updateCashflowCategoryByDescription(description, category),
      // Persist the rule for future imports
      upsertCategoryRule(description, category),
    ])

    revalidatePath('/cashflow')
    return { ok: true, ruleCreated: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

// ── Manual transaction entry ───────────────────────────────────────────────────

export interface AddManualTransactionPayload {
  date: string        // "YYYY-MM-DD"
  description: string
  amount: number      // always positive; sign derived from type
  type: 'income' | 'expense'
  category: string
  notes?: string      // appended to description if present
}

export interface AddManualTransactionResult {
  ok: boolean
  error?: string
}

export async function addManualTransactionAction(
  payload: AddManualTransactionPayload,
): Promise<AddManualTransactionResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)

    const signed  = payload.type === 'expense'
      ? -Math.abs(payload.amount)
      :  Math.abs(payload.amount)

    const description = payload.notes?.trim()
      ? `${payload.description} — ${payload.notes.trim()}`
      : payload.description

    const latestBalance = await getLatestBalance()
    const runningBalance = latestBalance + signed
    console.log('[cashflow/addManual] latestBalance:', latestBalance, 'signed:', signed, 'runningBalance:', runningBalance)

    await insertCashflowTransactions([{
      date: payload.date,
      description,
      amount: signed,
      type: payload.type,
      category: payload.category,
      currency: 'EUR',
      state: 'COMPLETED',
      balance: runningBalance,
      sourceFile: 'manual',
    }])

    // Backfill any previously-inserted manual transactions that still have
    // a null balance (e.g. inserted before this fix was deployed).
    await backfillManualBalances()

    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

// ── Update manual transaction ──────────────────────────────────────────────────

export interface UpdateManualTransactionPayload {
  date: string
  description: string
  amount: number   // always positive; sign derived from type
  type: 'income' | 'expense'
  category: string
  notes?: string
}

export interface UpdateManualTransactionResult {
  ok: boolean
  error?: string
}

export async function updateManualTransactionAction(
  id: string,
  payload: UpdateManualTransactionPayload,
): Promise<UpdateManualTransactionResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)

    const signed = payload.type === 'expense'
      ? -Math.abs(payload.amount)
      :  Math.abs(payload.amount)

    const description = payload.notes?.trim()
      ? `${payload.description.trim()} — ${payload.notes.trim()}`
      : payload.description.trim()

    await updateManualTransaction(id, {
      date: payload.date,
      description,
      amount: signed,
      type: payload.type,
      category: payload.category,
    })

    await resetAndBackfillManualBalances()
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

// ── Delete manual transaction ──────────────────────────────────────────────────

export interface DeleteManualTransactionResult {
  ok: boolean
  error?: string
}

export async function deleteManualTransactionAction(
  id: string,
): Promise<DeleteManualTransactionResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await deleteManualTransaction(id)
    await resetAndBackfillManualBalances()
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

// ── Delete any transaction (panel delete button) ───────────────────────────────

export interface DeleteTransactionResult {
  ok: boolean
  error?: string
}

export async function deleteTransactionAction(
  id: string,
): Promise<DeleteTransactionResult> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await deleteTransaction(id)
    await resetAndBackfillManualBalances()
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

// ── Bulk delete ────────────────────────────────────────────────────────────────

export interface BulkDeleteResult {
  ok: boolean
  deleted?: number
  error?: string
}

export async function bulkDeleteTransactionsAction(
  ids: string[],
): Promise<BulkDeleteResult> {
  if (ids.length === 0) return { ok: true, deleted: 0 }
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await deleteTransactions(ids)
    await resetAndBackfillManualBalances()
    revalidatePath('/cashflow')
    return { ok: true, deleted: ids.length }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
