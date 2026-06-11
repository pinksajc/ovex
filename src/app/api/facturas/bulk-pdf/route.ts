// GET /api/facturas/bulk-pdf?ids=id1,id2,id3
// Generates PDFs for the given invoice IDs, bundles them in a ZIP, and returns it.

import JSZip from 'jszip'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

const MAX_IDS = 50

function slugify(s: string, maxLen = 40) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/[^A-Za-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, maxLen)
}

export async function GET(req: Request) {
  try {
    // Auth guard
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const idsParam = searchParams.get('ids')
    if (!idsParam) {
      return NextResponse.json({ error: 'ids is required' }, { status: 400 })
    }

    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS)
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid ids provided' }, { status: 400 })
    }

    const { getInvoice } = await import('@/lib/supabase/invoices')
    const { generateInvoicePdf } = await import('@/lib/pdf/invoice')

    const zip = new JSZip()

    for (const id of ids) {
      let invoice
      try {
        invoice = await getInvoice(id)
      } catch {
        continue
      }
      if (!invoice) continue

      const pdfBuffer = await generateInvoicePdf(invoice)

      // Build filename: F-2026-0001-NombreCliente.pdf
      const numberSlug = invoice.number.replace(/[^A-Za-z0-9-]/g, '-')
      const clientSlug = slugify(invoice.clientName, 35)
      const filename = `${numberSlug}-${clientSlug}.pdf`

      zip.file(filename, pdfBuffer)
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const today = new Date().toISOString().slice(0, 10)

    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="facturas-orvex-${today}.zip"`,
        'Content-Length': String(zipBuffer.length),
      },
    })
  } catch (err) {
    console.error('[facturas/bulk-pdf]', err)
    return NextResponse.json({ error: 'Error generando PDFs' }, { status: 500 })
  }
}
