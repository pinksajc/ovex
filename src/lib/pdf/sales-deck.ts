// =========================================
// SALES DECK PDF — server-only
// Loads /public/Sales Deck.pdf and overlays
// client-specific data on pages 1 and 15
// using pdf-lib only — no Puppeteer required.
// =========================================

import fs from 'fs'
import path from 'path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import type { Presupuesto } from '@/types'

type Rgb = ReturnType<typeof rgb>

// ---- Formatting helpers ----
function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + ' €'
}

function fmtDate(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ---- Draw centered text ----
function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: Rgb,
  pageWidth: number,
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (pageWidth - w) / 2, y, font, size, color })
}

// ---- Draw right-aligned text ----
function drawRight(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color: Rgb,
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: rightX - w, y, font, size, color })
}

// ---- Overlay proposal content on page 15 ----
function overlayProposal(page: PDFPage, oferta: Presupuesto, font: PDFFont, bold: PDFFont): void {
  const W = 1920
  const H = 1080

  const lineItems = (oferta.lineItems ?? []).filter((i) => i.type === 'line')
  const vatAmount = oferta.amountNet * (oferta.vatRate / 100)

  // ── Colors ──────────────────────────────────────────────────────────────
  const bg       = rgb(  5/255,   9/255,  26/255)
  const bar      = rgb( 16/255,  24/255,  60/255)
  const headBg   = rgb( 20/255,  44/255,  80/255)
  const rowEven  = rgb(  1/255,   3/255,  10/255)
  const rowOdd   = rgb(  8/255,  14/255,  35/255)
  const totFinal = rgb( 26/255,  39/255,  68/255)
  const white    = rgb(1, 1, 1)
  const dim      = rgb(0.40, 0.45, 0.55)
  const muted    = rgb(0.60, 0.65, 0.72)
  const light    = rgb(0.88, 0.91, 0.95)

  // ── Full background (covers existing placeholder content) ────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg })

  // ── Top bar ──────────────────────────────────────────────────────────────
  const BAR_H = 72
  page.drawRectangle({ x: 0, y: H - BAR_H, width: W, height: BAR_H, color: bar })

  page.drawText(truncate(oferta.clientName, 50), {
    x: 80, y: H - BAR_H + Math.round((BAR_H - 14) / 2),
    font: bold, size: 14, color: white,
  })

  const tagline = 'Sistema Operativo de Hostelería Moderna.'
  const tagW = font.widthOfTextAtSize(tagline, 11)
  page.drawText(tagline, {
    x: W - 80 - tagW, y: H - BAR_H + Math.round((BAR_H - 11) / 2),
    font, size: 11, color: dim,
  })

  // ── Slide title ───────────────────────────────────────────────────────────
  const TITLE_Y = H - BAR_H - 80  // 928
  page.drawText('Propuesta Platomico.', {
    x: 80, y: TITLE_Y, font: bold, size: 48, color: white,
  })

  // ── Destinatario card ─────────────────────────────────────────────────────
  const CARD_X   = 80
  const CARD_W   = 700
  const CARD_H   = 110
  const CARD_BOT = TITLE_Y - 50 - CARD_H  // 768

  page.drawRectangle({
    x: CARD_X, y: CARD_BOT, width: CARD_W, height: CARD_H,
    color: white, opacity: 0.04,
    borderColor: white, borderOpacity: 0.10, borderWidth: 1,
  })

  page.drawText('CLIENTE', {
    x: CARD_X + 20, y: CARD_BOT + CARD_H - 20,
    font: bold, size: 9, color: dim,
  })
  page.drawText(truncate(oferta.clientName, 45), {
    x: CARD_X + 20, y: CARD_BOT + CARD_H - 42,
    font: bold, size: 20, color: white,
  })

  let detailY = CARD_BOT + CARD_H - 65
  if (oferta.clientCif) {
    page.drawText(`NIF/CIF: ${oferta.clientCif}`, {
      x: CARD_X + 20, y: detailY, font, size: 12, color: muted,
    })
    detailY -= 18
  }
  if (oferta.clientAddress) {
    page.drawText(truncate(oferta.clientAddress, 60), {
      x: CARD_X + 20, y: detailY, font, size: 12, color: muted,
    })
  }

  // Valid until (right of card)
  if (oferta.validUntil) {
    const validStr = fmtDate(oferta.validUntil)
    const validX = CARD_X + CARD_W + 60
    page.drawText('VÁLIDO HASTA', {
      x: validX, y: CARD_BOT + 52, font: bold, size: 9, color: dim,
    })
    page.drawText(validStr, {
      x: validX, y: CARD_BOT + 28, font, size: 14, color: muted,
    })
  }

  // ── Line items table ──────────────────────────────────────────────────────
  const TABLE_X = 80
  const TABLE_W = W - 160  // 1760
  const HEAD_H  = 44
  const ROW_H   = 40

  // Header sits just below the card
  const HEAD_BOT = CARD_BOT - 30 - HEAD_H  // 694

  // Column right-edge x values (description is left-aligned)
  const QTY_RX  = TABLE_X + Math.round(TABLE_W * 0.60)  // ~1136
  const UNIT_RX = TABLE_X + Math.round(TABLE_W * 0.79)  // ~1464
  const AMT_RX  = TABLE_X + TABLE_W - 20                // 1820

  page.drawRectangle({ x: TABLE_X, y: HEAD_BOT, width: TABLE_W, height: HEAD_H, color: headBg })

  const TH_Y = HEAD_BOT + 16
  page.drawText('DESCRIPCIÓN', { x: TABLE_X + 20, y: TH_Y, font: bold, size: 11, color: muted })
  drawRight(page, 'CANTIDAD',     QTY_RX,  TH_Y, bold, 11, muted)
  drawRight(page, 'PRECIO UNIT.', UNIT_RX, TH_Y, bold, 11, muted)
  drawRight(page, 'IMPORTE',      AMT_RX,  TH_Y, bold, 11, muted)

  // Item rows (up to 8)
  let rowBotY = HEAD_BOT
  const visible = lineItems.slice(0, 8)

  for (let i = 0; i < visible.length; i++) {
    const item = visible[i]
    const rowBot = rowBotY - ROW_H
    const rowBg  = i % 2 === 0 ? rowEven : rowOdd
    page.drawRectangle({ x: TABLE_X, y: rowBot, width: TABLE_W, height: ROW_H, color: rowBg })

    const TEXT_Y = rowBot + 14
    page.drawText(truncate(item.description, 70), { x: TABLE_X + 20, y: TEXT_Y, font, size: 12, color: light })
    drawRight(page, String(item.quantity), QTY_RX,  TEXT_Y, font,  12, muted)
    drawRight(page, fmt(item.unitPrice),   UNIT_RX, TEXT_Y, font,  12, muted)
    drawRight(page, fmt(item.amount),      AMT_RX,  TEXT_Y, bold,  12, light)

    rowBotY = rowBot
  }

  // Fallback row when no line items
  if (visible.length === 0) {
    const rowBot = rowBotY - ROW_H
    page.drawRectangle({ x: TABLE_X, y: rowBot, width: TABLE_W, height: ROW_H, color: rowEven })
    page.drawText(truncate(oferta.concept || '—', 80), {
      x: TABLE_X + 20, y: rowBot + 14, font, size: 12, color: light,
    })
    drawRight(page, fmt(oferta.amountNet), AMT_RX, rowBot + 14, bold, 12, light)
    rowBotY = rowBot
  }

  // ── Totals (right-aligned) ────────────────────────────────────────────────
  const TOT_W     = 560
  const TOT_X     = W - 80 - TOT_W  // 1280
  const TOT_ROW_H = 40
  const TOT_FIN_H = 52

  let totBotY = rowBotY - 20  // 20pt gap below last row

  const drawTotRow = (label: string, value: string): void => {
    const bot = totBotY - TOT_ROW_H
    page.drawRectangle({
      x: TOT_X, y: bot, width: TOT_W, height: TOT_ROW_H,
      color: white, opacity: 0.03,
      borderColor: white, borderOpacity: 0.07, borderWidth: 1,
    })
    page.drawText(label, { x: TOT_X + 20, y: bot + 13, font, size: 13, color: muted })
    drawRight(page, value, TOT_X + TOT_W - 20, bot + 13, bold, 13, light)
    totBotY = bot
  }

  const drawTotFinal = (label: string, value: string): void => {
    const bot = totBotY - TOT_FIN_H
    page.drawRectangle({ x: TOT_X, y: bot, width: TOT_W, height: TOT_FIN_H, color: totFinal })
    page.drawText(label, { x: TOT_X + 20, y: bot + 19, font: bold, size: 11, color: muted })
    drawRight(page, value, TOT_X + TOT_W - 20, bot + 17, bold, 18, white)
    totBotY = bot
  }

  drawTotRow('Base imponible', fmt(oferta.amountNet))
  drawTotRow(`IVA (${oferta.vatRate}%)`, fmt(vatAmount))
  drawTotFinal('TOTAL OFERTA', fmt(oferta.amountTotal))
}

// ---- Main export ----
export async function generateSalesDeckPdf(oferta: Presupuesto): Promise<Buffer> {
  const deckPath  = path.join(process.cwd(), 'public', 'Sales Deck.pdf')
  const deckBytes = fs.readFileSync(deckPath)
  const doc       = await PDFDocument.load(deckBytes)

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  // ── Page 1: client name below logo ───────────────────────────────────────
  const page1 = doc.getPage(0)
  drawCentered(page1, oferta.clientName, 320, font, 24, rgb(0.4, 0.4, 0.4), page1.getWidth())

  // ── Page 15: proposal overlay ─────────────────────────────────────────────
  overlayProposal(doc.getPage(14), oferta, font, bold)

  return Buffer.from(await doc.save())
}
