// =========================================
// INVOICE PDF GENERATOR — Factura Legal Española
// server-only
// =========================================

import fs from 'fs'
import path from 'path'
import type { Invoice, InvoiceLineItem } from '@/types'
import { renderHtmlToPdf } from './generate'
import { getInvoiceNumberById } from '@/lib/supabase/invoices'

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

// ---- Line items rendering (4 or 6 columns depending on hasDiscount) ----
function renderLineRows(items: InvoiceLineItem[], hasDiscount: boolean): string {
  if (!items || items.length === 0) return ''

  const totalCols = hasDiscount ? 6 : 4
  const hasGroups = items.some((i) => i.locationGroupId)

  function itemRow(item: InvoiceLineItem): string {
    if (item.type === 'discount') {
      return `
        <tr class="discount-row">
          <td colspan="4" style="color:#dc2626;">${esc(item.description || 'Descuento')}</td>
          <td class="right" style="color:#dc2626;">—</td>
          <td class="right" style="color:#dc2626;font-weight:700;">${fmt(item.amount)} €</td>
        </tr>`
    }
    const dto = item.lineDiscountPercent ?? 0
    const gross = item.quantity * item.unitPrice
    const net = item.amount
    if (hasDiscount) {
      return `
        <tr>
          <td>
            ${esc(item.description || '—')}
            ${item.period ? `<div style="font-size:8px;color:#94a3b8;margin-top:2px;">${esc(item.period)}</div>` : ''}
            ${dto > 0 && item.discountName ? `<div style="font-size:8px;color:#10b981;margin-top:2px;font-weight:600;">${esc(item.discountName)}</div>` : ''}
          </td>
          <td class="right">${fmt(item.quantity)}</td>
          <td class="right">${fmt(item.unitPrice)} €</td>
          <td class="right">${dto > 0 ? `${fmt(dto)}%` : '—'}</td>
          <td class="right">${fmt(gross)} €</td>
          <td class="right" style="font-weight:600;">${dto > 0 ? `${fmt(net)} €` : '—'}</td>
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
        <td class="right" style="font-weight:600;">${fmt(net)} €</td>
      </tr>`
  }

  if (!hasGroups) {
    // Flat — single tbody, no grouping needed
    return items.map(itemRow).join('')
  }

  // Grouped — one <tbody> per location group with break-inside: avoid
  // This keeps the header row + its data rows on the same page in Chromium.
  const seen = new Set<string>()
  const groupIds: Array<string> = []
  for (const item of items) {
    const gid = item.locationGroupId ?? '__ungrouped__'
    if (!seen.has(gid)) { seen.add(gid); groupIds.push(gid) }
  }

  const tbodies: string[] = []
  // Close the outer tbody opened in the template, emit per-group tbodies, then reopen
  tbodies.push('</tbody>')

  for (const gid of groupIds) {
    const groupItems = items.filter((i) => (i.locationGroupId ?? '__ungrouped__') === gid)
    const name = groupItems[0]?.locationGroupName ?? (gid !== '__ungrouped__' ? gid : 'General')
    const addr = groupItems[0]?.locationGroupAddress

    const headerRow = gid !== '__ungrouped__'
      ? `<tr class="location-group-header">
          <td colspan="${totalCols}">
            <span style="font-weight:700;font-size:9px;letter-spacing:0.5px;">${esc(name)}</span>
            ${addr ? `<span style="font-size:8px;color:#94a3b8;margin-left:8px;">${esc(addr)}</span>` : ''}
          </td>
        </tr>`
      : `<tr class="location-group-header">
          <td colspan="${totalCols}" style="font-size:8px;color:#94a3b8;font-style:italic;">General</td>
        </tr>`

    tbodies.push(`<tbody style="break-inside:avoid;">
      ${headerRow}
      ${groupItems.map(itemRow).join('')}
    </tbody>`)
  }

  // Reopen a dummy tbody so the closing </tbody> in the template is valid
  tbodies.push('<tbody>')
  return tbodies.join('')
}

// ---- Invoice HTML ----
export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const logo = readLogoDataUri()

  // Resolve the rectified invoice number for display (rectifiesId is a UUID)
  let rectifiesNumber: string | null = null
  if (invoice.type === 'rectificativa' && invoice.rectifiesId) {
    rectifiesNumber = await getInvoiceNumberById(invoice.rectifiesId).catch(() => null)
    // Fall back to showing the raw value if lookup fails
    if (!rectifiesNumber) rectifiesNumber = invoice.rectifiesId
  }

  const items = invoice.lineItems ?? []
  const regularItems = items.filter((i) => i.type === 'line')
  const discountItems = items.filter((i) => i.type === 'discount')

  // Subtotal = sum of gross (qty × unitPrice) before any discounts
  const subtotalBruto = regularItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  // Total per-line discounts
  const lineDiscountTotal = regularItems.reduce((s, i) => s + (i.quantity * i.unitPrice - i.amount), 0)
  // Global discount rows (negative amounts)
  const globalDiscountTotal = discountItems.reduce((s, i) => s + Math.abs(i.amount), 0)
  const totalDiscounts = lineDiscountTotal + globalDiscountTotal

  const base = invoice.amountNet
  const vatAmount = base * (invoice.vatRate / 100)

  const hasLineItems = items.length > 0
  const hasAnyDiscount = totalDiscounts > 0.001 || discountItems.length > 0

  // For proformas: only show a small "PROFORMA" label in the header, no big number.
  // For invoices/rectificativas: show label + large number as before.
  const isProforma = invoice.type === 'proforma'
  const headerRightHtml = isProforma
    ? `<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">FACTURA PROFORMA</div>`
    : `<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">${
        invoice.type === 'rectificativa' ? 'FACTURA RECTIFICATIVA' : 'FACTURA'
      }</div>
      <div style="font-size:22px;font-weight:700;color:#1e3a5f;font-family:Courier New,monospace;">${esc(invoice.number)}</div>`

  // "Total" label in the totals box
  const totalLabel = isProforma ? 'Total factura proforma' : 'Total factura'

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
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: 2px solid #1e3a5f;
  }
  .logo { height: 22px; object-fit: contain; }
  .meta-row {
    display: flex;
    gap: 32px;
    margin-bottom: 24px;
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
  .parties-row {
    display: flex;
    gap: 40px;
    margin-bottom: 20px;
  }
  .party-col { flex: 1; }
  .party-eyebrow {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
    margin-bottom: 5px;
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
    line-height: 1.6;
  }
  .location-block {
    border-left: 3px solid #1e2d4a;
    padding: 8px 12px;
    background: #f8f9fa;
    margin-bottom: 24px;
  }
  table.concept-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }
  table.concept-table tbody.table-header-row tr {
    background: #1e3a5f;
    color: #fff;
  }
  table.concept-table tbody.table-header-row th {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    padding: 8px 10px;
    text-align: left;
  }
  table.concept-table tbody.table-header-row th.right { text-align: right; }
  table.concept-table tbody tr {
    border-bottom: 1px solid #f1f5f9;
  }
  table.concept-table tbody tr.discount-row {
    background: #fff5f5;
    border-bottom: 1px solid #fee2e2;
  }
  table.concept-table tbody tr.location-group-header td {
    background: #f0f4f8;
    color: #1e3a5f;
    padding: 6px 10px;
    font-size: 9px;
    font-weight: 700;
    border-bottom: 1px solid #dde4ec;
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
    break-inside: avoid;
    break-before: avoid;
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
  .footer-bank {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 8px;
    color: #94a3b8;
    text-align: center;
    line-height: 1.6;
  }
  .rect-notice {
    color: #94a3b8;
    font-size: 11px;
    margin-bottom: 18px;
  }
</style>
</head>
<body>

<!-- Header: logo + company info left / type label (+ number for invoices) right -->
<div class="header">
  <div>
    ${logo ? `<img class="logo" src="${logo}" alt="Platomico"/>` : '<span style="font-size:16px;font-weight:700;color:#1e3a5f;">Platomico</span>'}
  </div>
  <div style="text-align:right;">
    ${headerRightHtml}
  </div>
</div>

<!-- Meta dates -->
<div class="meta-row">
  <div class="meta-item">
    <div class="meta-label">Fecha de emisión</div>
    <div class="meta-value">${fmtDate(invoice.issuedAt)}</div>
  </div>
  ${invoice.dueDateEnabled !== false ? `
  <div class="meta-item">
    <div class="meta-label">Fecha de vencimiento</div>
    <div class="meta-value">${fmtDate(invoice.dueAt)}</div>
  </div>` : ''}
</div>

${rectifiesNumber ? `
<div class="rect-notice">Factura rectificativa de ${esc(rectifiesNumber)}</div>` : ''}

<!-- Emisor + Cliente en dos columnas -->
<div class="parties-row">
  <div class="party-col">
    <div class="party-eyebrow">Emisor</div>
    <div class="party-name">Platomico, S.L.</div>
    <div class="party-detail">
      NIF: B22741094<br/>
      C/ Antonio Machado 9, Rozas de Puerto Real<br/>
      Madrid 28649<br/>
      hola@platomico.com
    </div>
  </div>
  <div class="party-col">
    <div class="party-eyebrow">Cliente</div>
    <div class="party-name">${esc(invoice.clientName)}</div>
    <div class="party-detail">
      ${invoice.clientCif ? `NIF/CIF: ${esc(invoice.clientCif)}<br/>` : ''}
      ${invoice.clientAddress ? esc(invoice.clientAddress) : ''}
    </div>
  </div>
</div>

<!-- Localización destacada (solo si existe) -->
${invoice.locationName ? `
<div class="location-block">
  <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:3px;">Localización</div>
  <div style="font-size:11px;font-weight:700;color:#1e2d4a;">${esc(invoice.locationName)}</div>
  ${invoice.locationAddress ? `<div style="font-size:10px;color:#444;margin-top:2px;">${esc(invoice.locationAddress)}</div>` : ''}
</div>` : ''}

<!-- Line items table — thead uses tbody so it does NOT repeat on page breaks -->
<table class="concept-table">
  <tbody class="table-header-row">
    <tr>
      <th>Descripción</th>
      <th class="right" style="width:65px;">Cantidad</th>
      <th class="right" style="width:100px;">Precio unit.</th>
      ${hasAnyDiscount ? `
      <th class="right" style="width:50px;">Dto. %</th>
      <th class="right" style="width:90px;">Importe</th>
      <th class="right" style="width:100px;">Importe c/dto.</th>
      ` : `
      <th class="right" style="width:110px;">Importe</th>
      `}
    </tr>
  </tbody>
  <tbody>
    ${hasLineItems
      ? renderLineRows(items, hasAnyDiscount)
      : `<tr>
          <td>${esc(invoice.concept || '—')}</td>
          <td class="right">1</td>
          <td class="right">${fmt(invoice.amountNet)} €</td>
          <td class="right" style="font-weight:600;">${fmt(invoice.amountNet)} €</td>
        </tr>`
    }
  </tbody>
  <!-- Totals inside the table so break-before:avoid works relative to the last data row -->
  <tbody style="break-before:avoid;break-inside:avoid;">
    <tr>
      <td colspan="${hasAnyDiscount ? 6 : 4}" style="padding:0;border:none;">
        <div class="totals-box" style="margin-top:12px;">
          ${hasLineItems ? `
          <div class="totals-row">
            <span class="label">Subtotal</span>
            <span class="amount">${fmt(subtotalBruto)} €</span>
          </div>` : ''}
          ${hasAnyDiscount ? `
          <div class="totals-row discount">
            <span class="label">Descuento total</span>
            <span class="amount">−${fmt(totalDiscounts)} €</span>
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
            <span class="label">${totalLabel}</span>
            <span class="amount" style="font-size:14px;">${fmt(invoice.amountTotal)} €</span>
          </div>
        </div>
      </td>
    </tr>
  </tbody>
</table>

<!-- Bank transfer footer -->
<div class="footer-bank">
  Datos para transferencia<br/>
  Platomico, S.L. · IBAN: ES69 1583 0001 1993 4722 6761 · BIC: REVOESM2
</div>

</body>
</html>`

  return renderHtmlToPdf(html)
}
