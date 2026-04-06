'use server'

import { revalidateTag } from 'next/cache'
import { patchAttioPerson } from '@/lib/attio/client'

export async function updateContactAction(
  personRecordId: string,
  firstName: string,
  lastName: string,
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await patchAttioPerson(personRecordId, firstName, lastName, email)
    revalidateTag('attio-deals', 'max')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error actualizando contacto',
    }
  }
}
