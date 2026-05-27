'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  updatePresupuestoContractStartDate,
  updatePresupuestoContract,
} from '@/lib/supabase/presupuestos'

export async function updateContractStartDateAction(
  presupuestoId: string,
  date: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    if (user.role !== 'owner' && user.role !== 'admin') throw new Error('No autorizado')
    await updatePresupuestoContractStartDate(presupuestoId, date)
    revalidatePath(`/ofertas/${presupuestoId}`)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

export async function uploadContractAction(
  formData: FormData,
): Promise<{ ok: boolean; url?: string; filename?: string; error?: string }> {
  try {
    const user = await requireAuth()
    if (user.role !== 'owner' && user.role !== 'admin') throw new Error('No autorizado')

    const presupuestoId = formData.get('presupuestoId') as string
    const file = formData.get('file') as File

    if (!presupuestoId || !file) throw new Error('Faltan datos')

    const ext = file.name.split('.').pop() ?? 'pdf'
    const filename = `contrato-firmado.${ext}`
    const storagePath = `${presupuestoId}/${filename}`

    const db = getSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = (db as unknown as { storage: any }).storage
    const bucket = storage.from('signed-contracts')

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await bucket.upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/pdf',
      upsert: true,
    })
    if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`)

    // Get a long-lived signed URL (10 years)
    const { data: signedData, error: signedError } = await bucket.createSignedUrl(
      storagePath,
      60 * 60 * 24 * 365 * 10,
    )
    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Signed URL: ${signedError?.message ?? 'no url'}`)
    }

    const url = signedData.signedUrl
    const signedAt = new Date().toISOString()

    await updatePresupuestoContract(presupuestoId, { url, filename, signedAt })
    revalidatePath(`/ofertas/${presupuestoId}`)
    revalidatePath('/dashboard')

    return { ok: true, url, filename }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

export async function removeContractAction(
  presupuestoId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    if (user.role !== 'owner' && user.role !== 'admin') throw new Error('No autorizado')
    await updatePresupuestoContract(presupuestoId, null)
    revalidatePath(`/ofertas/${presupuestoId}`)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}
