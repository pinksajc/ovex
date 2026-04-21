'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createPresupuesto, updatePresupuesto, updatePresupuestoStatus } from '@/lib/supabase/presupuestos'
import type { CreatePresupuestoInput, UpdatePresupuestoInput, PresupuestoStatus } from '@/types'

export async function createPresupuestoAction(input: CreatePresupuestoInput): Promise<{ error?: string }> {
  try {
    const presupuesto = await createPresupuesto(input)
    revalidatePath('/presupuestos')
    revalidatePath('/deals')
    redirect(`/presupuestos/${presupuesto.id}`)
  } catch (err) {
    // redirect() throws internally — rethrow it
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    return { error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function updatePresupuestoAction(
  id: string,
  input: UpdatePresupuestoInput
): Promise<{ error?: string }> {
  try {
    await updatePresupuesto(id, input)
    revalidatePath('/presupuestos')
    revalidatePath(`/presupuestos/${id}`)
    revalidatePath('/deals')
    redirect(`/presupuestos/${id}`)
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    return { error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function updatePresupuestoStatusAction(
  id: string,
  status: PresupuestoStatus
): Promise<{ ok: boolean; error?: string }> {
  try {
    await updatePresupuestoStatus(id, status)
    revalidatePath('/presupuestos')
    revalidatePath(`/presupuestos/${id}`)
    revalidatePath('/deals')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
