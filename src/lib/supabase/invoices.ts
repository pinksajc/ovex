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
  due_date_enabled: boolean | null
  location_id: string | null
  rectifies_id: string | null
  converted_from_id: string | null
  created_at: string
  // joined fields from company_locations (when selected with join)
  company_locations?: {
    name: string | null
    address: string | null
    cost_center: string | null
  } | null
}

function parseLineItems(raw: unknown): InvoiceLineItem[] {
  if (Array.isArray(raw)) return raw as InvoiceLineItem[]
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed as InvoiceLineItem[] } catch { /* ignore */ }
  }
  return []
}

function rowToInvoice(row: InvoiceRow): Invoice {
  const loc = row.company_locations
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
    dueDateEnabled: row.due_date_enabled !== false, // default true if null
    locationId: row.location_id,
    locationName: loc?.name ?? null,
    locationAddress: loc?.address ?? null,
    locationCostCenter: loc?.cost_center ?? null,
    rectifiesId: row.rectifies_id,
    convertedFromId: row.converted_from_id,
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
  const prefix = type === 'rectificativa' ? 'R' : type === 'proforma' ? 'PF' : 'F'

  const { count } = await invoicesTable(db)
    .select('id', { count: 'exact', head: true })
    .like('number', `${prefix}-${year}-%`)

  const seq = (count ?? 0) + 1
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

// =========================================
// READS
// =========================================

const SELECT_WITH_LOCATION = '*, company_locations(name, address, cost_center)'

export async function getInvoices(): Promise<Invoice[]> {
  const db = getSupabaseClient()

  // Try with location join first; fall back to plain select if company_locations
  // table hasn't been migrated yet — prevents a crash on the invoice list page.
  const { data, error } = await invoicesTable(db)
    .select(SELECT_WITH_LOCATION)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getInvoices] location join failed, falling back to plain select:', error.message)
    const { data: fallback, error: fallbackError } = await invoicesTable(db)
      .select('*')
      .order('created_at', { ascending: false })
    if (fallbackError) throw fallbackError
    return (fallback as InvoiceRow[]).map(rowToInvoice)
  }

  return (data as InvoiceRow[]).map(rowToInvoice)
}

export async function getInvoicesByDeal(dealId: string): Promise<Invoice[]> {
  const db = getSupabaseClient()
  const { data, error } = await invoicesTable(db)
    .select('id, number, type, status, amount_total, issued_at')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Array<Pick<InvoiceRow, 'id' | 'number' | 'type' | 'status' | 'amount_total' | 'issued_at'>>).map(
    (row) => ({
      id: row.id,
      number: row.number,
      type: (row.type ?? 'ordinary') as InvoiceType,
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
      dueDateEnabled: true,
      locationId: null,
      locationName: null,
      locationAddress: null,
      locationCostCenter: null,
      rectifiesId: null,
      convertedFromId: null,
      createdAt: row.issued_at ?? '',
    })
  )
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const db = getSupabaseClient()

  const { data, error } = await invoicesTable(db)
    .select(SELECT_WITH_LOCATION)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[getInvoice] location join failed, falling back to plain select:', error.message)
    const { data: fallback, error: fallbackError } = await invoicesTable(db)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (fallbackError) throw fallbackError
    if (!fallback) return null
    return rowToInvoice(fallback as InvoiceRow)
  }

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
      due_at: (input.dueDateEnabled !== false) ? (input.dueAt ?? null) : null,
      due_date_enabled: input.dueDateEnabled !== false,
      location_id: input.locationId ?? null,
      rectifies_id: input.rectifiesId ?? null,
      converted_from_id: null,
    })
    .select(SELECT_WITH_LOCATION)
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
      due_at: (input.dueDateEnabled !== false) ? (input.dueAt ?? null) : null,
      due_date_enabled: input.dueDateEnabled !== false,
      location_id: input.locationId ?? null,
      rectifies_id: input.rectifiesId ?? null,
    })
    .eq('id', id)
    .select(SELECT_WITH_LOCATION)
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

/**
 * Converts a proforma into a real ordinary invoice.
 * - Creates a new invoice (type='ordinary') with the same data, status='draft', new F-YYYY number
 * - Marks the proforma status = 'converted'
 * Returns the new invoice.
 */
export async function convertProformaToInvoice(proformaId: string): Promise<Invoice> {
  const db = getSupabaseClient()

  // 1 — fetch the proforma
  const proforma = await getInvoice(proformaId)
  if (!proforma) throw new Error('Proforma no encontrada')
  if (proforma.type !== 'proforma') throw new Error('Esta factura no es una proforma')

  // 2 — generate new ordinary number
  const number = await generateInvoiceNumber('ordinary')

  // 3 — insert new invoice
  const { data, error } = await invoicesTable(db)
    .insert({
      number,
      type: 'ordinary',
      deal_id: proforma.dealId,
      client_name: proforma.clientName,
      client_cif: proforma.clientCif,
      client_address: proforma.clientAddress,
      concept: proforma.concept,
      line_items: JSON.stringify(proforma.lineItems),
      amount_net: proforma.amountNet,
      vat_rate: proforma.vatRate,
      amount_total: proforma.amountTotal,
      status: 'draft',
      issued_at: proforma.issuedAt,
      due_at: proforma.dueAt,
      due_date_enabled: proforma.dueDateEnabled,
      location_id: proforma.locationId,
      rectifies_id: null,
      converted_from_id: proformaId,
    })
    .select(SELECT_WITH_LOCATION)
    .single()

  if (error) throw new Error(`convertProforma insert: ${error.message}`)

  // 4 — mark proforma as converted
  const { error: statusErr } = await invoicesTable(db)
    .update({ status: 'converted' })
    .eq('id', proformaId)
  if (statusErr) throw new Error(`convertProforma status update: ${statusErr.message}`)

  return rowToInvoice(data as InvoiceRow)
}
