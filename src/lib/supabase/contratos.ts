// Supabase access layer for the `contratos` table.
//
// Requires migration:
//   supabase/migrations/20260609000002_contratos.sql

import { createClient } from '@supabase/supabase-js'

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

export interface ContratoRow {
  id: string
  deal_id: string | null
  presupuesto_id: string
  created_at: string
  duracion_meses: number
  permanencia_meses: number
  forma_pago: string
  fecha_inicio: string
  notas: string | null
}

export interface ContratoInsert {
  deal_id?: string | null
  presupuesto_id: string
  duracion_meses: number
  permanencia_meses: number
  forma_pago: string
  fecha_inicio: string  // YYYY-MM-DD
  notas?: string | null
}

export async function createContrato(data: ContratoInsert): Promise<ContratoRow> {
  const { data: row, error } = await db()
    .from('contratos')
    .insert({
      deal_id: data.deal_id ?? null,
      presupuesto_id: data.presupuesto_id,
      duracion_meses: data.duracion_meses,
      permanencia_meses: data.permanencia_meses,
      forma_pago: data.forma_pago,
      fecha_inicio: data.fecha_inicio,
      notas: data.notas ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`createContrato: ${error.message}`)
  return row as ContratoRow
}

export async function getContratosByPresupuesto(presupuestoId: string): Promise<ContratoRow[]> {
  const { data, error } = await db()
    .from('contratos')
    .select('*')
    .eq('presupuesto_id', presupuestoId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getContratosByPresupuesto: ${error.message}`)
  return (data ?? []) as ContratoRow[]
}
