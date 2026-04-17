import { notFound } from 'next/navigation'
import { getInvoice } from '@/lib/supabase/invoices'
import { getDeals } from '@/lib/deals'
import { EditInvoiceForm } from './form'

export default async function EditarFacturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id).catch(() => null)
  if (!invoice) notFound()

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
          Editar factura <span className="font-mono text-zinc-400">{invoice.number}</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-1">El número de factura no cambia.</p>
      </div>
      <EditInvoiceForm invoice={invoice} deals={deals} />
    </div>
  )
}
