import { getDeals } from '@/lib/deals'
import { getCurrentUser } from '@/lib/auth'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'

// Pipeline shows aggregate stage data — revalidate every 60 s for a balance of
// freshness vs. server load. Increase or remove if real-time updates are needed.
export const revalidate = 60

export default async function PipelinePage() {
  const user = await getCurrentUser()
  const deals = await getDeals(user ?? undefined)

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Pipeline</h1>
        <p className="text-zinc-500 text-sm mt-1">{deals.length} deals activos</p>
      </div>
      <PipelineBoard deals={deals} />
    </div>
  )
}
