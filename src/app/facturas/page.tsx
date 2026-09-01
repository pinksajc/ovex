import { getInvoices } from '@/lib/supabase/invoices'
import { getPaymentTotals } from '@/lib/supabase/invoice-payments'
import { FacturasContent } from '@/components/facturas/facturas-content'
import type { Invoice } from '@/types'

export default async function FacturasPage() {
  let invoices: Invoice[] = []
  let invoiceFetchError: string | null = null
  let paymentTotals: Record<string, number> = {}

  try {
    ;[invoices, paymentTotals] = await Promise.all([
      getInvoices(),
      getPaymentTotals(),
    ])
  } catch (err) {
    invoiceFetchError = err instanceof Error ? err.message : 'Error desconocido'
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <FacturasContent
        invoices={invoices}
        invoiceFetchError={invoiceFetchError}
        paymentTotals={paymentTotals}
      />
    </div>
  )
}
