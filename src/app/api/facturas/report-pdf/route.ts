// GET /api/facturas/report-pdf
// Generates a CEO invoice report PDF with summary + partial payments + full listing.

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { getInvoices } = await import('@/lib/supabase/invoices')
    const { getPaymentsByInvoice } = await import('@/lib/supabase/invoice-payments')
    const { generateInvoiceReportPdf } = await import('@/lib/pdf/invoice-report')

    const invoices = await getInvoices()

    // Fetch payments for all invoices in parallel (only those with payments)
    const paymentsByInvoice: Record<string, import('@/lib/supabase/invoice-payments').InvoicePayment[]> = {}
    await Promise.all(
      invoices.map(async (inv) => {
        const ps = await getPaymentsByInvoice(inv.id)
        if (ps.length > 0) paymentsByInvoice[inv.id] = ps
      })
    )

    const generatedAt = new Date().toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    const pdfBuffer = await generateInvoiceReportPdf({ invoices, paymentsByInvoice, generatedAt })

    const today = new Date().toISOString().slice(0, 10)
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="informe-facturas-${today}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[report-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando informe' },
      { status: 500 },
    )
  }
}
