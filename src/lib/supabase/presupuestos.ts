// =========================================
// PRESUPUESTOS — Supabase CRUD
// server-only
// =========================================

// -- DDL (run manually in Supabase SQL editor) --
// CREATE TABLE presupuestos (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   number text NOT NULL UNIQUE,
//   deal_id text,
//   client_name text NOT NULL,
//   client_cif text,
//   client_address text,
//   concept text NOT NULL DEFAULT '',
//   line_items jsonb NOT NULL DEFAULT '[]',
//   amount_net numeric(12,2) NOT NULL DEFAULT 0,
//   vat_rate numeric(5,2) NOT NULL DEFAULT 21,
//   amount_total numeric(12,2) NOT NULL DEFAULT 0,
//   status text NOT NULL DEFAULT 'draft',
//   valid_until date,
//   notes text,
//   created_at timestamptz NOT NULL DEFAULT now(),
//   updated_at timestamptz NOT NULL DEFAULT now()
// );
// CREATE INDEX presupuestos_deal_id_idx ON presupuestos(deal_id);
// CREATE INDEX presupuestos_status_idx ON presupuestos(status);
// CREATE INDEX presupuestos_created_at_idx ON presupuestos(created_at DESC);

import { getSupabaseClient } from './client'
import type { Presupuesto, CreatePresupuestoInput, UpdatePresupuestoInput, PresupuestoStatus, InvoiceLineItem } from '@/types'

// ---- Row → Presupuesto ----

interface PresupuestoRow {
  id: string
  number: string
  deal_id: string | null
  client_name: string
  client_cif: string | null
  client_address: string | null
  concept: string
  line_items: unknown
  amount_net: number
  vat_rate: number
  amount_total: number
  status: string
  valid_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function parseLineItems(raw: unknown): InvoiceLineItem[] {
  if (Array.isArray(raw)) return raw as InvoiceLineItem[]
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed as InvoiceLineItem[] } catch { /* ignore */ }
  }
  return []
}

function rowToPresupuesto(row: PresupuestoRow): Presupuesto {
  return {
    id: row.id,
    number: row.number,
    dealId: row.deal_id,
    clientName: row.client_name,
    clientCif: row.client_cif,
    clientAddress: row.client_address,
    concept: row.concept,
    lineItems: parseLineItems(row.line_items),
    amountNet: Number(row.amount_net),
    vatRate: Number(row.vat_rate),
    amountTotal: Number(row.amount_total),
    status: row.status as PresupuestoStatus,
    validUntil: row.valid_until,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---- Number generation ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function presupuestosTable(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('presupuestos')
}

async function generatePresupuestoNumber(): Promise<string> {
  const db = getSupabaseClient()
  const year = new Date().getFullYear()

  const { count } = await presupuestosTable(db)
    .select('id', { count: 'exact', head: true })
    .like('number', `O-${year}-%`)

  const seq = (count ?? 0) + 1
  return `O-${year}-${String(seq).padStart(4, '0')}`
}

// =========================================
// READS
// =========================================

export async function getPresupuestos(): Promise<Presupuesto[]> {
  const db = getSupabaseClient()
  const { data, error } = await presupuestosTable(db)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as PresupuestoRow[]).map(rowToPresupuesto)
}

export async function getPresupuesto(id: string): Promise<Presupuesto | null> {
  const db = getSupabaseClient()
  const { data, error } = await presupuestosTable(db)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return rowToPresupuesto(data as PresupuestoRow)
}

export async function getPresupuestosByDeal(dealId: string): Promise<Presupuesto[]> {
  const db = getSupabaseClient()
  const { data, error } = await presupuestosTable(db)
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as PresupuestoRow[]).map(rowToPresupuesto)
}

// =========================================
// WRITES
// =========================================

export async function createPresupuesto(input: CreatePresupuestoInput): Promise<Presupuesto> {
  const db = getSupabaseClient()
  const number = await generatePresupuestoNumber()

  const { data, error } = await presupuestosTable(db)
    .insert({
      number,
      deal_id: input.dealId ?? null,
      client_name: input.clientName,
      client_cif: input.clientCif ?? null,
      client_address: input.clientAddress ?? null,
      concept: input.concept,
      line_items: JSON.stringify(input.lineItems),
      amount_net: input.amountNet,
      vat_rate: input.vatRate,
      amount_total: input.amountTotal,
      status: 'draft',
      valid_until: input.validUntil ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return rowToPresupuesto(data as PresupuestoRow)
}

export async function updatePresupuesto(id: string, input: UpdatePresupuestoInput): Promise<Presupuesto> {
  const db = getSupabaseClient()
  const { data, error } = await presupuestosTable(db)
    .update({
      deal_id: input.dealId ?? null,
      client_name: input.clientName,
      client_cif: input.clientCif ?? null,
      client_address: input.clientAddress ?? null,
      concept: input.concept,
      line_items: JSON.stringify(input.lineItems),
      amount_net: input.amountNet,
      vat_rate: input.vatRate,
      amount_total: input.amountTotal,
      valid_until: input.validUntil ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return rowToPresupuesto(data as PresupuestoRow)
}

export async function updatePresupuestoStatus(id: string, status: PresupuestoStatus): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await presupuestosTable(db)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
