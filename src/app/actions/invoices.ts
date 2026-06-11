'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createInvoice, updateInvoice, updateInvoiceStatus, getInvoice, convertProformaToInvoice, deleteInvoice, getMaxInvoiceIssuedAt, updateInvoiceDueDate } from '@/lib/supabase/invoices'
import { insertCashflowTransactions } from '@/lib/supabase/cashflow'
import { requireAuth } from '@/lib/auth'
import { logApprovalEvent } from '@/lib/supabase/events'
import type { CreateInvoiceInput, UpdateInvoiceInput, InvoiceStatus } from '@/types'


export async function createInvoiceAction(input: CreateInvoiceInput): Promise<{ error?: string }> {
  await requireAuth()
  try {
    // Validate issue date is not before the most recent existing invoice
    if (input.issuedAt) {
      const maxDate = await getMaxInvoiceIssuedAt()
      if (maxDate && input.issuedAt < maxDate) {
        const formatted = new Date(maxDate + 'T00:00:00').toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        return { error: `La fecha no puede ser anterior a la última factura emitida (${formatted})` }
      }
    }

    const invoice = await createInvoice(input)

    // Log "pending approval" event if linked to a deal
    if (invoice.dealId) {
      await logApprovalEvent(invoice.dealId, 'approval_pending', {
        actor:          '',
        documentNumber: invoice.number,
      })
    }

    revalidatePath('/facturas')
    redirect(`/facturas/${invoice.id}`)
  } catch (err) {
    // redirect() throws internally — rethrow it
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    return { error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function updateInvoiceAction(
  id: string,
  input: UpdateInvoiceInput
): Promise<{ error?: string }> {
  await requireAuth()
  try {
    await updateInvoice(id, input)
    revalidatePath('/facturas')
    revalidatePath(`/facturas/${id}`)
    redirect(`/facturas/${id}`)
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    return { error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function convertProformaAction(
  proformaId: string,
): Promise<{ ok: boolean; invoiceId?: string; error?: string }> {
  await requireAuth()
  try {
    const invoice = await convertProformaToInvoice(proformaId)
    revalidatePath('/facturas')
    revalidatePath(`/facturas/${proformaId}`)
    return { ok: true, invoiceId: invoice.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function updateInvoiceStatusAction(
  id: string,
  status: InvoiceStatus
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth()
  try {
    // Fetch before updating so we know the previous status and have invoice details
    const invoice = await getInvoice(id)
    await updateInvoiceStatus(id, status)

    // Auto-create cashflow income entry the first time a factura (non-proforma) is marked paid
    if (status === 'paid' && invoice?.status !== 'paid' && invoice && invoice.type !== 'proforma') {
      const today = new Date().toISOString().split('T')[0]
      await insertCashflowTransactions([{
        date: today,
        description: `Factura ${invoice.number} · ${invoice.clientName}`,
        amount: invoice.amountNet,
        type: 'income',
        category: 'Ingreso cliente',
        currency: 'EUR',
        state: null,
        balance: null,
        sourceFile: 'orvex-facturas',
      }])
      revalidatePath('/cashflow')
    }

    revalidatePath('/facturas')
    revalidatePath(`/facturas/${id}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}


export async function updateDueDateAction(
  id: string,
  dueAt: string | null,
  currentStatus: InvoiceStatus,
): Promise<{ ok: boolean; newStatus?: InvoiceStatus; error?: string }> {
  await requireAuth()
  try {
    const newStatus = await updateInvoiceDueDate(id, dueAt, currentStatus)
    revalidatePath('/facturas')
    revalidatePath(`/facturas/${id}`)
    return { ok: true, newStatus }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function deleteInvoiceAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth()
  try {
    await deleteInvoice(id)
    revalidatePath('/facturas')
    redirect('/facturas')
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
