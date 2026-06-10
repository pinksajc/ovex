import { getInvoices } from '@/lib/supabase/invoices'
import { getPresupuestos } from '@/lib/supabase/presupuestos'
import { FacturasContent } from '@/components/facturas/facturas-content'
import type { Invoice, Presupuesto } from '@/types'

export default async function FacturasPage() {
  let invoices: Invoice[] = []
  let invoiceFetchError: string | null = null
  let ofertas: Presupuesto[] = []
  let ofertaFetchError: string | null = null

  try {
    invoices = await getInvoices()
  } catch (err) {
    invoiceFetchError = err instanceof Error ? err.message : 'Error desconocido'
  }

  try {
    ofertas = await getPresupuestos()
  } catch (err) {
    ofertaFetchError = err instanceof Error ? err.message : 'Error desconocido'
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <FacturasContent
        invoices={invoices}
        ofertas={ofertas}
        invoiceFetchError={invoiceFetchError}
        ofertaFetchError={ofertaFetchError}
      />
    </div>
  )
}
