import fs from 'fs'
import path from 'path'
import { renderHtmlToPdf } from './generate'
import type { Invoice, InvoiceStatus } from '@/types'
import type { InvoicePayment } from '@/lib/supabase/invoice-payments'

function readLogoDataUri(): string {
  for (const { file, mime } of [
    { file: 'logo_platomico.png', mime: 'image/png' },
    { file: 'logo_platomico.svg', mime: 'image/svg+xml' },
  ]) {
    try {
      const buf = fs.readFileSync(path.join(process.cwd(), 'public', file))
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch { /* continuar */ }
  }
  return ''
}

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Borrador', issued: 'Emitida', paid: 'Pagada', overdue: 'Vencida', converted: 'Convertida',
}
const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: '#71717a', issued: '#2563eb', paid: '#059669', overdue: '#dc2626', converted: '#a1a1aa',
}
const TYPE_LABELS: Record<string, string> = {
  ordinary: 'Factura', proforma: 'Proforma', rectificativa: 'Rectificativa',
}

export interface InvoiceReportInput {
  invoices: Invoice[]
  paymentsByInvoice: Record<string, InvoicePayment[]>
  generatedAt: string
}

export async function generateInvoiceReportPdf(input: InvoiceReportInput): Promise<Buffer> {
  const logoUri = readLogoDataUri()
  const html = buildReportHtml(input, logoUri)
  return renderHtmlToPdf(html)
}

function buildReportHtml(input: InvoiceReportInput, logoUri: string): string {
  const { invoices, paymentsByInvoice, generatedAt } = input

  // ── Separate ordinary/rectificativa from proformas ───────────────────────
  const ordinaryInvoices = invoices.filter((i) => i.type !== 'proforma')
  const proformaInvoices = invoices.filter((i) => i.type === 'proforma')

  // ── Summary numbers (ordinary + rectificativa only) ──────────────────────
  const totalBilled    = ordinaryInvoices.reduce((s, i) => s + i.amountTotal, 0)
  const totalPaidFull  = ordinaryInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amountTotal, 0)
  const totalPartialPayments = Object.values(paymentsByInvoice).flat().reduce((s, p) => s + p.amount, 0)
  const totalCollected = totalPaidFull + Object.entries(paymentsByInvoice)
    .filter(([id]) => {
      const inv = ordinaryInvoices.find((i) => i.id === id)
      return inv && inv.status !== 'paid'
    })
    .reduce((s, [, ps]) => s + ps.reduce((ss, p) => ss + p.amount, 0), 0)

  const totalOverdue   = ordinaryInvoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amountTotal, 0)
  const totalIssued    = ordinaryInvoices.filter((i) => i.status === 'issued').reduce((s, i) => s + i.amountTotal, 0)
  const totalDraft     = ordinaryInvoices.filter((i) => i.status === 'draft').reduce((s, i) => s + i.amountTotal, 0)

  // Partially paid = has payments but status != 'paid'
  const partiallyPaid = ordinaryInvoices.filter((inv) => {
    const ps = paymentsByInvoice[inv.id] ?? []
    const paid = ps.reduce((s, p) => s + p.amount, 0)
    return paid > 0 && inv.status !== 'paid'
  })

  const totalPending = totalIssued + totalOverdue

  const countByStatus = (s: InvoiceStatus) => ordinaryInvoices.filter((i) => i.status === s).length

  // ── Proforma metrics ─────────────────────────────────────────────────────
  const proformaTotal      = proformaInvoices.reduce((s, i) => s + i.amountTotal, 0)
  const proformaPending    = proformaInvoices.filter((i) => i.status !== 'converted').reduce((s, i) => s + i.amountTotal, 0)
  const proformaConverted  = proformaInvoices.filter((i) => i.status === 'converted')
  const proformaConvRate   = proformaInvoices.length > 0
    ? ((proformaConverted.length / proformaInvoices.length) * 100).toFixed(0)
    : '0'

  const imgOrText = logoUri
    ? `<img src="${logoUri}" style="height:22px;width:auto;display:block;" alt="Orvex"/>`
    : `<span style="font-size:15px;font-weight:800;color:#0f172a;">Orvex</span>`

  const header = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;margin-bottom:16px;border-bottom:1px solid #dde6f0;">
      ${imgOrText}
      <span style="font-size:9px;color:#94a3b8;">Informe de Facturación · ${generatedAt}</span>
    </div>`

  function pg(content: string, last = false): string {
    return `<div style="${last ? '' : 'break-after:page;'}position:relative;min-height:220mm;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#0f172a;">
      <div style="position:relative;">${header}${content}</div>
    </div>`
  }

  // ── Page 1: Executive summary ────────────────────────────────────────────
  const kpiCard = (label: string, value: string, sub: string, color = '#0f172a') => `
    <div style="border:1px solid #e8eef6;border-radius:10px;padding:14px 16px;background:#fff;">
      <div style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${label}</div>
      <div style="font-size:20px;font-weight:800;color:${color};font-family:'Courier New',monospace;line-height:1.1;">${value}</div>
      <div style="font-size:9px;color:#64748b;margin-top:4px;">${sub}</div>
    </div>`

  const statusRow = (status: InvoiceStatus, total: number) => {
    const count = countByStatus(status)
    if (count === 0 && total === 0) return ''
    const pct = totalBilled > 0 ? (total / totalBilled) * 100 : 0
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
        <div style="width:10px;height:10px;border-radius:50%;background:${STATUS_COLOR[status]};flex-shrink:0;"></div>
        <span style="font-size:10px;color:#334155;flex:1;">${STATUS_LABELS[status]}</span>
        <span style="font-size:9px;color:#94a3b8;width:30px;text-align:right;">${count}</span>
        <div style="width:100px;height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
          <div style="height:100%;background:${STATUS_COLOR[status]};width:${pct.toFixed(1)}%;border-radius:3px;"></div>
        </div>
        <span style="font-size:10px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;width:90px;text-align:right;">${eur(total)}</span>
      </div>`
  }

  const p1 = pg(`
    <div style="margin-bottom:20px;">
      <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;margin-bottom:4px;">Informe de Facturación</div>
      <div style="font-size:10px;color:#64748b;">${invoices.length} documentos (${ordinaryInvoices.length} facturas · ${proformaInvoices.length} proformas) · Generado el ${generatedAt}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
      ${kpiCard('Total facturado', eur(totalBilled), `${ordinaryInvoices.length} facturas (excl. proformas)`)}
      ${kpiCard('Total cobrado', eur(totalCollected), 'Pagadas + pagos parciales', '#059669')}
      ${kpiCard('Pendiente de cobro', eur(totalPending), `${countByStatus('issued') + countByStatus('overdue')} facturas`, '#2563eb')}
      ${kpiCard('Vencido (sin pagar)', eur(totalOverdue), `${countByStatus('overdue')} facturas vencidas`, '#dc2626')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="background:#fff;border:1px solid #e8eef6;border-radius:10px;padding:16px;">
        <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Facturas — desglose por estado</div>
        ${statusRow('paid', totalPaidFull)}
        ${statusRow('issued', totalIssued)}
        ${statusRow('overdue', totalOverdue)}
        ${statusRow('draft', totalDraft)}
        ${statusRow('converted', ordinaryInvoices.filter((i) => i.status === 'converted').reduce((s, i) => s + i.amountTotal, 0))}
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e8eef6;display:flex;justify-content:space-between;">
          <span style="font-size:9px;font-weight:700;color:#64748b;">Tasa de cobro</span>
          <span style="font-size:9px;font-weight:800;color:#059669;">${totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : 0}%</span>
        </div>
      </div>

      <div style="background:#fff;border:1px solid #e8eef6;border-radius:10px;padding:16px;">
        <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Cobros parciales</div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:10px;color:#64748b;">Con pago parcial</span>
          <span style="font-size:10px;font-weight:700;color:#0f172a;">${partiallyPaid.length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:10px;color:#64748b;">Total cobrado</span>
          <span style="font-size:10px;font-weight:700;color:#059669;font-family:'Courier New',monospace;">${eur(totalPartialPayments)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:10px;color:#64748b;">Pendiente</span>
          <span style="font-size:10px;font-weight:700;color:#dc2626;font-family:'Courier New',monospace;">${eur(
            partiallyPaid.reduce((s, inv) => {
              const paid = (paymentsByInvoice[inv.id] ?? []).reduce((ss, p) => ss + p.amount, 0)
              return s + (inv.amountTotal - paid)
            }, 0)
          )}</span>
        </div>
      </div>

      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:16px;">
        <div style="font-size:9px;font-weight:700;color:#5b21b6;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Proformas</div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #ede9fe;">
          <span style="font-size:10px;color:#64748b;">Total emitidas</span>
          <span style="font-size:10px;font-weight:700;color:#0f172a;">${proformaInvoices.length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #ede9fe;">
          <span style="font-size:10px;color:#64748b;">Convertidas a factura</span>
          <span style="font-size:10px;font-weight:700;color:#059669;">${proformaConverted.length} (${proformaConvRate}%)</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #ede9fe;">
          <span style="font-size:10px;color:#64748b;">Pendientes conversión</span>
          <span style="font-size:10px;font-weight:700;color:#7c3aed;">${proformaInvoices.length - proformaConverted.length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #ede9fe;">
          <span style="font-size:10px;color:#64748b;">Valor total</span>
          <span style="font-size:10px;font-weight:700;font-family:'Courier New',monospace;color:#5b21b6;">${eur(proformaTotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;">
          <span style="font-size:10px;color:#64748b;">Valor pendiente</span>
          <span style="font-size:10px;font-weight:700;font-family:'Courier New',monospace;color:#7c3aed;">${eur(proformaPending)}</span>
        </div>
      </div>
    </div>
  `)

  // ── Page 2: Partial payments detail ─────────────────────────────────────
  const partialRows = partiallyPaid.map((inv) => {
    const ps = paymentsByInvoice[inv.id] ?? []
    const totalPaidInv = ps.reduce((s, p) => s + p.amount, 0)
    const remaining = inv.amountTotal - totalPaidInv
    const pct = inv.amountTotal > 0 ? (totalPaidInv / inv.amountTotal) * 100 : 0

    const paymentRows = ps.map((p) => `
      <div style="display:flex;gap:8px;margin-left:16px;font-size:8.5px;color:#64748b;padding:2px 0;">
        <span style="color:#059669;font-weight:600;">${eur(p.amount)}</span>
        <span>${fmtDate(p.paidAt)}</span>
        ${p.notes ? `<span>· ${p.notes}</span>` : ''}
      </div>`).join('')

    return `
      <div style="border:1px solid #e8eef6;border-radius:8px;padding:12px 14px;margin-bottom:8px;background:#fff;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <div>
            <span style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;color:#0f172a;">${inv.number}</span>
            <span style="margin-left:8px;font-size:9px;color:#94a3b8;">${TYPE_LABELS[inv.type] ?? inv.type}</span>
            <span style="margin-left:4px;display:inline-block;background:${STATUS_COLOR[inv.status]}20;color:${STATUS_COLOR[inv.status]};font-size:8px;font-weight:700;text-transform:uppercase;padding:1px 6px;border-radius:10px;">${STATUS_LABELS[inv.status]}</span>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:12px;font-weight:800;font-family:'Courier New',monospace;color:#0f172a;">${eur(inv.amountTotal)}</div>
            <div style="font-size:8px;color:#94a3b8;">${fmtDate(inv.issuedAt)}</div>
          </div>
        </div>
        <div style="font-size:10px;color:#334155;margin-bottom:8px;">${inv.clientName}${inv.clientCif ? ` · ${inv.clientCif}` : ''}</div>

        <div style="height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;margin-bottom:6px;">
          <div style="height:100%;background:#059669;width:${pct.toFixed(1)}%;border-radius:3px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#64748b;margin-bottom:8px;">
          <span>Cobrado: <strong style="color:#059669;font-family:'Courier New',monospace;">${eur(totalPaidInv)}</strong></span>
          <span>Pendiente: <strong style="color:#dc2626;font-family:'Courier New',monospace;">${eur(remaining)}</strong></span>
          <span>${pct.toFixed(0)}%</span>
        </div>

        <div style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Pagos registrados</div>
        ${paymentRows || '<div style="font-size:8.5px;color:#d1d5db;margin-left:16px;">Sin pagos</div>'}
      </div>`
  }).join('')

  const p2 = pg(`
    <div style="margin-bottom:16px;">
      <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:4px;">Facturas con pago parcial</div>
      <div style="font-size:10px;color:#64748b;">${partiallyPaid.length} factura${partiallyPaid.length !== 1 ? 's' : ''} con cobros parciales registrados</div>
    </div>
    ${partiallyPaid.length === 0
      ? '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:11px;">No hay facturas con pagos parciales</div>'
      : partialRows
    }
  `)

  // ── Page 3: Full invoice listing ─────────────────────────────────────────
  const TABLE_HEAD = `
    <thead>
      <tr style="background:#f8fafc;border-bottom:2px solid #e8eef6;">
        <th style="padding:6px 8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Número</th>
        <th style="padding:6px 8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Cliente</th>
        <th style="padding:6px 8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Emisión</th>
        <th style="padding:6px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Total</th>
        <th style="padding:6px 8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Estado</th>
        <th style="padding:6px 8px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Cobrado</th>
      </tr>
    </thead>`

  const invoiceRow = (inv: Invoice) => {
    const ps = paymentsByInvoice[inv.id] ?? []
    const paid = ps.reduce((s, p) => s + p.amount, 0)
    const isPartial = paid > 0 && inv.status !== 'paid'
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:5px 8px;font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#0f172a;white-space:nowrap;">${inv.number}</td>
        <td style="padding:5px 8px;font-size:9px;color:#334155;">${inv.clientName}</td>
        <td style="padding:5px 8px;font-size:9px;color:#64748b;white-space:nowrap;">${fmtDate(inv.issuedAt)}</td>
        <td style="padding:5px 8px;text-align:right;font-size:9px;font-family:'Courier New',monospace;font-weight:600;color:#0f172a;white-space:nowrap;">${eur(inv.amountTotal)}</td>
        <td style="padding:5px 8px;white-space:nowrap;">
          <span style="display:inline-block;background:${STATUS_COLOR[inv.status]}18;color:${STATUS_COLOR[inv.status]};font-size:7.5px;font-weight:700;text-transform:uppercase;padding:1px 6px;border-radius:10px;">${STATUS_LABELS[inv.status]}</span>
          ${isPartial ? `<span style="display:inline-block;background:#fef3c7;color:#b45309;font-size:7px;font-weight:700;text-transform:uppercase;padding:1px 5px;border-radius:10px;margin-left:2px;">Parcial</span>` : ''}
        </td>
        <td style="padding:5px 8px;text-align:right;font-size:9px;font-family:'Courier New',monospace;color:${paid > 0 ? '#059669' : '#d1d5db'};white-space:nowrap;">${paid > 0 ? eur(paid) : '—'}</td>
      </tr>`
  }

  const ordinaryRows = ordinaryInvoices.map(invoiceRow).join('')
  const proformaRows = proformaInvoices.map(invoiceRow).join('')

  const p3 = pg(`
    <div style="margin-bottom:14px;">
      <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:4px;">Listado completo</div>
      <div style="font-size:10px;color:#64748b;">${invoices.length} documentos totales</div>
    </div>

    <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
      Facturas ordinarias y rectificativas (${ordinaryInvoices.length})
    </div>
    <table style="width:100%;border-collapse:collapse;font-family:Helvetica,sans-serif;margin-bottom:20px;">
      ${TABLE_HEAD}
      <tbody>${ordinaryRows}</tbody>
    </table>

    <div style="font-size:9px;font-weight:700;color:#5b21b6;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
      Facturas proforma (${proformaInvoices.length})
    </div>
    <table style="width:100%;border-collapse:collapse;font-family:Helvetica,sans-serif;">
      ${TABLE_HEAD}
      <tbody>${proformaRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#94a3b8;font-size:9px;">Sin proformas</td></tr>'}</tbody>
    </table>
  `, true)

  const styles = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 11px; line-height: 1.5; color: #0f172a; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><style>${styles}</style></head>
<body>
${p1}
${p2}
${p3}
</body>
</html>`
}
