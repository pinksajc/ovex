'use server'

import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { createDeal } from '@/lib/supabase/deals'
import type { DealStage } from '@/types'

export async function createDealAction(formData: FormData): Promise<void> {
  const user = await requireAuth()

  const companyName = (formData.get('companyName') as string | null)?.trim() ?? ''
  if (!companyName) {
    redirect('/deals/new?error=' + encodeURIComponent('El nombre de la empresa es obligatorio.'))
  }

  const contactFirstName = (formData.get('contactFirstName') as string | null)?.trim() || undefined
  const contactLastName  = (formData.get('contactLastName')  as string | null)?.trim() || undefined
  const contactEmail     = (formData.get('contactEmail')     as string | null)?.trim() || undefined
  const contactPhone     = (formData.get('contactPhone')     as string | null)?.trim() || undefined
  const stage            = ((formData.get('stage') as string | null) ?? 'prospecting') as DealStage
  const ownerIdRaw       = (formData.get('ownerId') as string | null)?.trim()
  const ownerId          = ownerIdRaw || user.id

  const deal = await createDeal({
    companyName,
    contactFirstName,
    contactLastName,
    contactEmail,
    contactPhone,
    stage,
    ownerId,
  })

  revalidateTag('attio-deals', 'max')

  redirect(`/deals/${deal.id}`)
}
