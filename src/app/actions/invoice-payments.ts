'use server'

import { requireAuth } from '@/lib/auth'
import {
  createPayment,
  deletePayment,
  syncInvoiceStatusFromPayments,
} from '@/lib/supabase/invoice-payments'
import { getInvoice } from '@/lib/supabase/invoices'
import { revalidatePath } from 'next/cache'

export async function addPaymentAction(
  invoiceId: string,
  amount: number,
  paidAt: string,
  notes: string,
): Promise<void> {
  const user = await requireAuth()

  if (!invoiceId) throw new Error('invoiceId requerido')
  if (!amount || amount <= 0) throw new Error('El monto debe ser mayor que 0')
  if (!paidAt) throw new Error('Fecha de pago requerida')

  const invoice = await getInvoice(invoiceId)
  if (!invoice) throw new Error('Factura no encontrada')
  if (invoice.status === 'draft') throw new Error('No se pueden registrar pagos en facturas en borrador')
  if (invoice.status === 'converted') throw new Error('No se pueden registrar pagos en facturas convertidas')

  await createPayment({ invoiceId, amount, paidAt, notes, createdBy: user.id })
  await syncInvoiceStatusFromPayments(invoiceId, invoice.amountTotal, invoice.status, invoice.dueAt)

  revalidatePath(`/facturas/${invoiceId}`)
}

export async function deletePaymentAction(
  paymentId: string,
  invoiceId: string,
): Promise<void> {
  await requireAuth()
  await deletePayment(paymentId)

  const invoice = await getInvoice(invoiceId)
  if (invoice) {
    await syncInvoiceStatusFromPayments(invoiceId, invoice.amountTotal, invoice.status, invoice.dueAt)
  }

  revalidatePath(`/facturas/${invoiceId}`)
}
