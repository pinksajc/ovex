import { getDeals } from '@/lib/deals'
import { getCurrentUser } from '@/lib/auth'
import { NewInvoiceForm } from './form'

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<{ deal_id?: string }>
}) {
  const { deal_id } = await searchParams

  let deals: { id: string; company: { name: string; cif?: string; address?: string } }[] = []
  try {
    const user = await getCurrentUser()
    const allDeals = await getDeals(user ?? undefined)
    deals = allDeals.map((d) => ({
      id: d.id,
      company: { name: d.company.name, cif: d.company.cif, address: d.company.address },
    }))
  } catch {
    // non-critical — form still works without deal autocomplete
  }

  // Pre-populate from deal_id if provided
  const preselectedDeal = deal_id ? deals.find((d) => d.id === deal_id) : undefined

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Nueva factura</h1>
        <p className="text-text-tertiary text-[13px] mt-0.5">El número se genera automáticamente al guardar.</p>
      </div>
      <NewInvoiceForm
        deals={deals}
        initialDealId={preselectedDeal?.id}
        initialClientName={preselectedDeal?.company.name}
        initialClientCif={preselectedDeal?.company.cif}
        initialClientAddress={preselectedDeal?.company.address}
      />
    </div>
  )
}
