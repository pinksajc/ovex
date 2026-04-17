// GET /api/facturas/generate-pdf?id={invoiceId}
// Renders an invoice PDF server-side and returns it as application/pdf.

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { getInvoice } = await import('@/lib/supabase/invoices')
    const invoice = await getInvoice(id)
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const { generateInvoicePdf } = await import('@/lib/pdf/invoice')
    const pdfBuffer = await generateInvoicePdf(invoice)

    const slug = invoice.number.replace(/[^A-Za-z0-9-]/g, '-').toLowerCase()
    const filename = `factura-${slug}.pdf`

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('[facturas/generate-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 }
    )
  }
}
