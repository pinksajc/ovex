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
  // 1920×1080. Logo center ~y=580, tagline ~y=440. Add client name at y=370.
  const page1 = doc.getPage(0)
  const clientLabel = oferta.clientName.toUpperCase()
  drawCentered(page1, clientLabel, 368, helveticaBold, 44, rgb(1, 1, 1))

  // ── Page 15: Propuesta ───────────────────────────────────────────────────────
  // Cover the content area below the header with white, then draw oferta data.
  const page15 = doc.getPage(14)
  const W = 1920
  const margin = 100

  // White overlay covering the content area (below a dark header band ~y=900)
  drawRect(page15, 0, 0, W, 880)

  // ── Section titles
  const colW = (W - margin * 2 - 40) / 2
  const col1x = margin
  const col2x = margin + colW + 40

  // ── EMISOR box
  const boxH = 180
  const boxY = 840 - boxH
  drawRect(page15, col1x, boxY, colW, boxH, rgb(0.94, 0.97, 0.99))
  page15.drawRectangle({ x: col1x, y: boxY, width: colW, height: boxH, borderColor: rgb(0.82, 0.89, 0.94), borderWidth: 1, color: rgb(0.94, 0.97, 0.99) })
  drawText(page15, 'EMISOR', col1x + 16, boxY + boxH - 26, helveticaBold, 11, rgb(0.6, 0.7, 0.78))
  drawText(page15, 'Platomico, S.L.', col1x + 16, boxY + boxH - 52, helveticaBold, 18, rgb(0.12, 0.23, 0.37))
  drawText(page15, 'NIF: B22741094', col1x + 16, boxY + boxH - 76, helvetica, 13, rgb(0.39, 0.51, 0.6))
  drawText(page15, 'C/ Antonio Machado 9, Rozas de Puerto Real, Madrid 28649', col1x + 16, boxY + boxH - 96, helvetica, 13, rgb(0.39, 0.51, 0.6))
  drawText(page15, 'hola@platomico.com', col1x + 16, boxY + boxH - 116, helvetica, 13, rgb(0.39, 0.51, 0.6))

  // ── DESTINATARIO box
  drawRect(page15, col2x, boxY, colW, boxH, rgb(0.97, 0.98, 0.99))
  page15.drawRectangle({ x: col2x, y: boxY, width: colW, height: boxH, borderColor: rgb(0.87, 0.89, 0.91), borderWidth: 1, color: rgb(0.97, 0.98, 0.99) })
  drawText(page15, 'CLIENTE', col2x + 16, boxY + boxH - 26, helveticaBold, 11, rgb(0.6, 0.7, 0.78))
  drawText(page15, oferta.clientName, col2x + 16, boxY + boxH - 52, helveticaBold, 18, rgb(0.12, 0.23, 0.37))
  if (oferta.clientCif) {
    drawText(page15, `NIF/CIF: ${oferta.clientCif}`, col2x + 16, boxY + boxH - 76, helvetica, 13, rgb(0.39, 0.51, 0.6))
  }
  if (oferta.clientAddress) {
    const addr = oferta.clientAddress.length > 60 ? oferta.clientAddress.slice(0, 57) + '…' : oferta.clientAddress
    drawText(page15, addr, col2x + 16, boxY + (oferta.clientCif ? boxH - 96 : boxH - 76), helvetica, 13, rgb(0.39, 0.51, 0.6))
  }

  // ── Line items table
  const tableTop = boxY - 24
  const tableLeft = margin
  const tableRight = W - margin
  const tableWidth = tableRight - tableLeft

  // Column widths: Descripción(fill) | Cantidad(120) | Precio unit.(160) | Importe(160)
  const cDesc = tableLeft
  const cQty = tableRight - 160 - 160 - 120
  const cPrice = tableRight - 160 - 160
  const cImporte = tableRight - 160

  // Header row
  const thH = 36
  const thY = tableTop - thH
  drawRect(page15, tableLeft, thY, tableWidth, thH, rgb(0.12, 0.23, 0.37))
  const thTextY = thY + 11
  drawText(page15, 'DESCRIPCIÓN', cDesc + 14, thTextY, helveticaBold, 11, rgb(1, 1, 1))
  drawText(page15, 'CANTIDAD', cQty + 14, thTextY, helveticaBold, 11, rgb(1, 1, 1))
  drawText(page15, 'PRECIO UNIT.', cPrice + 14, thTextY, helveticaBold, 11, rgb(1, 1, 1))
  drawText(page15, 'IMPORTE', cImporte + 14, thTextY, helveticaBold, 11, rgb(1, 1, 1))

  // Rows
  const lineItems = (oferta.lineItems ?? []).filter(i => i.type === 'line')
  const rowH = 34
  let rowY = thY

  lineItems.slice(0, 10).forEach((item, idx) => {
    rowY -= rowH
    if (idx % 2 === 1) drawRect(page15, tableLeft, rowY, tableWidth, rowH, rgb(0.97, 0.98, 0.99))
    const textY = rowY + 10
    const desc = item.description.length > 55 ? item.description.slice(0, 52) + '…' : item.description
    drawText(page15, desc, cDesc + 14, textY, helvetica, 12, rgb(0.2, 0.29, 0.37))
    drawText(page15, String(item.quantity), cQty + 14, textY, helvetica, 12, rgb(0.2, 0.29, 0.37))
    drawText(page15, fmt(item.unitPrice), cPrice + 14, textY, helvetica, 12, rgb(0.2, 0.29, 0.37))
    drawText(page15, fmt(item.amount), cImporte + 14, textY, helveticaBold, 12, rgb(0.12, 0.23, 0.37))
    drawLine(page15, tableLeft, rowY, tableRight, rgb(0.93, 0.94, 0.95))
  })

  // ── Totals box
  const totalsX = W - margin - 380
  const totalsW = 380
  let totY = rowY - 20

  const vatAmount = oferta.amountNet * (oferta.vatRate / 100)

  const totRows: Array<{ label: string; value: string; bold?: boolean; highlight?: boolean }> = [
    { label: 'Base imponible', value: fmt(oferta.amountNet) },
    { label: `IVA (${oferta.vatRate}%)`, value: fmt(vatAmount) },
    { label: 'TOTAL OFERTA', value: fmt(oferta.amountTotal), bold: true, highlight: true },
  ]

  totRows.forEach(row => {
    const rH = row.highlight ? 44 : 32
    totY -= rH
    if (row.highlight) {
      drawRect(page15, totalsX, totY, totalsW, rH, rgb(0.12, 0.23, 0.37))
      const lw = helveticaBold.widthOfTextAtSize(row.label, 13)
      drawText(page15, row.label, totalsX + 16, totY + 14, helveticaBold, 13, rgb(0.8, 0.87, 0.93))
      const vw = helveticaBold.widthOfTextAtSize(row.value, 18)
      drawText(page15, row.value, totalsX + totalsW - vw - 16, totY + 12, helveticaBold, 18, rgb(1, 1, 1))
      void lw
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
