// =========================================
// SALES DECK PDF OVERLAY — server-only
// Loads /public/Sales Deck.pdf and overlays dynamic oferta data
// on page 1 (portada) and page 15 (propuesta).
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

// ---- Draw text helper ----
function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0)
) {
  page.drawText(text, { x, y, font, size, color })
}

// ---- Draw centered text ----
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

// ---- Draw a filled rectangle ----
function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color = rgb(1, 1, 1)
) {
  page.drawRectangle({ x, y, width, height, color, borderWidth: 0 })
}

// ---- Draw horizontal line ----
function drawLine(
  page: PDFPage,
  x1: number,
  y: number,
  x2: number,
  color = rgb(0.85, 0.85, 0.85),
  thickness = 1
) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })
}

// ---- Main export ----
export async function generateSalesDeckPdf(oferta: Presupuesto): Promise<Buffer> {
  const deckPath = path.join(process.cwd(), 'public', 'Sales Deck.pdf')
  const deckBytes = fs.readFileSync(deckPath)
  const doc = await PDFDocument.load(deckBytes)

  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold)

  // ── Page 1: Portada ──────────────────────────────────────────────────────────
  // 1920×1080. Tagline sits around y=440. Add a subtle "Preparado para:" line
  // at y=330 in regular weight, 26pt — clearly secondary to the tagline.
  const page1 = doc.getPage(0)
  const prepLabel = `Preparado para: ${oferta.clientName}`
  drawCentered(page1, prepLabel, 330, helvetica, 26, rgb(1, 1, 1))

  // ── Page 15: Propuesta ───────────────────────────────────────────────────────
  const page15 = doc.getPage(14)
  const W = 1920
  const margin = 100

  // White overlay covering the content area (below the dark header band)
  drawRect(page15, 0, 0, W, 880)

  // ── CLIENTE card — full width
  const boxH = 160
  const boxY = 840 - boxH
  const clientBoxW = W - margin * 2

  drawRect(page15, margin, boxY, clientBoxW, boxH, rgb(0.94, 0.97, 0.99))
  page15.drawRectangle({
    x: margin, y: boxY, width: clientBoxW, height: boxH,
    borderColor: rgb(0.82, 0.89, 0.94), borderWidth: 1,
    color: rgb(0.94, 0.97, 0.99),
  })
  drawText(page15, 'CLIENTE', margin + 20, boxY + boxH - 26, helveticaBold, 11, rgb(0.6, 0.7, 0.78))
  drawText(page15, oferta.clientName, margin + 20, boxY + boxH - 54, helveticaBold, 20, rgb(0.12, 0.23, 0.37))

  let clientDetailY = boxY + boxH - 82
  if (oferta.clientCif) {
    drawText(page15, `NIF/CIF: ${oferta.clientCif}`, margin + 20, clientDetailY, helvetica, 14, rgb(0.39, 0.51, 0.6))
    clientDetailY -= 22
  }
  if (oferta.clientAddress) {
    const addr = oferta.clientAddress.length > 100 ? oferta.clientAddress.slice(0, 97) + '…' : oferta.clientAddress
    drawText(page15, addr, margin + 20, clientDetailY, helvetica, 14, rgb(0.39, 0.51, 0.6))
  }

  // ── Line items table
  const tableTop = boxY - 28
  const tableLeft = margin
  const tableRight = W - margin
  const tableWidth = tableRight - tableLeft

  // Columns: Descripción(fill) | Cantidad(120) | Precio unit.(180) | Importe(180)
  const cQty = tableRight - 180 - 180 - 120
  const cPrice = tableRight - 180 - 180
  const cImporte = tableRight - 180

  // Header row
  const thH = 38
  const thY = tableTop - thH
  drawRect(page15, tableLeft, thY, tableWidth, thH, rgb(0.12, 0.23, 0.37))
  const thTextY = thY + 12
  drawText(page15, 'DESCRIPCIÓN', tableLeft + 16, thTextY, helveticaBold, 12, rgb(1, 1, 1))
  drawText(page15, 'CANTIDAD', cQty + 16, thTextY, helveticaBold, 12, rgb(1, 1, 1))
  drawText(page15, 'PRECIO UNIT.', cPrice + 16, thTextY, helveticaBold, 12, rgb(1, 1, 1))
  drawText(page15, 'IMPORTE', cImporte + 16, thTextY, helveticaBold, 12, rgb(1, 1, 1))

  // Data rows
  const lineItems = (oferta.lineItems ?? []).filter(i => i.type === 'line')
  const rowH = 34
  let rowY = thY

  lineItems.slice(0, 10).forEach((item, idx) => {
    rowY -= rowH
    if (idx % 2 === 1) drawRect(page15, tableLeft, rowY, tableWidth, rowH, rgb(0.97, 0.98, 0.99))
    const textY = rowY + 10
    const desc = item.description.length > 65 ? item.description.slice(0, 62) + '…' : item.description
    drawText(page15, desc, tableLeft + 16, textY, helvetica, 12, rgb(0.2, 0.29, 0.37))
    drawText(page15, String(item.quantity), cQty + 16, textY, helvetica, 12, rgb(0.2, 0.29, 0.37))
    drawText(page15, fmt(item.unitPrice), cPrice + 16, textY, helvetica, 12, rgb(0.2, 0.29, 0.37))
    drawText(page15, fmt(item.amount), cImporte + 16, textY, helveticaBold, 12, rgb(0.12, 0.23, 0.37))
    drawLine(page15, tableLeft, rowY, tableRight, rgb(0.93, 0.94, 0.95))
  })

  // ── Totals block (right-aligned)
  const totalsW = 400
  const totalsX = W - margin - totalsW
  let totY = rowY - 16

  const vatAmount = oferta.amountNet * (oferta.vatRate / 100)
  const totRows: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Base imponible', value: fmt(oferta.amountNet) },
    { label: `IVA (${oferta.vatRate}%)`, value: fmt(vatAmount) },
    { label: 'TOTAL OFERTA', value: fmt(oferta.amountTotal), highlight: true },
  ]

  totRows.forEach(row => {
    const rH = row.highlight ? 46 : 32
    totY -= rH
    if (row.highlight) {
      drawRect(page15, totalsX, totY, totalsW, rH, rgb(0.12, 0.23, 0.37))
      drawText(page15, row.label, totalsX + 16, totY + 15, helveticaBold, 13, rgb(0.8, 0.87, 0.93))
      const vw = helveticaBold.widthOfTextAtSize(row.value, 19)
      drawText(page15, row.value, totalsX + totalsW - vw - 16, totY + 13, helveticaBold, 19, rgb(1, 1, 1))
    } else {
      drawRect(page15, totalsX, totY, totalsW, rH, rgb(0.96, 0.97, 0.98))
      drawLine(page15, totalsX, totY, totalsX + totalsW, rgb(0.88, 0.9, 0.92))
      drawText(page15, row.label, totalsX + 16, totY + 10, helvetica, 13, rgb(0.4, 0.51, 0.6))
      const vw = helvetica.widthOfTextAtSize(row.value, 13)
      drawText(page15, row.value, totalsX + totalsW - vw - 16, totY + 10, helveticaBold, 13, rgb(0.12, 0.23, 0.37))
    }
  })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
