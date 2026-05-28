// GET /api/cashflow/report/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
// Generates a 2-page executive cashflow report PDF.

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    // ── Auth guard ────────────────────────────────────────────────────────────
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // ── Parse params ──────────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('from')
    const dateTo   = searchParams.get('to')

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Params from y to son obligatorios' }, { status: 400 })
    }

    // ── Fetch data ────────────────────────────────────────────────────────────
    const { getCashflowTransactions } = await import('@/lib/supabase/cashflow')
    const { getInvoices }             = await import('@/lib/supabase/invoices')

    const [allTransactions, allInvoices] = await Promise.all([
      getCashflowTransactions(),
      getInvoices(),
    ])

    // Filter transactions to the requested date range
    const transactions = allTransactions.filter(
      t => t.date >= dateFrom && t.date <= dateTo,
    )

    // ── Generate PDF ──────────────────────────────────────────────────────────
    const { generateCashflowReportPdf } = await import('@/lib/pdf/cashflow-report')
    const pdfBuffer = await generateCashflowReportPdf({
      transactions,
      invoices: allInvoices,
      dateFrom,
      dateTo,
    })

    const filename = `informe-cashflow-${dateFrom}-${dateTo}.pdf`

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('[cashflow/report/pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al generar PDF' },
      { status: 500 },
    )
  }
}
