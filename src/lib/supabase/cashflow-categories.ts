// =========================================
// CRUD — cashflow_categories
// server-only
// =========================================

import { getSupabaseClient } from './client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseClient() as any }

export interface CashflowCategoryRow {
  id: string
  name: string
  color: string | null
  created_at: string
}

export interface CategoryWithCount {
  id: string | null   // null = exists only in transactions, not yet seeded
  name: string
  color: string | null
  txCount: number
}

/** All categories from cashflow_categories joined with transaction counts. */
export async function listCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const [catRes, txRes] = await Promise.all([
    db().from('cashflow_categories').select('id, name, color').order('name'),
    db()
      .from('cashflow_transactions')
      .select('category')
      .neq('category', null),
  ])

  if (catRes.error) throw new Error(`listCategories: ${catRes.error.message}`)
  if (txRes.error) throw new Error(`listTxCategories: ${txRes.error.message}`)

  // Count transactions per category
  const countMap = new Map<string, number>()
  for (const row of (txRes.data ?? [])) {
    countMap.set(row.category, (countMap.get(row.category) ?? 0) + 1)
  }

  // Build result from DB rows
  const cats: CategoryWithCount[] = (catRes.data ?? []).map((c: CashflowCategoryRow) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    txCount: countMap.get(c.name) ?? 0,
  }))

  // Add categories that exist in transactions but not in the table yet
  const knownNames = new Set(cats.map((c) => c.name))
  for (const [name, count] of countMap) {
    if (!knownNames.has(name)) {
      cats.push({ id: null, name, color: null, txCount: count })
    }
  }

  return cats.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function createCategory(name: string, color?: string): Promise<CashflowCategoryRow> {
  const { data, error } = await db()
    .from('cashflow_categories')
    .insert({ name: name.trim(), color: color ?? null })
    .select()
    .single()
  if (error) throw new Error(`createCategory: ${error.message}`)
  return data as CashflowCategoryRow
}

export async function renameCategory(id: string, oldName: string, newName: string): Promise<void> {
  const trimmed = newName.trim()
  if (!trimmed || trimmed === oldName) return
  const db_ = getSupabaseClient() as any  // eslint-disable-line @typescript-eslint/no-explicit-any

  // 1 — rename in categories table (if it has an id)
  if (id) {
    const { error } = await db_.from('cashflow_categories').update({ name: trimmed }).eq('id', id)
    if (error) throw new Error(`renameCategory: ${error.message}`)
  }

  // 2 — bulk-update all transactions that used the old name
  const { error: txErr } = await db_.from('cashflow_transactions')
    .update({ category: trimmed })
    .eq('category', oldName)
  if (txErr) throw new Error(`renameCategory tx update: ${txErr.message}`)
}

export async function deleteCategory(id: string | null, name: string, reassignTo?: string): Promise<void> {
  const db_ = getSupabaseClient() as any  // eslint-disable-line @typescript-eslint/no-explicit-any

  // 1 — reassign transactions if requested
  if (reassignTo) {
    const { error } = await db_.from('cashflow_transactions')
      .update({ category: reassignTo })
      .eq('category', name)
    if (error) throw new Error(`deleteCategory reassign: ${error.message}`)
  }

  // 2 — delete the category row (only if it has an id)
  if (id) {
    const { error } = await db_.from('cashflow_categories').delete().eq('id', id)
    if (error) throw new Error(`deleteCategory delete: ${error.message}`)
  }
}
