// =========================================
// SALES DECK PDF — server-only
// Loads /public/Sales Deck.pdf and:
//   • Overlays client name on page 1 (portada) via pdf-lib
//   • Replaces page 15 (propuesta) with a Puppeteer-rendered
//     dark-navy HTML slide matching the deck's visual style
// =========================================

import fs from 'fs'
import path from 'path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import type { Presupuesto } from '@/types'

// ---- Formatting helpers ----
function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + ' €'
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---- Draw centered text (pdf-lib) ----
function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0),
  pageWidth = 1920
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (pageWidth - w) / 2, y, font, size, color })
}

// ---- Read logo as base64 data URI ----
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

// ---- Render a single 1456×816 slide as PDF bytes via Puppeteer ----
async function renderSlideToPdf(html: string): Promise<Buffer> {
  const puppeteer = (await import('puppeteer-core')).default
  const chromium  = (await import('@sparticuz/chromium')).default

  const executablePath =
    process.env.CHROME_EXECUTABLE_PATH ??
    (await chromium.executablePath())

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--disable-dev-shm-usage',
      '--no-zygote',
    ],
    defaultViewport: { width: 1456, height: 816 },
    executablePath,
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1456, height: 816 })
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const pdf = await page.pdf({
      width: '1456px',
      height: '816px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// ---- Build the propuesta slide HTML ----
function buildPropuestaHtml(oferta: Presupuesto, logoUri: string): string {
  const lineItems = (oferta.lineItems ?? []).filter(i => i.type === 'line')
  const vatAmount = oferta.amountNet * (oferta.vatRate / 100)

  const itemRows = lineItems.slice(0, 8).map((item, idx) => {
    const bg = idx % 2 === 0
      ? 'rgba(255,255,255,0.04)'
      : 'rgba(255,255,255,0.08)'
    const desc = item.description.length > 60
      ? item.description.slice(0, 57) + '…'
      : item.description
    return `
      <tr style="background:${bg};">
        <td style="padding:8px 12px;font-size:11px;color:#cbd5e1;">${esc(desc)}</td>
        <td style="padding:8px 12px;font-size:11px;color:#94a3b8;text-align:right;">${item.quantity}</td>
        <td style="padding:8px 12px;font-size:11px;color:#94a3b8;text-align:right;">${fmt(item.unitPrice)}</td>
        <td style="padding:8px 12px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:right;">${fmt(item.amount)}</td>
      </tr>`
  }).join('')

  const fallbackRow = lineItems.length === 0 ? `
    <tr style="background:rgba(255,255,255,0.04);">
      <td style="padding:8px 12px;font-size:11px;color:#cbd5e1;" colspan="3">${esc(oferta.concept || '—')}</td>
      <td style="padding:8px 12px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:right;">${fmt(oferta.amountNet)}</td>
    </tr>` : ''

  const clientAddr = [
    oferta.clientCif ? `NIF/CIF: ${esc(oferta.clientCif)}` : '',
    oferta.clientAddress ? esc(oferta.clientAddress) : '',
  ].filter(Boolean).join('<br/>')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width: 1456px;
    height: 816px;
    overflow: hidden;
    background: #05091a;
    font-family: Helvetica, Arial, sans-serif;
    color: #e2e8f0;
  }
  .slide {
    width: 1456px;
    height: 816px;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #05091a 0%, #0a1035 60%, #0d1540 100%);
    padding: 0;
  }
  /* Top bar */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 48px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.12);
  }
  .topbar-logo { height: 20px; object-fit: contain; }
  .topbar-tagline {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.05em;
  }
  /* Main content */
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 28px 48px 28px;
    gap: 18px;
    overflow: hidden;
  }
  .slide-title {
    font-size: 30px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
    line-height: 1.1;
    margin-bottom: 4px;
  }
  /* Cards row */
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 14px 16px;
  }
  .card-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    margin-bottom: 6px;
  }
  .card-name {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 4px;
  }
  .card-detail {
    font-size: 10px;
    color: rgba(255,255,255,0.45);
    line-height: 1.5;
  }
  /* Table */
  .table-wrap {
    flex: 1;
    overflow: hidden;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  thead tr {
    background: rgba(30,58,95,0.9);
  }
  thead th {
    padding: 8px 12px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
    text-align: left;
  }
  thead th.r { text-align: right; }
  /* Totals */
  .totals {
    display: flex;
    justify-content: flex-end;
    gap: 0;
    margin-top: 4px;
  }
  .totals-inner {
    min-width: 300px;
  }
  .tot-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 12px;
    font-size: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .tot-row .lbl { color: rgba(255,255,255,0.45); }
  .tot-row .val { color: #e2e8f0; font-weight: 600; }
  .tot-final {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255,255,255,0.1);
    border-radius: 0 0 6px 6px;
    margin-top: 1px;
  }
  .tot-final .lbl { font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.5); }
  .tot-final .val { font-size: 14px; font-weight: 700; color: #ffffff; }
</style>
</head>
<body>
<div class="slide">
  <!-- Top bar -->
  <div class="topbar">
    ${logoUri ? `<img class="topbar-logo" src="${logoUri}" alt="Platomico"/>` : '<span style="font-size:14px;font-weight:700;color:#fff;">Platomico</span>'}
    <span class="topbar-tagline">Sistema Operativo de Hostelería Moderna.</span>
  </div>

  <!-- Main content -->
  <div class="content">
    <div class="slide-title">Propuesta Platomico.</div>

    <!-- Emisor + Cliente -->
    <div class="cards">
      <div class="card">
        <div class="card-label">Emisor</div>
        <div class="card-name">Platomico, S.L.</div>
        <div class="card-detail">NIF: B22741094<br/>C/ Antonio Machado 9, Rozas de Puerto Real<br/>Madrid 28649 · hola@platomico.com</div>
      </div>
      <div class="card">
        <div class="card-label">Cliente</div>
        <div class="card-name">${esc(oferta.clientName)}</div>
        <div class="card-detail">${clientAddr || '&nbsp;'}</div>
      </div>
    </div>

    <!-- Line items table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Descripción</th>
            <th class="r" style="width:70px;">Cantidad</th>
            <th class="r" style="width:130px;">Precio unit.</th>
            <th class="r" style="width:130px;">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows || fallbackRow}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-inner">
        <div class="tot-row">
          <span class="lbl">Base imponible</span>
          <span class="val">${fmt(oferta.amountNet)}</span>
        </div>
        <div class="tot-row">
          <span class="lbl">IVA (${oferta.vatRate}%)</span>
          <span class="val">${fmt(vatAmount)}</span>
        </div>
        <div class="tot-final">
          <span class="lbl">Total oferta</span>
          <span class="val">${fmt(oferta.amountTotal)}</span>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`
}

// ---- Main export ----
export async function generateSalesDeckPdf(oferta: Presupuesto): Promise<Buffer> {
  const deckPath = path.join(process.cwd(), 'public', 'Sales Deck.pdf')
  const deckBytes = fs.readFileSync(deckPath)
  const doc = await PDFDocument.load(deckBytes)

  const helvetica = await doc.embedFont(StandardFonts.Helvetica)

  // ── Page 1: Portada — subtle "Preparado para: [client]" ───────────────────
  const page1 = doc.getPage(0)
  const prepLabel = `Preparado para: ${oferta.clientName}`
  // Centered, white, lightweight feel — 24pt regular, letter-spacing via char spacing
  drawCentered(page1, prepLabel, 320, helvetica, 24, rgb(1, 1, 1), 1920)

  // ── Page 15: Replace with Puppeteer-rendered slide ────────────────────────
  const logoUri = readLogoDataUri()
  const slideHtml = buildPropuestaHtml(oferta, logoUri)
  const slidePdfBytes = await renderSlideToPdf(slideHtml)

  // Load the rendered slide PDF and copy its first (only) page
  const slideDoc = await PDFDocument.load(slidePdfBytes)
  const [copiedPage] = await doc.copyPages(slideDoc, [0])

  // Remove original page 15 (index 14) and insert the rendered page
  doc.removePage(14)
  doc.insertPage(14, copiedPage)

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
