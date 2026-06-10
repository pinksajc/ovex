import { getDeals } from '@/lib/deals'
import { getCurrentUser } from '@/lib/auth'
import { NuevaOfertaForm } from './form'

export default async function NuevaOfertaPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string }>
}) {
  const { dealId: preselectedDealId } = await searchParams

  let deals: { id: string; company: { name: string; cif?: string; address?: string } }[] = []
  try {
    const user = await getCurrentUser()
    const allDeals = await getDeals(user ?? undefined)
    deals = allDeals.map((d) => ({
      id: d.id,
      company: { name: d.company.name, cif: d.company.cif, address: d.company.address },
    }))
  } catch {
    // non-critical
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Nueva oferta</h1>
        <p className="text-text-tertiary text-[13px] mt-0.5">El número se genera automáticamente al guardar.</p>
      </div>
      <NuevaOfertaForm deals={deals} preselectedDealId={preselectedDealId} />
    </div>
  )
}
