// =========================================
// SALES DECK PDF — server-only
// Loads /public/Sales Deck.pdf and:
//   • Overlays client name on page 1 (portada) via pdf-lib
//   • Replaces page 15 (propuesta) with a Puppeteer-rendered
//     dark-navy HTML slide matching the deck's exact dimensions
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

// ---- Render a slide at exact pt dimensions via Puppeteer ----
// Puppeteer converts CSS px → PDF points at 96dpi→72dpi (× 0.75).
// To produce a PDF page of ptW × ptH points we render at:
//   cssW = ptW × (96/72)   cssH = ptH × (96/72)
async function renderSlideToPdf(
  html: string,
  cssW: number,
  cssH: number
): Promise<Buffer> {
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
    defaultViewport: { width: cssW, height: cssH },
    executablePath,
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: cssW, height: cssH })
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const pdf = await page.pdf({
      width: `${cssW}px`,
      height: `${cssH}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// ---- Format date as "DD de MMMM de YYYY" ----
function fmtDate(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ---- Build the propuesta slide HTML ----
// Font sizes are in vh units calculated for a 1920×1080pt slide (cssH ≈ 1440px).
// Formula: desired_pt × (96/72) / cssH × 100  →  vh value
// e.g. 48pt → 64px CSS → 64/1440 × 100 = 4.44vh
function buildPropuestaHtml(
  oferta: Presupuesto,
  logoUri: string,
  cssW: number,
  cssH: number
): string {
  const lineItems = (oferta.lineItems ?? []).filter(i => i.type === 'line')
  const vatAmount = oferta.amountNet * (oferta.vatRate / 100)

  // Scale factor: 1vh in CSS = cssH/100 px; to get N pt in PDF → N*(96/72)/cssH*100 vh
  // Pre-computed for common targets (assuming ~1440px cssH for 1080pt slide):
  // 48pt→4.44vh | 20pt→1.85vh | 14pt→1.3vh | 11pt→1.02vh | 16pt→1.48vh
  // 13pt→1.2vh  | 18pt→1.67vh

  const itemRows = lineItems.slice(0, 8).map((item, idx) => {
    const bg = idx % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'
    const desc = item.description.length > 70 ? item.description.slice(0, 67) + '…' : item.description
    return `
      <tr style="background:${bg};">
        <td style="padding:1.1vh 1.5vw;font-size:1.3vh;color:#cbd5e1;">${esc(desc)}</td>
        <td style="padding:1.1vh 1.5vw;font-size:1.3vh;color:#94a3b8;text-align:right;">${item.quantity}</td>
        <td style="padding:1.1vh 1.5vw;font-size:1.3vh;color:#94a3b8;text-align:right;">${fmt(item.unitPrice)}</td>
        <td style="padding:1.1vh 1.5vw;font-size:1.3vh;color:#e2e8f0;font-weight:600;text-align:right;">${fmt(item.amount)}</td>
      </tr>`
  }).join('')

  const fallbackRow = lineItems.length === 0 ? `
    <tr style="background:rgba(255,255,255,0.04);">
      <td style="padding:1.1vh 1.5vw;font-size:1.3vh;color:#cbd5e1;" colspan="3">${esc(oferta.concept || '—')}</td>
      <td style="padding:1.1vh 1.5vw;font-size:1.3vh;color:#e2e8f0;font-weight:600;text-align:right;">${fmt(oferta.amountNet)}</td>
    </tr>` : ''

  const clientAddr = [
    oferta.clientCif ? `NIF/CIF: ${esc(oferta.clientCif)}` : '',
    oferta.clientAddress ? esc(oferta.clientAddress) : '',
  ].filter(Boolean).join('<br/>')

  const validUntilStr = fmtDate(oferta.validUntil)

  // Top bar left: client name
  const topbarLeft = `<span style="font-size:1.4vh;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.02em;">${esc(oferta.clientName)}</span>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width: ${cssW}px;
    height: ${cssH}px;
    overflow: hidden;
    font-family: Helvetica, Arial, sans-serif;
    color: #e2e8f0;
  }
  .slide {
    width: ${cssW}px;
    height: ${cssH}px;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #05091a 0%, #0a1035 60%, #0d1540 100%);
  }

  /* ── Top bar ── */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.8vh 4vw 1.5vh;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    flex-shrink: 0;
  }
  .topbar-tagline {
    font-size: 1.02vh;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.06em;
  }

  /* ── Main content ── */
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 4.5vh 4.5vw 3vh;
    overflow: hidden;
    min-height: 0;
  }

  /* ── Title — ~48pt ── */
  .slide-title {
    font-size: 4.44vh;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.1;
    flex-shrink: 0;
    margin-bottom: 3.2vh;
  }

  /* ── Cliente row: card (40%) + validity ── */
  .meta-row {
    display: flex;
    align-items: flex-start;
    gap: 2.5vw;
    flex-shrink: 0;
    margin-bottom: 2.8vh;
  }
  .card {
    width: 40%;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 0.5vw;
    padding: 1.8vh 1.8vw;
  }
  .card-label {
    font-size: 0.9vh;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.32);
    margin-bottom: 0.8vh;
  }
  .card-name {
    /* ~20pt */
    font-size: 1.85vh;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 0.6vh;
  }
  .card-detail {
    /* ~14pt */
    font-size: 1.3vh;
    color: rgba(255,255,255,0.45);
    line-height: 1.6;
  }
  .validity {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding-bottom: 0.6vh;
  }
  .validity-label {
    /* ~11pt */
    font-size: 1.02vh;
    color: rgba(255,255,255,0.3);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
    margin-bottom: 0.4vh;
  }
  .validity-date {
    /* ~16pt */
    font-size: 1.48vh;
    color: rgba(255,255,255,0.7);
    font-weight: 400;
  }

  /* ── Table ── */
  .table-wrap {
    flex-shrink: 0;
    margin-bottom: 2.8vh;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  thead tr { background: rgba(20,44,80,0.95); }
  thead th {
    /* ~13pt */
    padding: 1.1vh 1.5vw;
    font-size: 1.2vh;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
    text-align: left;
  }
  thead th.r { text-align: right; }

  /* ── Totals — flows naturally after table, aligned right ── */
  .totals {
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
  }
  .totals-inner {
    width: 30vw;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 0.5vw;
    overflow: hidden;
  }
  .tot-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.9vh 1.5vw;
    /* ~14pt */
    font-size: 1.3vh;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
  }
  .tot-row .lbl { color: rgba(255,255,255,0.45); }
  .tot-row .val { color: #e2e8f0; font-weight: 600; }
  .tot-final {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.3vh 1.5vw;
    /* Dark navy — visually prominent */
    background: #1a2744;
  }
  .tot-final .lbl {
    /* ~11pt */
    font-size: 1.02vh;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
  }
  .tot-final .val {
    /* ~18pt */
    font-size: 1.67vh;
    font-weight: 700;
    color: #ffffff;
  }
</style>
</head>
<body>
<div class="slide">

  <!-- Top bar -->
  <div class="topbar">
    ${topbarLeft}
    <span class="topbar-tagline">Sistema Operativo de Hostelería Moderna.</span>
  </div>

  <!-- Main content -->
  <div class="content">

    <div class="slide-title">Propuesta Platomico.</div>

    <!-- Cliente card + validity -->
    <div class="meta-row">
      <div class="card">
        <div class="card-label">Cliente</div>
        <div class="card-name">${esc(oferta.clientName)}</div>
        ${clientAddr ? `<div class="card-detail">${clientAddr}</div>` : ''}
      </div>
      ${validUntilStr ? `
      <div class="validity">
        <div class="validity-label">Válido hasta</div>
        <div class="validity-date">${validUntilStr}</div>
      </div>` : ''}
    </div>

    <!-- Line items table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Descripción</th>
            <th class="r" style="width:8vw;">Cantidad</th>
            <th class="r" style="width:14vw;">Precio unit.</th>
            <th class="r" style="width:14vw;">Importe</th>
          </tr>
        </thead>
        <tbody>${itemRows || fallbackRow}</tbody>
      </table>
    </div>

    <!-- Totals — flows right after table, not pinned to bottom -->
    <div class="totals">
      <div class="totals-inner">
        <div class="tot-row">
          <span class="lbl">Base imponible</span>
          <span class="val">${fmt(oferta.amountNet)}</span>
        </div>
        <div class="tot-row" style="border-bottom:none;">
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

  // ── Page 1: Portada — subtle "Preparado para: [client]" ──────────────────
  const page1 = doc.getPage(0)
  const p1W = page1.getWidth()
  const prepLabel = `Preparado para: ${oferta.clientName}`
  drawCentered(page1, prepLabel, 320, helvetica, 24, rgb(1, 1, 1), p1W)

  // ── Page 15: Replace with Puppeteer-rendered slide ────────────────────────
  // Read original page 15 dimensions (in PDF points) so our rendered slide
  // matches exactly — avoids the "small extra page" problem.
  const origPage15 = doc.getPage(14)
  const ptW = origPage15.getWidth()
  const ptH = origPage15.getHeight()

  // Puppeteer renders CSS px at 96dpi; PDF uses 72dpi.
  // To output ptW × ptH points we need ptW × (96/72) CSS pixels.
  const cssW = Math.round(ptW * (96 / 72))
  const cssH = Math.round(ptH * (96 / 72))

  const logoUri = readLogoDataUri()
  const slideHtml = buildPropuestaHtml(oferta, logoUri, cssW, cssH)
  const slidePdfBytes = await renderSlideToPdf(slideHtml, cssW, cssH)

  // Load the rendered single-page PDF and copy its page into the deck
  const slideDoc = await PDFDocument.load(slidePdfBytes)
  const [copiedPage] = await doc.copyPages(slideDoc, [0])

  // Remove original page 15 (index 14), insert the new one at the same index
  doc.removePage(14)
  doc.insertPage(14, copiedPage)

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
