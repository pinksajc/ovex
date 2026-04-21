'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { updateDealCompany } from '@/lib/supabase/deals'

export async function updateCompanyAction(
  dealId: string,
  name: string,
  cif: string,
  address: string,
  city: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dealId) return { ok: false, error: 'dealId requerido' }
  if (!name.trim()) return { ok: false, error: 'El nombre es obligatorio' }
  try {
    await updateDealCompany(dealId, { name, cif, address, city })
    revalidateTag('attio-deals', 'max')
    revalidatePath(`/deals/${dealId}`)
    revalidatePath('/deals')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error actualizando empresa',
    }
  }
}
