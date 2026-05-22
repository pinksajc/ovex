'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { upsertPresupuesto } from '@/lib/supabase/cashflow-presupuesto'

export async function upsertPresupuestoAction(
  categoria: string,
  presupuestoMensual: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    if (user.role !== 'owner' && user.role !== 'admin') throw new Error('No autorizado')
    await upsertPresupuesto(categoria, presupuestoMensual)
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}
