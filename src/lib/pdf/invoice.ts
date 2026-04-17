// =========================================
// INVOICE PDF GENERATOR — Factura Legal Española
// server-only
// =========================================

import fs from 'fs'
import path from 'path'
import type { Invoice, InvoiceLineItem } from '@/types'
import { renderHtmlToPdf } from './generate'

// ---- Logo ----
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

// ---- Formatting helpers ----
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br/>')
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ---- Line items rendering ----
function renderLineRows(items: InvoiceLineItem[]): string {
  if (!items || items.length === 0) return ''
  return items.map((item) => {
    if (item.type === 'discount') {
      const modeLabel = item.discountMode === 'percent'
        ? `${fmt(item.discountValue ?? 0)}%`
        : `${fmt(item.discountValue ?? 0)} €`
      return `
        <tr class="discount-row">
          <td style="color:#dc2626;">${esc(item.description || 'Descuento')} <span style="color:#fca5a5;font-size:8px;">(${modeLabel})</span></td>
          <td class="right">—</td>
          <td class="right">—</td>
          <td class="right" style="color:#dc2626;font-weight:700;">${fmt(item.amount)} €</td>
        </tr>`
    }
    return `
      <tr>
        <td>
          ${esc(item.description || '—')}
          ${item.period ? `<div style="font-size:8px;color:#94a3b8;margin-top:2px;">${esc(item.period)}</div>` : ''}
        </td>
        <td class="right">${fmt(item.quantity)}</td>
        <td class="right">${fmt(item.unitPrice)} €</td>
        <td class="right" style="font-weight:600;">${fmt(item.amount)} €</td>
      </tr>`
  }).join('')
}

// ---- Invoice HTML ----
export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const logo = readLogoDataUri()
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const items = invoice.lineItems ?? []
  const regularItems = items.filter((i) => i.type === 'line')
  const discountItems = items.filter((i) => i.type === 'discount')
  const subtotal = regularItems.reduce((s, i) => s + i.amount, 0)
  const discountTotal = discountItems.reduce((s, i) => s + i.amount, 0)
  const base = invoice.amountNet  // stored as base imponible
  const vatAmount = base * (invoice.vatRate / 100)

  // Fall back to single-row if no line items stored (legacy invoices)
  const hasLineItems = items.length > 0

  const invoiceTypeLabel = invoice.type === 'rectificativa' ? 'Factura Rectificativa' : 'Factura'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10px;
    color: #1e293b;
    background: #fff;
    padding: 40px 50px;
  }
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 36px;
    padding-bottom: 24px;
    border-bottom: 2px solid #1e3a5f;
  }
  .logo { height: 22px; object-fit: contain; }
  .invoice-type-badge {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #94a3b8;
    margin-bottom: 4px;
  }
  .invoice-number {
    font-size: 22px;
    font-weight: 700;
    color: #1e3a5f;
    font-family: Courier New, monospace;
  }
  .issuer-block {
    font-size: 9px;
    color: #475569;
    line-height: 1.6;
    text-align: left;
  }
  .issuer-block strong {
    font-size: 11px;
    color: #1e3a5f;
    display: block;
    margin-bottom: 2px;
  }
  .meta-row {
    display: flex;
    gap: 32px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }
  .meta-item { min-width: 120px; }
  .meta-label {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
    margin-bottom: 3px;
  }
  .meta-value {
    font-size: 10px;
    font-weight: 600;
    color: #1e293b;
  }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 32px;
  }
  .party-block {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px 16px;
  }
  .party-title {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
    margin-bottom: 6px;
  }
  .party-name {
    font-size: 11px;
    font-weight: 700;
    color: #1e3a5f;
    margin-bottom: 3px;
  }
  .party-detail {
    font-size: 9px;
    color: #64748b;
    line-height: 1.5;
  }
  table.concept-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }
  table.concept-table thead tr {
    background: #1e3a5f;
    color: #fff;
  }
  table.concept-table thead th {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    padding: 8px 10px;
    text-align: left;
  }
  table.concept-table thead th.right { text-align: right; }
  table.concept-table tbody tr {
    border-bottom: 1px solid #f1f5f9;
  }
  table.concept-table tbody tr.discount-row {
    background: #fff5f5;
    border-bottom: 1px solid #fee2e2;
  }
  table.concept-table tbody td {
    font-size: 10px;
    padding: 9px 10px;
    color: #334155;
  }
  table.concept-table tbody td.right {
    text-align: right;
    font-family: Courier New, monospace;
  }
  .totals-box {
    margin-left: auto;
    width: 300px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 40px;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 14px;
    font-size: 10px;
    border-bottom: 1px solid #f1f5f9;
  }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.total-final {
    background: #1e3a5f;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    padding: 12px 14px;
  }
  .totals-row .label { color: #64748b; }
  .totals-row.discount .label { color: #dc2626; }
  .totals-row.discount .amount { color: #dc2626; font-weight: 700; }
  .totals-row.total-final .label { color: #cbd5e1; font-size: 9px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.8px; }
  .totals-row .amount { font-family: Courier New, monospace; font-weight: 600; }
  .footer-legal {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 8px;
    color: #94a3b8;
    text-align: center;
    line-height: 1.6;
  }
  .rect-notice {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 20px;
    font-size: 9px;
    color: #92400e;
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div>
    ${logo ? `<img class="logo" src="${logo}" alt="Platomico"/>` : '<span style="font-size:16px;font-weight:700;color:#1e3a5f;">Platomico</span>'}
    <div class="issuer-block" style="margin-top:10px;">
      <strong>Platomico, S.L.</strong>
      NIF: B22741094<br/>
      C/ Antonio Machado 9, Rozas de Puerto Real<br/>
      Madrid 28649<br/>
      hola@platomico.com
    </div>
  </div>
  <div style="text-align:right;">
    <div class="invoice-type-badge">${invoiceTypeLabel}</div>
    <div class="invoice-number">${esc(invoice.number)}</div>
  </div>
</div>

<!-- Meta -->
<div class="meta-row">
  <div class="meta-item">
    <div class="meta-label">Fecha de emisión</div>
    <div class="meta-value">${fmtDate(invoice.issuedAt)}</div>
  </div>
  <div class="meta-item">
    <div class="meta-label">Fecha de vencimiento</div>
    <div class="meta-value">${fmtDate(invoice.dueAt)}</div>
  </div>
  <div class="meta-item">
    <div class="meta-label">Número</div>
    <div class="meta-value" style="font-family:Courier New,monospace;">${esc(invoice.number)}</div>
  </div>
</div>

${invoice.type === 'rectificativa' && invoice.rectifiesId ? `
<div class="rect-notice">
  ⚠️ Esta es una factura rectificativa. Rectifica la factura con referencia: <strong>${esc(invoice.rectifiesId)}</strong>
</div>` : ''}

<!-- Parties -->
<div class="parties">
  <div class="party-block">
    <div class="party-title">Emisor</div>
    <div class="party-name">Platomico, S.L.</div>
    <div class="party-detail">
      NIF: B22741094<br/>
      C/ Antonio Machado 9<br/>
      Rozas de Puerto Real, Madrid 28649
    </div>
  </div>
  <div class="party-block">
    <div class="party-title">Destinatario</div>
    <div class="party-name">${esc(invoice.clientName)}</div>
    <div class="party-detail">
      ${invoice.clientCif ? `NIF/CIF: ${esc(invoice.clientCif)}<br/>` : ''}
      ${invoice.clientAddress ? esc(invoice.clientAddress) : ''}
    </div>
  </div>
</div>

<!-- Line items table -->
<table class="concept-table">
  <thead>
    <tr>
      <th>Descripción</th>
      <th class="right" style="width:70px;">Cantidad</th>
      <th class="right" style="width:110px;">Precio unit.</th>
      <th class="right" style="width:110px;">Importe</th>
    </tr>
  </thead>
  <tbody>
    ${hasLineItems
      ? renderLineRows(items)
      : `<tr>
          <td>${esc(invoice.concept || '—')}</td>
          <td class="right">1</td>
          <td class="right">${fmt(invoice.amountNet)} €</td>
          <td class="right" style="font-weight:600;">${fmt(invoice.amountNet)} €</td>
        </tr>`
    }
  </tbody>
</table>

<!-- Totals box -->
<div class="totals-box">
  ${hasLineItems && discountItems.length > 0 ? `
  <div class="totals-row">
    <span class="label">Subtotal</span>
    <span class="amount">${fmt(subtotal)} €</span>
  </div>
  <div class="totals-row discount">
    <span class="label">Descuentos</span>
    <span class="amount">${fmt(discountTotal)} €</span>
  </div>` : ''}
  <div class="totals-row">
    <span class="label">Base imponible</span>
    <span class="amount">${fmt(base)} €</span>
  </div>
  <div class="totals-row">
    <span class="label">IVA (${fmt(invoice.vatRate)}%)</span>
    <span class="amount">${fmt(vatAmount)} €</span>
  </div>
  <div class="totals-row total-final">
    <span class="label">Total factura</span>
    <span class="amount" style="font-size:14px;">${fmt(invoice.amountTotal)} €</span>
  </div>
</div>

<!-- Legal footer -->
<div class="footer-legal">
  Esta factura cumple con los requisitos del Real Decreto 1619/2012, de 30 de noviembre, por el que se aprueba el Reglamento por el que se regulan las obligaciones de facturación.<br/>
  Platomico, S.L. · NIF B22741094 · Registrada en el Registro Mercantil · hola@platomico.com<br/>
  Documento generado el ${today}
</div>

</body>
</html>`

  return renderHtmlToPdf(html)
}
