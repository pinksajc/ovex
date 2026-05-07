// =========================================
// SALES DECK PDF — server-only
// Loads /public/Sales Deck.pdf and overlays
// client-specific data on pages 1 and 12
// using pdf-lib only — no Puppeteer required.
// All coordinates are defined relative to a
// 1920×1080 reference and scaled to the actual
// page dimensions at runtime.
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

// ---- Overlay proposal content — coordinates defined for 1920×1080, scaled to actual page ----
function overlayProposal(page: PDFPage, oferta: Presupuesto, font: PDFFont, bold: PDFFont): void {
  const W  = page.getWidth()
  const H  = page.getHeight()
  // Scale factors from 1920×1080 reference
  const sx = W / 1920
  const sy = H / 1080

  // Scale helpers (round to avoid sub-pixel drift in PDF coordinates)
  const px = (n: number) => Math.round(n * sx)
  const py = (n: number) => Math.round(n * sy)
  const fs = (n: number) => Math.round((n + 4) * sy)  // font sizes scale with height (+4pt across the board)

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

  // ── Full background ──────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg })

  // ── Top bar ──────────────────────────────────────────────────────────────
  const BAR_H = py(72)
  page.drawRectangle({ x: 0, y: H - BAR_H, width: W, height: BAR_H, color: bar })

  page.drawText(truncate(oferta.clientName, 50), {
    x: px(80), y: H - BAR_H + Math.round((BAR_H - fs(14)) / 2),
    font: bold, size: fs(14), color: white,
  })

  const tagline = 'Sistema Operativo de Hostelería Moderna.'
  const tagW = font.widthOfTextAtSize(tagline, fs(11))
  page.drawText(tagline, {
    x: W - px(80) - tagW, y: H - BAR_H + Math.round((BAR_H - fs(11)) / 2),
    font, size: fs(11), color: dim,
  })

  // ── Slide title ───────────────────────────────────────────────────────────
  const TITLE_Y = H - BAR_H - py(80)
  page.drawText('Propuesta Platomico.', {
    x: px(80), y: TITLE_Y, font: bold, size: fs(48), color: white,
  })

  // ── Destinatario card ─────────────────────────────────────────────────────
  const CARD_X   = px(80)
  const CARD_W   = px(700)
  const CARD_H   = py(110)
  const CARD_BOT = TITLE_Y - py(50) - CARD_H

  page.drawRectangle({
    x: CARD_X, y: CARD_BOT, width: CARD_W, height: CARD_H,
    color: white, opacity: 0.04,
    borderColor: white, borderOpacity: 0.10, borderWidth: 1,
  })

  page.drawText('CLIENTE', {
    x: CARD_X + px(20), y: CARD_BOT + CARD_H - py(20),
    font: bold, size: fs(9), color: dim,
  })
  page.drawText(truncate(oferta.clientName, 45), {
    x: CARD_X + px(20), y: CARD_BOT + CARD_H - py(42),
    font: bold, size: fs(20), color: white,
  })

  let detailY = CARD_BOT + CARD_H - py(65)
  if (oferta.clientCif) {
    page.drawText(`NIF/CIF: ${oferta.clientCif}`, {
      x: CARD_X + px(20), y: detailY, font, size: fs(12), color: muted,
    })
    detailY -= py(18)
  }
  if (oferta.clientAddress) {
    page.drawText(truncate(oferta.clientAddress, 60), {
      x: CARD_X + px(20), y: detailY, font, size: fs(12), color: muted,
    })
  }

  // Valid until (right of card)
  if (oferta.validUntil) {
    const validStr = fmtDate(oferta.validUntil)
    const validX = CARD_X + CARD_W + px(60)
    page.drawText('VÁLIDO HASTA', {
      x: validX, y: CARD_BOT + py(52), font: bold, size: fs(9), color: dim,
    })
    page.drawText(validStr, {
      x: validX, y: CARD_BOT + py(28), font, size: fs(14), color: muted,
    })
  }

  // ── Line items table ──────────────────────────────────────────────────────
  const TABLE_X = px(80)
  const TABLE_W = W - px(160)
  const HEAD_H  = py(44)
  const ROW_H   = py(40)

  const HEAD_BOT = CARD_BOT - py(30) - HEAD_H

  const QTY_RX  = TABLE_X + Math.round(TABLE_W * 0.60)
  const UNIT_RX = TABLE_X + Math.round(TABLE_W * 0.79)
  const AMT_RX  = TABLE_X + TABLE_W - px(20)

  page.drawRectangle({ x: TABLE_X, y: HEAD_BOT, width: TABLE_W, height: HEAD_H, color: headBg })

  const TH_Y = HEAD_BOT + py(16)
  page.drawText('DESCRIPCIÓN', { x: TABLE_X + px(20), y: TH_Y, font: bold, size: fs(11), color: muted })
  drawRight(page, 'CANTIDAD',     QTY_RX,  TH_Y, bold, fs(11), muted)
  drawRight(page, 'PRECIO UNIT.', UNIT_RX, TH_Y, bold, fs(11), muted)
  drawRight(page, 'IMPORTE',      AMT_RX,  TH_Y, bold, fs(11), muted)

  // Item rows (up to 8)
  let rowBotY = HEAD_BOT
  const visible = lineItems.slice(0, 8)

  for (let i = 0; i < visible.length; i++) {
    const item   = visible[i]
    const rowBot = rowBotY - ROW_H
    const rowBg  = i % 2 === 0 ? rowEven : rowOdd
    page.drawRectangle({ x: TABLE_X, y: rowBot, width: TABLE_W, height: ROW_H, color: rowBg })

    const TEXT_Y = rowBot + py(14)
    page.drawText(truncate(item.description, 70), { x: TABLE_X + px(20), y: TEXT_Y, font, size: fs(12), color: light })
    drawRight(page, String(item.quantity), QTY_RX,  TEXT_Y, font, fs(12), muted)
    drawRight(page, fmt(item.unitPrice),   UNIT_RX, TEXT_Y, font, fs(12), muted)
    drawRight(page, fmt(item.amount),      AMT_RX,  TEXT_Y, bold, fs(12), light)

    rowBotY = rowBot
  }

  // Fallback row when no line items
  if (visible.length === 0) {
    const rowBot = rowBotY - ROW_H
    page.drawRectangle({ x: TABLE_X, y: rowBot, width: TABLE_W, height: ROW_H, color: rowEven })
    page.drawText(truncate(oferta.concept || '—', 80), {
      x: TABLE_X + px(20), y: rowBot + py(14), font, size: fs(12), color: light,
    })
    drawRight(page, fmt(oferta.amountNet), AMT_RX, rowBot + py(14), bold, fs(12), light)
    rowBotY = rowBot
  }

  // ── Totals (right-aligned) ────────────────────────────────────────────────
  const TOT_W     = px(560)
  const TOT_X     = W - px(80) - TOT_W
  const TOT_ROW_H = py(40)
  const TOT_FIN_H = py(52)

  let totBotY = rowBotY - py(20)

  const drawTotRow = (label: string, value: string): void => {
    const bot = totBotY - TOT_ROW_H
    page.drawRectangle({
      x: TOT_X, y: bot, width: TOT_W, height: TOT_ROW_H,
      color: white, opacity: 0.03,
      borderColor: white, borderOpacity: 0.07, borderWidth: 1,
    })
    page.drawText(label, { x: TOT_X + px(20), y: bot + py(13), font, size: fs(13), color: muted })
    drawRight(page, value, TOT_X + TOT_W - px(20), bot + py(13), bold, fs(13), light)
    totBotY = bot
  }

  const drawTotFinal = (label: string, value: string): void => {
    const bot = totBotY - TOT_FIN_H
    page.drawRectangle({ x: TOT_X, y: bot, width: TOT_W, height: TOT_FIN_H, color: totFinal })
    page.drawText(label, { x: TOT_X + px(20), y: bot + py(19), font: bold, size: fs(11), color: muted })
    drawRight(page, value, TOT_X + TOT_W - px(20), bot + py(17), bold, fs(18), white)
    totBotY = bot
  }

  drawTotRow('Base imponible', fmt(oferta.amountNet))
  drawTotRow(`IVA (${oferta.vatRate}%)`, fmt(vatAmount))
  drawTotFinal('TOTAL OFERTA', fmt(oferta.amountTotal))
}

// ---- Main export ----
export async function generateSalesDeckPdf(oferta: Presupuesto): Promise<Buffer> {
  console.log('SALES DECK GENERATOR v2 called')
  const deckPath  = path.join(process.cwd(), 'public', 'Sales Deck.pdf')
  const deckBytes = fs.readFileSync(deckPath)
  const doc       = await PDFDocument.load(deckBytes)

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  // ── Page 1: client name below logo ───────────────────────────────────────
  const page1 = doc.getPage(0)
  const p1H = page1.getHeight()
  // y=320 was the reference position on a 1080pt page — scale proportionally
  const p1Y   = Math.round(320 * p1H / 1080)
  const p1Sz  = 14
  drawCentered(page1, oferta.clientName, p1Y, font, p1Sz, rgb(0.4, 0.4, 0.4), page1.getWidth())

  // ── Page index 10 (slide 11): replace proposal placeholder ──────────────
  overlayProposal(doc.getPage(10), oferta, font, bold)

  return Buffer.from(await doc.save())
}
