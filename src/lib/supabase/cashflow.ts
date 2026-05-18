// =========================================
// CASHFLOW — Supabase CRUD
// server-only
// =========================================

import { getSupabaseClient } from './client'
import type { CashflowTransaction, InsertCashflowTransaction } from '@/types'

interface CashflowRow {
  id: string
  date: string
  description: string
  amount: number | string
  type: string
  category: string
  currency: string
  state: string | null
  balance: number | string | null
  source_file: string | null
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('cashflow_transactions')
}

function rowToTx(row: CashflowRow): CashflowTransaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: Number(row.amount),
    type: row.type as CashflowTransaction['type'],
    category: row.category,
    currency: row.currency,
    state: row.state,
    balance: row.balance != null ? Number(row.balance) : null,
    sourceFile: row.source_file,
    createdAt: row.created_at,
  }
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export async function getCashflowTransactions(): Promise<CashflowTransaction[]> {
  const db = getSupabaseClient()
  const { data, error } = await table(db)
    .select('id, date, description, amount, type, category, currency, state, balance, source_file, created_at')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getCashflowTransactions: ${error.message}`)

  // Debug: log raw DB row for first manual transaction to verify balance field
  const rows = data as CashflowRow[]
  const firstManual = rows.find((r) => r.source_file === 'manual')
  if (firstManual) {
    console.log('[cashflow] raw manual row from DB:', JSON.stringify({
      id: firstManual.id,
      balance: firstManual.balance,
      balance_type: typeof firstManual.balance,
      state: firstManual.state,
    }))
  }

  return rows.map(rowToTx)
}

/** Returns the most recent non-null balance from the table, or 0 if none. */
export async function getLatestBalance(): Promise<number> {
  const db = getSupabaseClient()
  const { data, error } = await table(db)
    .select('balance')
    .not('balance', 'is', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('[cashflow] getLatestBalance error:', error.message)
    return 0
  }
  const rows = data as { balance: number | string | null }[]
  return rows.length > 0 && rows[0].balance != null ? Number(rows[0].balance) : 0
}

/**
 * Walk all transactions in chronological order (date ASC, created_at ASC).
 * For every manual transaction (source_file = 'manual') that has a null balance,
 * compute its balance as: lastKnownBalance + amount, where lastKnownBalance is
 * the most recent non-null balance seen so far.  Runs a single SELECT then one
 * UPDATE per null-balance manual row found.  Returns number of rows updated.
 */
export async function backfillManualBalances(): Promise<number> {
  const db = getSupabaseClient()

  const { data, error } = await table(db)
    .select('id, date, amount, balance, source_file, created_at')
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(`backfillManualBalances: ${error.message}`)

  type BalRow = {
    id: string
    date: string
    amount: number | string
    balance: number | string | null
    source_file: string | null
    created_at: string
  }

  const rows = data as BalRow[]
  let lastKnownBalance = 0
  const updates: { id: string; balance: number }[] = []

  for (const row of rows) {
    if (row.balance != null) {
      // Non-null balance row — use it as the running anchor
      lastKnownBalance = Number(row.balance)
    } else if (row.source_file === 'manual') {
      // Manual tx without a balance — compute and queue
      const computed = lastKnownBalance + Number(row.amount)
      updates.push({ id: row.id, balance: computed })
      lastKnownBalance = computed   // advance anchor for subsequent manual txs
    }
    // Non-manual rows with null balance are skipped (shouldn't normally exist)
  }

  let updated = 0
  for (const { id, balance } of updates) {
    const { error: upErr } = await table(db).update({ balance }).eq('id', id)
    if (upErr) {
      console.warn(`[backfillManualBalances] update error for id=${id}:`, upErr.message)
    } else {
      updated++
    }
  }

  return updated
}

// ── Duplicate detection ─────────────────────────────────────────────────────────
// Returns the subset of hashes ("date|amount") that already exist in DB.
// Using only date + amount (not description) prevents re-importing the same
// transaction when Revolut slightly changes its description text.

export async function getExistingDedupeKeys(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set()
  const db = getSupabaseClient()

  const { data, error } = await table(db)
    .select('date,amount')

  if (error) throw new Error(`getExistingDedupeKeys: ${error.message}`)
  const existing = new Set<string>(
    (data as { date: string; amount: number | string }[]).map(
      (r) => `${r.date}|${Number(r.amount)}`,
    ),
  )
  return existing
}

// ── Writes ─────────────────────────────────────────────────────────────────────

export async function insertCashflowTransactions(
  rows: InsertCashflowTransaction[],
): Promise<void> {
  if (rows.length === 0) return
  const db = getSupabaseClient()
  const { error } = await table(db).insert(
    rows.map((r) => ({
      date: r.date,
      description: r.description,
      amount: r.amount,
      type: r.type,
      category: r.category,
      currency: r.currency,
      state: r.state,
      balance: r.balance,
      source_file: r.sourceFile,
    })),
  )
  if (error) throw new Error(`insertCashflowTransactions: ${error.message}`)
}

export async function updateManualTransaction(
  id: string,
  fields: {
    date: string
    description: string
    amount: number
    type: 'income' | 'expense'
    category: string
  },
): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await table(db)
    .update({
      date: fields.date,
      description: fields.description,
      amount: fields.amount,
      type: fields.type,
      category: fields.category,
      balance: null, // recomputed by resetAndBackfillManualBalances
    })
    .eq('id', id)
  if (error) throw new Error(`updateManualTransaction: ${error.message}`)
}

export async function deleteManualTransaction(id: string): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await table(db).delete().eq('id', id)
  if (error) throw new Error(`deleteManualTransaction: ${error.message}`)
}

/** Delete any transaction by id (not restricted to manual). */
export async function deleteTransaction(id: string): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await table(db).delete().eq('id', id)
  if (error) throw new Error(`deleteTransaction: ${error.message}`)
}

/** Bulk-delete a set of transactions by id. */
export async function deleteTransactions(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = getSupabaseClient()
  const { error } = await table(db).delete().in('id', ids)
  if (error) throw new Error(`deleteTransactions: ${error.message}`)
}

/**
 * Reset every manual transaction's balance to null, then recompute all
 * manual balances in chronological order using non-manual rows as anchors.
 * Safe to call after any edit / delete of a manual row.
 */
export async function resetAndBackfillManualBalances(): Promise<number> {
  const db = getSupabaseClient()
  const { error: resetErr } = await table(db)
    .update({ balance: null })
    .eq('source_file', 'manual')
  if (resetErr) throw new Error(`resetAndBackfillManualBalances (reset): ${resetErr.message}`)
  return backfillManualBalances()
}

export async function updateCashflowCategory(id: string, category: string): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await table(db).update({ category }).eq('id', id)
  if (error) throw new Error(`updateCashflowCategory: ${error.message}`)
}

/** Bulk-update every transaction that shares the same description. */
export async function updateCashflowCategoryByDescription(
  description: string,
  category: string,
): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await table(db).update({ category }).eq('description', description)
  if (error) throw new Error(`updateCashflowCategoryByDescription: ${error.message}`)
}

// ── Category rules ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rulesTable(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('cashflow_category_rules')
}

/** Returns a Map<description_pattern, category> for all saved rules. */
export async function getCategoryRulesMap(): Promise<Map<string, string>> {
  const db = getSupabaseClient()
  const { data, error } = await rulesTable(db).select('description_pattern,category')
  if (error) {
    // Table may not exist yet — return empty map rather than crashing
    console.warn('[cashflow] getCategoryRulesMap error (table may not exist yet):', error.message)
    return new Map()
  }
  return new Map(
    (data as { description_pattern: string; category: string }[]).map(
      (r) => [r.description_pattern, r.category],
    ),
  )
}

/** Upsert a single rule — ON CONFLICT DO UPDATE. */
export async function upsertCategoryRule(
  descriptionPattern: string,
  category: string,
): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await rulesTable(db).upsert(
    { description_pattern: descriptionPattern, category },
    { onConflict: 'description_pattern' },
  )
  if (error) throw new Error(`upsertCategoryRule: ${error.message}`)
}

/**
 * Escape a string for use as a literal pattern in SQL LIKE / ILIKE.
 * Postgres ILIKE wildcards are % (any sequence) and _ (single char).
 * Backslash is the default escape character.
 */
function escapeLikePattern(s: string): string {
  return s
    .replace(/\\/g, '\\\\') // escape backslash first
    .replace(/%/g,  '\\%')  // literal percent
    .replace(/_/g,  '\\_')  // literal underscore (e.g. "Ups_es")
}

/**
 * Re-apply every saved rule to existing transactions using keyword-based
 * ILIKE matching (%pattern%), then call the Postgres function
 * apply_cashflow_wildcards() as a fallback for still-uncategorised rows.
 *
 * The SQL function must be created in Supabase first — see
 * sql/cashflow-wildcard-fn.sql.
 *
 * Returns total rows changed.
 */
export async function recategorizeAllTransactions(): Promise<number> {
  const db = getSupabaseClient()
  let totalUpdated = 0

  // ── 1. DB rules — keyword ILIKE ('%pattern%') ─────────────────────────────
  const rules = await getCategoryRulesMap()

  for (const [description, category] of rules) {
    const keyword = escapeLikePattern(description)
    const pattern = `%${keyword}%`
    const { data, error } = await table(db)
      .update({ category })
      .ilike('description', pattern)
      .neq('category', category)
      .select('id')
    if (error) {
      console.warn(`[recategorize] DB rule error for "${description}":`, error.message)
      continue
    }
    totalUpdated += (data as { id: string }[]).length
  }

  // ── 2. Wildcard fallback via Postgres RPC ─────────────────────────────────
  // apply_cashflow_wildcards() runs a series of UPDATE … WHERE category = 'Sin categoría'
  // statements with broad ILIKE patterns and returns the total rows updated.
  const rpcDb = db as unknown as {
    rpc(fn: string): Promise<{ data: number | null; error: { message: string } | null }>
  }
  const { data: rpcData, error: rpcError } = await rpcDb.rpc('apply_cashflow_wildcards')
  if (rpcError) {
    console.warn('[recategorize] apply_cashflow_wildcards rpc error:', rpcError.message)
  } else {
    totalUpdated += rpcData ?? 0
  }

  return totalUpdated
}
