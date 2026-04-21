import { getDeals } from '@/lib/deals'
import { NuevaOfertaForm } from './form'

export default async function NuevaOfertaPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string }>
}) {
  const { dealId: preselectedDealId } = await searchParams

  let deals: { id: string; company: { name: string; cif?: string; address?: string } }[] = []
  try {
    const allDeals = await getDeals()
    deals = allDeals.map((d) => ({
      id: d.id,
      company: { name: d.company.name, cif: d.company.cif, address: d.company.address },
    }))
  } catch {
    // non-critical
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Nueva oferta</h1>
        <p className="text-zinc-500 text-sm mt-1">El número se genera automáticamente al guardar.</p>
      </div>
      <NuevaOfertaForm deals={deals} preselectedDealId={preselectedDealId} />
    </div>
  )
}
