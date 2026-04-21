import { notFound } from 'next/navigation'
import { getPresupuesto } from '@/lib/supabase/presupuestos'
import { getDeals } from '@/lib/deals'
import { EditOfertaForm } from './form'

export default async function EditarOfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const presupuesto = await getPresupuesto(id).catch(() => null)
  if (!presupuesto) notFound()

  let deals: { id: string; company: { name: string; cif?: string; address?: string } }[] = []
  try {
    const allDeals = await getDeals()
    deals = allDeals.map((d) => ({
      id: d.id,
      company: { name: d.company.name, cif: d.company.cif, address: d.company.address },
    }))
  } catch { /* non-critical */ }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
          Editar oferta <span className="font-mono text-zinc-400">{presupuesto.number}</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-1">El número de oferta no cambia.</p>
      </div>
      <EditOfertaForm presupuesto={presupuesto} deals={deals} />
    </div>
  )
}
