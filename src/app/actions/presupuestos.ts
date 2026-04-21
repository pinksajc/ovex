'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createPresupuesto, updatePresupuesto, updatePresupuestoStatus } from '@/lib/supabase/presupuestos'
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
