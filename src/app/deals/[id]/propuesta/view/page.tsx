import { notFound } from 'next/navigation'
import { getDeal, getActiveConfig } from '@/lib/deals'
import { getCurrentUser } from '@/lib/auth'
import { logEvent } from '@/lib/supabase/events'
import { PdfViewer } from '@/components/propuesta/pdf-viewer'

export default async function PropuestaViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  const deal = await getDeal(id, user ?? undefined)
  if (!deal) notFound()
  void logEvent('proposal_viewed', id)

  const cfg = getActiveConfig(deal)
  if (!cfg) notFound()

  return <PdfViewer dealId={deal.id} configId={cfg.id} />
}
