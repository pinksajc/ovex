'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createPresupuesto, updatePresupuesto, updatePresupuestoStatus, updatePresupuestoSignatureRequired, getPresupuesto } from '@/lib/supabase/presupuestos'
import type { CreatePresupuestoInput, UpdatePresupuestoInput, PresupuestoStatus } from '@/types'

export async function createPresupuestoAction(input: CreatePresupuestoInput): Promise<{ error?: string }> {
  try {
    const presupuesto = await createPresupuesto(input)
    revalidatePath('/ofertas')
    revalidatePath('/deals')
    redirect(`/ofertas/${presupuesto.id}`)
  } catch (err) {
    // redirect() throws internally — rethrow it
    if (isRedirectError(err)) throw err
    return { error: (err as { message?: string })?.message ?? 'Error desconocido' }
  }
}

export async function updatePresupuestoAction(
  id: string,
  input: UpdatePresupuestoInput
): Promise<{ error?: string }> {
  try {
    await updatePresupuesto(id, input)
    revalidatePath('/ofertas')
    revalidatePath(`/ofertas/${id}`)
    revalidatePath('/deals')
    redirect(`/ofertas/${id}`)
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: (err as { message?: string })?.message ?? 'Error desconocido' }
  }
}

export async function updatePresupuestoStatusAction(
  id: string,
  status: PresupuestoStatus
): Promise<{ ok: boolean; error?: string }> {
  try {
    await updatePresupuestoStatus(id, status)

    revalidatePath('/ofertas')
    revalidatePath(`/ofertas/${id}`)
    revalidatePath('/deals')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as { message?: string })?.message ?? 'Error desconocido' }
  }
}

/**
 * Marks a presupuesto as 'accepted' and prepends contract reference +
 * acceptance date to the notes field.
 */
export async function toggleRequiresSignatureAction(
  id: string,
  value: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await updatePresupuestoSignatureRequired(id, value)
    revalidatePath(`/ofertas/${id}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as { message?: string })?.message ?? 'Error desconocido' }
  }
}

export async function acceptContratoAction(
  id: string,
  contractRef: string,
  acceptanceDate: string,
  additionalNotes: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const pq = await getPresupuesto(id)
    if (!pq) return { ok: false, error: 'Oferta no encontrada' }

    const contractNote = `Contrato: ${contractRef} · Aceptado: ${acceptanceDate}`
    const newNotes = [contractNote, additionalNotes.trim(), pq.notes]
      .filter(Boolean)
      .join('\n\n')

    await updatePresupuesto(id, {
      dealId: pq.dealId,
      clientName: pq.clientName,
      clientCif: pq.clientCif,
      clientAddress: pq.clientAddress,
      lineItems: pq.lineItems,
      amountNet: pq.amountNet,
      vatRate: pq.vatRate,
      amountTotal: pq.amountTotal,
      validUntil: pq.validUntil,
      notes: newNotes,
    })
    await updatePresupuestoStatus(id, 'accepted')

    revalidatePath('/ofertas')
    revalidatePath(`/ofertas/${id}`)
    revalidatePath('/deals')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as { message?: string })?.message ?? 'Error desconocido' }
  }
}
