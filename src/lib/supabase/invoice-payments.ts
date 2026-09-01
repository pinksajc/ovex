import { getSupabaseClient } from './client'
import type { InvoiceStatus } from '@/types'

export interface InvoicePayment {
  id: string
  invoiceId: string
  amount: number
  paidAt: string
  notes: string | null
  createdBy: string | null
  createdAt: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(db: ReturnType<typeof getSupabaseClient>) {
  return (db as unknown as { from(t: string): any }).from('invoice_payments')
}

export async function getPaymentsByInvoice(invoiceId: string): Promise<InvoicePayment[]> {
  const db = getSupabaseClient()
  const { data, error } = await table(db)
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: true })
  if (error) throw error
  return (data as Array<{
    id: string; invoice_id: string; amount: string; paid_at: string;
    notes: string | null; created_by: string | null; created_at: string
  }>).map((r) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    amount: Number(r.amount),
    paidAt: r.paid_at,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }))
}

export interface CreatePaymentInput {
  invoiceId: string
  amount: number
  paidAt: string
  notes?: string
  createdBy?: string
}

export async function createPayment(input: CreatePaymentInput): Promise<InvoicePayment> {
  const db = getSupabaseClient()
  const { data, error } = await table(db)
    .insert({
      invoice_id: input.invoiceId,
      amount: input.amount,
      paid_at: input.paidAt,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  const r = data as { id: string; invoice_id: string; amount: string; paid_at: string; notes: string | null; created_by: string | null; created_at: string }
  return { id: r.id, invoiceId: r.invoice_id, amount: Number(r.amount), paidAt: r.paid_at, notes: r.notes, createdBy: r.created_by, createdAt: r.created_at }
}

export async function deletePayment(id: string): Promise<void> {
  const db = getSupabaseClient()
  const { error } = await table(db).delete().eq('id', id)
  if (error) throw error
}

export async function getTotalPaid(invoiceId: string): Promise<number> {
  const payments = await getPaymentsByInvoice(invoiceId)
  return payments.reduce((sum, p) => sum + p.amount, 0)
}

/** Returns a map of invoiceId → totalPaid for all invoices that have at least one payment. */
export async function getPaymentTotals(): Promise<Record<string, number>> {
  const db = getSupabaseClient()
  const { data, error } = await table(db)
    .select('invoice_id, amount')
  if (error) return {}
  const map: Record<string, number> = {}
  for (const row of (data as Array<{ invoice_id: string; amount: string }>) ?? []) {
    map[row.invoice_id] = (map[row.invoice_id] ?? 0) + Number(row.amount)
  }
  return map
}

/**
 * After adding or removing a payment, recompute whether the invoice
 * status should be 'paid' or reverted.
 * Returns the new effective status.
 */
export async function syncInvoiceStatusFromPayments(
  invoiceId: string,
  invoiceTotal: number,
  currentStatus: InvoiceStatus,
  dueAt: string | null,
): Promise<InvoiceStatus> {
  const totalPaid = await getTotalPaid(invoiceId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoicesTable = (db: ReturnType<typeof getSupabaseClient>) =>
    (db as unknown as { from(t: string): any }).from('invoices')

  const db = getSupabaseClient()

  if (totalPaid >= invoiceTotal) {
    // Mark as fully paid
    const { error } = await invoicesTable(db).update({ status: 'paid' }).eq('id', invoiceId)
    if (error) throw error
    return 'paid'
  }

  // If it was 'paid' but payments were deleted, revert
  if (currentStatus === 'paid') {
    const today = new Date().toISOString().slice(0, 10)
    const newStatus: InvoiceStatus = (dueAt && dueAt <= today) ? 'overdue' : 'issued'
    const { error } = await invoicesTable(db).update({ status: newStatus }).eq('id', invoiceId)
    if (error) throw error
    return newStatus
  }

  return currentStatus
}
