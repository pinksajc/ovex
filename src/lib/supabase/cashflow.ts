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
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getCashflowTransactions: ${error.message}`)
  return (data as CashflowRow[]).map(rowToTx)
}

/** Returns the most recent balance value stored in the table, or 0 if none. */
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

// ── Duplicate detection ─────────────────────────────────────────────────────────
// Returns the subset of hashes ("date|description|amount") that already exist in DB.

export async function getExistingDedupeKeys(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set()
  const db = getSupabaseClient()

  // We build a OR filter: each key is "date|description|amount"
  // To avoid building a complex OR we fetch all transactions and check in JS
  // (acceptable for the typical import batch size of <5k rows).
  const { data, error } = await table(db)
    .select('date,description,amount')

  if (error) throw new Error(`getExistingDedupeKeys: ${error.message}`)
  const existing = new Set<string>(
    (data as { date: string; description: string; amount: number | string }[]).map(
      (r) => `${r.date}|${r.description}|${Number(r.amount)}`,
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
