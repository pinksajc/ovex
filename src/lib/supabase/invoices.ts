// =========================================
// INVOICES — Supabase CRUD
// server-only
// =========================================

import { getSupabaseClient } from './client'
import type { Invoice, CreateInvoiceInput, UpdateInvoiceInput, InvoiceStatus, InvoiceType, InvoiceLineItem } from '@/types'

// ---- Row → Invoice ----

interface InvoiceRow {
  id: string
  number: string
  type: string
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
  issued_at: string | null
  due_at: string | null
  rectifies_id: string | null
  created_at: string
}

function parseLineItems(raw: unknown): InvoiceLineItem[] {
  if (Array.isArray(raw)) return raw as InvoiceLineItem[]
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed as InvoiceLineItem[] } catch { /* ignore */ }
  }
  return []
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    type: row.type as InvoiceType,
    dealId: row.deal_id,
    clientName: row.client_name,
    clientCif: row.client_cif,
    clientAddress: row.client_address,
    concept: row.concept,
    lineItems: parseLineItems(row.line_items),
    amountNet: Number(row.amount_net),
    vatRate: Number(row.vat_rate),
    amountTotal: Number(row.amount_total),
    status: row.status as InvoiceStatus,
    issuedAt: row.issued_at,
    dueAt: row.due_at,
    rectifiesId: row.rectifies_id,
    createdAt: row.created_at,
  }
}

// ---- Number generation ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invoicesTable(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('invoices')
}

async function generateInvoiceNumber(type: InvoiceType): Promise<string> {
  const db = getSupabaseClient()
  const year = new Date().getFullYear()
  const prefix = type === 'rectificativa' ? 'R' : 'F'

  const { count } = await invoicesTable(db)
    .select('id', { count: 'exact', head: true })
    .like('number', `${prefix}-${year}-%`)

  const seq = (count ?? 0) + 1
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

// =========================================
// READS
// =========================================

export async function getInvoices(): Promise<Invoice[]> {
  const db = getSupabaseClient()
  const { data, error } = await invoicesTable(db)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as InvoiceRow[]).map(rowToInvoice)
}

export async function getInvoicesByDeal(dealId: string): Promise<Invoice[]> {
  const db = getSupabaseClient()
  const { data, error } = await invoicesTable(db)
    .select('id, number, status, amount_total, issued_at')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })

  if (error) throw error
  // Partial row — only fields needed for the deal detail card
  return (data as Array<Pick<InvoiceRow, 'id' | 'number' | 'status' | 'amount_total' | 'issued_at'>>).map(
    (row) => ({
      id: row.id,
      number: row.number,
      type: 'ordinary' as InvoiceType,
      dealId,
      clientName: '',
      clientCif: null,
      clientAddress: null,
      concept: '',
      lineItems: [],
      amountNet: 0,
      vatRate: 21,
      amountTotal: Number(row.amount_total),
      status: row.status as InvoiceStatus,
      issuedAt: row.issued_at,
      dueAt: null,
      rectifiesId: null,
      createdAt: row.issued_at ?? '',
    })
  )
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const db = getSupabaseClient()
  const { data, error } = await invoicesTable(db)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return rowToInvoice(data as InvoiceRow)
}

// =========================================
// WRITES
// =========================================

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const db = getSupabaseClient()
  const number = await generateInvoiceNumber(input.type)

  const { data, error } = await invoicesTable(db)
    .insert({
      number,
      type: input.type,
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
      issued_at: input.issuedAt ?? null,
      due_at: input.dueAt ?? null,
      rectifies_id: input.rectifiesId ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return rowToInvoice(data as InvoiceRow)
}

export async function updateInvoice(id: string, input: UpdateInvoiceInput): Promise<Invoice> {
  const db = getSupabaseClient()
  const { data, error } = await invoicesTable(db)
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
      issued_at: input.issuedAt ?? null,
      due_at: input.dueAt ?? null,
      rectifies_id: input.rectifiesId ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return rowToInvoice(data as InvoiceRow)
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await invoicesTable(db)
    .update({ status })
    .eq('id', id)

  if (error) throw error
}
