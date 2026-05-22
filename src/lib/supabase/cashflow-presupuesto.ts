// =========================================
// CASHFLOW_PRESUPUESTO — Supabase CRUD
// server-only
// =========================================

import { getSupabaseClient } from './client'

export interface Presupuesto {
  id: string
  categoria: string
  presupuestoMensual: number
  createdAt: string
}

interface PresupuestoRow {
  id: string
  categoria: string
  presupuesto_mensual: number | string
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('cashflow_presupuesto')
}

function rowToItem(row: PresupuestoRow): Presupuesto {
  return {
    id: row.id,
    categoria: row.categoria,
    presupuestoMensual: Number(row.presupuesto_mensual),
    createdAt: row.created_at,
  }
}

export async function getCashflowPresupuesto(): Promise<Presupuesto[]> {
  const db = getSupabaseClient()
  const { data, error } = await table(db)
    .select('*')
    .order('categoria', { ascending: true })

  if (error) {
    // Table may not exist yet — return empty array gracefully
    console.warn('[cashflow_presupuesto] getCashflowPresupuesto error:', error.message)
    return []
  }
  return (data as PresupuestoRow[]).map(rowToItem)
}

export async function upsertPresupuesto(
  categoria: string,
  presupuestoMensual: number,
): Promise<void> {
  const db = getSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (table(db) as any).upsert(
    { categoria, presupuesto_mensual: presupuestoMensual },
    { onConflict: 'categoria' },
  )
  if (error) throw new Error(`upsertPresupuesto: ${error.message}`)
}
