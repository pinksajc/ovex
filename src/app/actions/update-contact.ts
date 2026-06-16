'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { upsertContactOverride } from '@/lib/supabase/contact-overrides'

export async function updateContactAction(
  _personRecordId: string,
  firstName: string,
  lastName: string,
  emails: string[],
  dealId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAuth()
  if (!dealId) return { ok: false, error: 'dealId requerido' }
  try {
    await upsertContactOverride(dealId, firstName, lastName, emails)
    revalidateTag('attio-deals', 'max')
    revalidatePath('/deals')
    revalidatePath(`/deals/${dealId}`)
    revalidatePath(`/deals/${dealId}/propuesta`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error actualizando contacto',
    }
  }
}
