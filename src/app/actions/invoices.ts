'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createInvoice, updateInvoiceStatus } from '@/lib/supabase/invoices'
import type { CreateInvoiceInput, InvoiceStatus } from '@/types'

export async function createInvoiceAction(input: CreateInvoiceInput): Promise<{ error?: string }> {
  try {
    const invoice = await createInvoice(input)
    revalidatePath('/facturas')
    redirect(`/facturas/${invoice.id}`)
  } catch (err) {
    // redirect() throws internally — rethrow it
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    return { error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function updateInvoiceStatusAction(
  id: string,
  status: InvoiceStatus
): Promise<{ ok: boolean; error?: string }> {
  try {
    await updateInvoiceStatus(id, status)
    revalidatePath('/facturas')
    revalidatePath(`/facturas/${id}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
