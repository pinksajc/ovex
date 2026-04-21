import { getInvoices } from '@/lib/supabase/invoices'
import { getPresupuestos } from '@/lib/supabase/presupuestos'
import { FacturasContent } from '@/components/facturas/facturas-content'
import type { Invoice, Presupuesto } from '@/types'

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  let invoices: Invoice[] = []
  let invoiceFetchError = false
  let ofertas: Presupuesto[] = []
  let ofertaFetchError = false

  try {
    invoices = await getInvoices()
  } catch {
    invoiceFetchError = true
  }

  try {
    ofertas = await getPresupuestos()
  } catch {
    ofertaFetchError = true
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <FacturasContent
        invoices={invoices}
        ofertas={ofertas}
        invoiceFetchError={invoiceFetchError}
        ofertaFetchError={ofertaFetchError}
        initialTab={tab}
      />
    </div>
  )
}
