import { getDeals } from '@/lib/deals'
import { getCurrentUser } from '@/lib/auth'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'

export default async function PipelinePage() {
  const user = await getCurrentUser()
  const deals = await getDeals(user ?? undefined)

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Pipeline</h1>
        <p className="text-text-tertiary text-[13px] mt-0.5">{deals.length} deals activos</p>
      </div>
      <PipelineBoard deals={deals} />
    </div>
  )
}
