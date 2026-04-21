import { getDeals } from '@/lib/deals'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'

export default async function PipelinePage() {
  const deals = await getDeals()

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
