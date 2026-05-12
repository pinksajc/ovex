import { getInvoices } from '@/lib/supabase/invoices'
import { FacturasContent } from '@/components/facturas/facturas-content'
import type { Invoice } from '@/types'

export default async function FacturasPage() {
  let invoices: Invoice[] = []
  let invoiceFetchError: string | null = null

  try {
    invoices = await getInvoices()
  } catch (err) {
    invoiceFetchError = err instanceof Error ? err.message : 'Error desconocido'
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <FacturasContent
        invoices={invoices}
        invoiceFetchError={invoiceFetchError}
      />
    </div>
  )
}
