'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { updateDealCompany } from '@/lib/supabase/deals'

export async function updateCompanyAction(
  dealId: string,
  cif: string,
  address: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dealId) return { ok: false, error: 'dealId requerido' }
  try {
    await updateDealCompany(dealId, { cif, address })
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
