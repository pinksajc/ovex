// =========================================
// CASHFLOW_PLANNED — Supabase CRUD
// server-only
// =========================================

import { getSupabaseClient } from './client'

export interface PlannedItem {
  id: string
  date: string           // "YYYY-MM-DD"
  description: string
  amount: number         // always positive; type determines sign in projection
  type: 'income' | 'expense'
  category: string
  isRecurring: boolean
  source: string         // 'manual' | 'orvex'
  createdAt: string
}

export interface SuggestedRecurring {
  description: string
  averageAmount: number
  category: string
}

interface PlannedRow {
  id: string
  date: string
  description: string
  amount: number | string
  type: string
  category: string
  is_recurring: boolean
  source: string
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('cashflow_planned')
}

function rowToItem(row: PlannedRow): PlannedItem {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: Math.abs(Number(row.amount)),
    type: row.type as 'income' | 'expense',
    category: row.category,
    isRecurring: row.is_recurring,
    source: row.source,
    createdAt: row.created_at,
  }
}

export async function getCashflowPlanned(): Promise<PlannedItem[]> {
  const db = getSupabaseClient()
  const { data, error } = await table(db)
    .select('*')
    .order('date', { ascending: true })

  if (error) {
    // Table may not exist yet — return empty array gracefully
    console.warn('[cashflow_planned] getCashflowPlanned error:', error.message)
    return []
  }
  return (data as PlannedRow[]).map(rowToItem)
}

export interface InsertPlannedItem {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  isRecurring: boolean
  source: string
}

export async function insertPlannedItem(item: InsertPlannedItem): Promise<PlannedItem> {
  const db = getSupabaseClient()
  const { data, error } = await table(db)
    .insert({
      date: item.date,
      description: item.description,
      amount: Math.abs(item.amount),
      type: item.type,
      category: item.category,
      is_recurring: item.isRecurring,
      source: item.source,
    })
    .select()
    .single()

  if (error) throw new Error(`insertPlannedItem: ${error.message}`)
  return rowToItem(data as PlannedRow)
}

export async function deletePlannedItem(id: string): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await table(db).delete().eq('id', id)
  if (error) throw new Error(`deletePlannedItem: ${error.message}`)
}
