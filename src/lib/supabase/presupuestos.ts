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
// NOTE: concept is NOT a DB column — it is derived at runtime from line_items.

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
  // concept column may not exist in older table versions — derived from line_items
  concept?: string
  line_items: unknown
  amount_net: number
  vat_rate: number
  amount_total: number
  status: string
  valid_until: string | null
  notes: string | null
  requires_signature?: boolean | null
  contract_start_date?: string | null
  signed_contract_url?: string | null
  signed_contract_filename?: string | null
  signed_at?: string | null
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
  const lineItems = parseLineItems(row.line_items)
  const filledLines = lineItems.filter((l) => l.type === 'line' && l.description?.trim())
  const derivedConcept = row.concept?.trim()
    || (filledLines.length === 1 ? filledLines[0].description.trim() : filledLines.length > 1 ? 'Varios conceptos' : '')
  return {
    id: row.id,
    number: row.number,
    dealId: row.deal_id,
    clientName: row.client_name,
    clientCif: row.client_cif,
    clientAddress: row.client_address,
    concept: derivedConcept,
    lineItems,
    amountNet: Number(row.amount_net),
    vatRate: Number(row.vat_rate),
    amountTotal: Number(row.amount_total),
    status: row.status as PresupuestoStatus,
    validUntil: row.valid_until,
    notes: row.notes,
    requiresSignature: row.requires_signature === true,
    contractStartDate: row.contract_start_date ?? null,
    signedContractUrl: row.signed_contract_url ?? null,
    signedContractFilename: row.signed_contract_filename ?? null,
    signedAt: row.signed_at ?? null,
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
      line_items: JSON.stringify(input.lineItems),
      amount_net: input.amountNet,
      vat_rate: input.vatRate,
      amount_total: input.amountTotal,
      status: 'draft',
      valid_until: input.validUntil ?? null,
      notes: input.notes ?? null,
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
      line_items: JSON.stringify(input.lineItems),
      amount_net: input.amountNet,
      vat_rate: input.vatRate,
      amount_total: input.amountTotal,
      valid_until: input.validUntil ?? null,
      notes: input.notes ?? null,
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
    .update({ status })
    .eq('id', id)

  if (error) throw error
}

export async function updatePresupuestoSignatureRequired(id: string, value: boolean): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await presupuestosTable(db)
    .update({ requires_signature: value })
    .eq('id', id)

  if (error) throw error
}

export async function updatePresupuestoContractStartDate(id: string, date: string | null): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await presupuestosTable(db)
    .update({ contract_start_date: date })
    .eq('id', id)

  if (error) throw error
}

export interface ContractUpload {
  url: string
  filename: string
  signedAt: string
}

export async function updatePresupuestoContract(id: string, upload: ContractUpload | null): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await presupuestosTable(db)
    .update(
      upload === null
        ? { signed_contract_url: null, signed_contract_filename: null, signed_at: null }
        : { signed_contract_url: upload.url, signed_contract_filename: upload.filename, signed_at: upload.signedAt }
    )
    .eq('id', id)

  if (error) throw error
}

/** Returns accepted presupuestos that have a contract_start_date but whose deal
 *  has not been invoiced in the current calendar month. Used for billing reminders. */
export async function getPendingBillingPresupuestos(): Promise<Presupuesto[]> {
  const db = getSupabaseClient()

  // Fetch accepted presupuestos with a contract start date
  const { data: rows, error } = await presupuestosTable(db)
    .select('*')
    .eq('status', 'accepted')
    .not('contract_start_date', 'is', null)
    .not('deal_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[presupuestos] getPendingBillingPresupuestos error:', error.message)
    return []
  }

  const candidates = (rows as PresupuestoRow[]).map(rowToPresupuesto)
  if (candidates.length === 0) return []

  // Collect unique deal_ids
  const dealIds = [...new Set(candidates.map((p) => p.dealId).filter(Boolean))] as string[]

  // Fetch invoices for current month for those deals
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoicesDb = (db as unknown as { from(t: string): any }).from('invoices')
  const { data: invRows, error: invErr } = await invoicesDb
    .select('deal_id')
    .in('deal_id', dealIds)
    .gte('issued_at', monthStart)
    .not('status', 'eq', 'draft')

  if (invErr) {
    console.warn('[presupuestos] getPendingBillingPresupuestos invoice query error:', invErr.message)
    return candidates // conservative: show all
  }

  const billedDealIds = new Set((invRows as { deal_id: string }[]).map((r) => r.deal_id))

  // Return only presupuestos whose deal has NOT been invoiced this month
  return candidates.filter((p) => p.dealId && !billedDealIds.has(p.dealId))
}
