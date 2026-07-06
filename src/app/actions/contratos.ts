'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createContrato } from '@/lib/supabase/contratos'

export interface SaveContratoInput {
  presupuestoId: string
  dealId?: string | null
  duracionMeses: number
  permanenciaMeses: number
  formaPago: string
  fechaInicio: string  // YYYY-MM-DD
  notas?: string | null
  equipment?: unknown | null
}

export async function saveContratoAction(
  input: SaveContratoInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
      return { ok: false, error: 'Sin permisos' }
    }

    const row = await createContrato({
      presupuesto_id: input.presupuestoId,
      deal_id: input.dealId ?? null,
      duracion_meses: input.duracionMeses,
      permanencia_meses: input.permanenciaMeses,
      forma_pago: input.formaPago,
      fecha_inicio: input.fechaInicio,
      notas: input.notas ?? null,
      equipment: input.equipment ?? null,
    })

    revalidatePath(`/ofertas/${input.presupuestoId}`)
    if (input.dealId) revalidatePath(`/deals/${input.dealId}`)

    return { ok: true, id: row.id }
  } catch (err) {
    console.error('[saveContratoAction]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
