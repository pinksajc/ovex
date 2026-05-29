// =========================================
// CASHFLOW EXECUTIVE REPORT — PDF GENERATOR
// server-only
// Three pages:
//  1. Overview — KPIs + monthly bar chart
//  2. Where the money goes — expense donut + unified category table
//  3. Previsión de Cobros — pending invoices, estimated next invoices, offers
//
// Filtering logic mirrors cashflow-charts.tsx exactly:
//   income  → t.type === 'income'
//   expense → t.type === 'expense'
//   operational = exclude 'Traspaso interno' and 'Préstamos'
// =========================================

import fs from 'fs'
import path from 'path'
import type { CashflowTransaction, Invoice, Presupuesto, Deal } from '@/types'
import { PLANS } from '@/lib/pricing/catalog'
import { renderHtmlToPdf } from './generate'

// ── Logo ─────────────────────────────────────────────────────────────────────

function readLogoDataUri(): string {
  for (const { file, mime } of [
    { file: 'logo_platomico.png', mime: 'image/png' },
    { file: 'logo_platomico.svg', mime: 'image/svg+xml' },
  ]) {
    try {
      const buf = fs.readFileSync(path.join(process.cwd(), 'public', file))
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch { /* continue */ }
  }
  return ''
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 1000)      return `${(n / 1000).toFixed(0)}K`
  return String(Math.round(n))
}

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre']
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${String(Number(d)).padStart(2, '0')} ${MONTH_NAMES[Number(m) - 1]} ${y}`
}

function fmtMonthLabel(yyyyMm: string, multiYear: boolean): string {
  const [y, m] = yyyyMm.split('-')
  const name = MONTH_SHORT[Number(m) - 1] ?? m
  return multiYear ? `${name} '${y.slice(2)}` : name
}

function niceMax(val: number): number {
  if (val <= 0) return 1000
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)))
  const normalized = val / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

// ── Category colours ──────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  'Nómina':              '#ef4444',
  'Impuestos':           '#f97316',
  'Hardware':            '#eab308',
  'Administrativo':      '#84cc16',
  'Servidores/Hosting':  '#06b6d4',
  'Base de datos':       '#3b82f6',
  'Herramientas IA':     '#8b5cf6',
  'Marketing':           '#ec4899',
  'Comunicaciones':      '#14b8a6',
  'Viajes':              '#f59e0b',
  'Oficina':             '#a78bfa',
  'Otras herramientas':  '#6366f1',
  'Refunds':             '#fb923c',
  'Otros':               '#94a3b8',
  'Sin categoría':       '#cbd5e1',
  'Ingreso cliente':     '#22c55e',
}

function catColor(name: string): string {
  return CAT_COLORS[name] ?? '#94a3b8'
}

// ── SVG: Donut slice path ─────────────────────────────────────────────────────

function donutSlice(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startAngle: number, endAngle: number,
): string {
  const end = endAngle - startAngle >= 2 * Math.PI - 0.001
    ? startAngle + 2 * Math.PI - 0.001
    : endAngle
  const x1o = cx + outerR * Math.cos(startAngle)
  const y1o = cy + outerR * Math.sin(startAngle)
  const x2o = cx + outerR * Math.cos(end)
  const y2o = cy + outerR * Math.sin(end)
  const x2i = cx + innerR * Math.cos(end)
  const y2i = cy + innerR * Math.sin(end)
  const x1i = cx + innerR * Math.cos(startAngle)
  const y1i = cy + innerR * Math.sin(startAngle)
  const large = end - startAngle > Math.PI ? 1 : 0
  return [
    `M ${x1o.toFixed(2)},${y1o.toFixed(2)}`,
    `A ${outerR},${outerR} 0 ${large},1 ${x2o.toFixed(2)},${y2o.toFixed(2)}`,
    `L ${x2i.toFixed(2)},${y2i.toFixed(2)}`,
    `A ${innerR},${innerR} 0 ${large},0 ${x1i.toFixed(2)},${y1i.toFixed(2)}`,
    'Z',
  ].join(' ')
}

// ── SVG: Donut chart ──────────────────────────────────────────────────────────

interface CatSlice { name: string; amount: number; pct: number; color: string }

function buildDonutSvg(slices: CatSlice[], totalExpense: number): string {
  const cx = 160, cy = 160, outerR = 138, innerR = 86
  const vw = 320, vh = 320

  if (slices.length === 0) {
    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
      <text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">Sin datos</text>
    </svg>`
  }

  let angle = -Math.PI / 2
  let paths = ''
  for (const s of slices) {
    const sweep = (s.amount / totalExpense) * 2 * Math.PI
    if (sweep < 0.01) { angle += sweep; continue }
    paths += `<path d="${donutSlice(cx, cy, outerR, innerR, angle, angle + sweep)}" fill="${s.color}" stroke="white" stroke-width="2.5"/>\n`
    angle += sweep
  }

  const totalLabel = fmtK(totalExpense)
  const centerText = `
    <text x="${cx}" y="${cy - 12}" text-anchor="middle" font-size="18" font-weight="800" fill="#1e2d4a" font-family="Helvetica,Arial,sans-serif">${totalLabel} €</text>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="11" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">Total gastos</text>
    <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="10" fill="#cbd5e1" font-family="Helvetica,Arial,sans-serif">operativos</text>`

  return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">${paths}${centerText}</svg>`
}

// ── SVG: Monthly bar chart ────────────────────────────────────────────────────
// Single Y-axis, same operational filter as frontend IncomeExpenseChart

interface MonthBars { label: string; income: number; expense: number }

function buildBarChartSvg(months: MonthBars[]): string {
  const vw = 600, vh = 400
  const ml = 62, mr = 16, mt = 16, mb = 44
  const cw = vw - ml - mr
  const ch = vh - mt - mb

  if (months.length === 0) {
    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;"></svg>`
  }

  const maxIncome  = Math.max(...months.map(m => m.income), 0)
  const maxExpense = Math.max(...months.map(m => m.expense), 0)
  const rawMax     = Math.max(maxIncome, maxExpense, 1)
  const axisMax    = niceMax(rawMax)

  const n = months.length
  const groupW = cw / n
  const barW = Math.max(7, Math.min(Math.floor(groupW * 0.45), 40))
  const gap = 5

  // 5 grid lines
  const ticks = [0, axisMax * 0.25, axisMax * 0.5, axisMax * 0.75, axisMax]

  let svg = `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">`

  // Background
  svg += `<rect x="${ml}" y="${mt}" width="${cw}" height="${ch}" fill="#f8fafc" rx="6"/>`

  // Grid lines + Y labels
  for (const tick of ticks) {
    const y = (mt + ch - (tick / axisMax) * ch).toFixed(1)
    const isDashed = tick > 0 && tick < axisMax
    svg += `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="${isDashed ? '#e2e8f0' : '#cbd5e1'}" stroke-width="${isDashed ? '1' : '1.5'}" ${isDashed ? 'stroke-dasharray="4,3"' : ''}/>`
    svg += `<text x="${ml - 5}" y="${Number(y) + 3.5}" text-anchor="end" font-size="8.5" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">${fmtK(tick)}</text>`
  }

  // Bars + X labels
  for (let i = 0; i < n; i++) {
    const { label, income, expense } = months[i]
    const cx = ml + i * groupW + groupW / 2
    const pairW = 2 * barW + gap
    const x0 = cx - pairW / 2

    const incH = income  > 0 ? Math.max(3, (income  / axisMax) * ch) : 0
    const expH = expense > 0 ? Math.max(3, (expense / axisMax) * ch) : 0

    if (incH > 0) {
      const iy = (mt + ch - incH).toFixed(1)
      svg += `<rect x="${x0.toFixed(1)}" y="${iy}" width="${barW}" height="${incH.toFixed(1)}" fill="#22c55e" rx="3"/>`
    }
    if (expH > 0) {
      const ey = (mt + ch - expH).toFixed(1)
      svg += `<rect x="${(x0 + barW + gap).toFixed(1)}" y="${ey}" width="${barW}" height="${expH.toFixed(1)}" fill="#ef4444" rx="3"/>`
    }

    svg += `<text x="${cx.toFixed(1)}" y="${mt + ch + 17}" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">${label}</text>`
  }

  // Bottom axis line
  svg += `<line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#cbd5e1" stroke-width="1.5"/>`

  // Legend
  const lx = vw / 2 - 65
  const ly = vh - 10
  svg += `<rect x="${lx}" y="${ly - 8}" width="11" height="11" fill="#22c55e" rx="2"/>`
  svg += `<text x="${lx + 15}" y="${ly}" font-size="9.5" fill="#64748b" font-family="Helvetica,Arial,sans-serif">Ingresos</text>`
  svg += `<rect x="${lx + 88}" y="${ly - 8}" width="11" height="11" fill="#ef4444" rx="2"/>`
  svg += `<text x="${lx + 102}" y="${ly}" font-size="9.5" fill="#64748b" font-family="Helvetica,Arial,sans-serif">Gastos</text>`

  svg += '</svg>'
  return svg
}

// ── CONFIDENCIAL watermark ────────────────────────────────────────────────────

const WATERMARK = `<div style="
  position:absolute; top:50%; left:50%;
  transform:translate(-50%,-50%) rotate(-38deg);
  font-size:72px; font-weight:900; letter-spacing:10px;
  color:rgba(30,45,74,0.04); white-space:nowrap;
  pointer-events:none; user-select:none; z-index:9999;
  font-family:Helvetica,sans-serif;">CONFIDENCIAL</div>`

// ── Page header ───────────────────────────────────────────────────────────────

function pageHeader(logoUri: string, dateFrom: string, dateTo: string, today: string): string {
  const periodFrom = fmtDateLong(dateFrom)
  const periodTo   = fmtDateLong(dateTo)
  const imgOrText  = logoUri
    ? `<img src="${logoUri}" style="height:26px;width:auto;display:block;" alt="Platomico"/>`
    : `<span style="font-size:15px;font-weight:800;color:#0f172a;">Platomico.</span>`
  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:12px;margin-bottom:20px;border-bottom:2.5px solid #1e2d4a;">
      ${imgOrText}
      <div style="text-align:right;">
        <div style="font-size:15px;font-weight:800;color:#1e2d4a;letter-spacing:-0.3px;">Informe Financiero Ejecutivo</div>
        <div style="font-size:9px;color:#64748b;margin-top:3px;">Período: ${periodFrom} — ${periodTo}</div>
        <div style="font-size:8.5px;color:#94a3b8;margin-top:1px;">Generado: Madrid, ${fmtDateLong(today)}</div>
      </div>
    </div>`
}

// ── KPI card — large number, no uppercase tracking ────────────────────────────

function kpiCard(label: string, value: string, color: string, prefix = ''): string {
  const valLen = (prefix + value).length
  const fontSize = valLen > 14 ? '13' : valLen > 11 ? '16' : '20'
  return `
    <div style="border:1.5px solid #e8eef6;border-radius:12px;padding:20px 16px 18px;background:#fff;min-height:90px;">
      <div style="font-size:9px;color:#94a3b8;margin-bottom:10px;font-weight:500;line-height:1.3;">${label}</div>
      <div style="font-size:${fontSize}px;font-weight:800;color:${color};font-family:'Courier New',monospace;line-height:1.1;letter-spacing:-0.5px;">${prefix}${value}</div>
    </div>`
}

// ── Page 1: Overview ──────────────────────────────────────────────────────────

function buildPage1(
  transactions: CashflowTransaction[],
  invoices: Invoice[],
  dateFrom: string,
  dateTo: string,
  today: string,
  logoUri: string,
): string {
  // ── Mirror IncomeExpenseChart filtering exactly ───────────────────────────────
  // Skip 'Traspaso interno' and 'Préstamos'; use t.type for income/expense
  const operational = transactions.filter(
    t => t.category !== 'Traspaso interno' && t.category !== 'Préstamos',
  )
  const totalIncome  = operational
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const totalExpense = operational
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Math.abs(t.amount), 0)
  const netBalance = totalIncome - totalExpense

  const loanRows    = transactions.filter(t => t.category === 'Préstamos')
  const loanIn      = loanRows.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const loanOut     = loanRows.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)
  const loanPending = loanIn - loanOut

  const facturasPendientes = invoices
    .filter(i => i.status === 'issued' || i.status === 'overdue')
    .reduce((s, i) => s + i.amountTotal, 0)

  // ── Monthly buckets — same operational filter ─────────────────────────────────
  const monthMap = new Map<string, { income: number; expense: number }>()
  for (const t of operational) {
    const mk = t.date.substring(0, 7)
    const e = monthMap.get(mk) ?? { income: 0, expense: 0 }
    if (t.type === 'income') e.income  += t.amount
    else                     e.expense += Math.abs(t.amount)
    monthMap.set(mk, e)
  }
  const sortedMonths = Array.from(monthMap.keys()).sort()
  const multiYear = sortedMonths.length > 0 &&
    sortedMonths[0].substring(0, 4) !== sortedMonths[sortedMonths.length - 1].substring(0, 4)
  const monthBars: MonthBars[] = sortedMonths.map(mk => ({
    label: fmtMonthLabel(mk, multiYear),
    ...monthMap.get(mk)!,
  }))

  const netColor  = netBalance >= 0 ? '#22c55e' : '#ef4444'
  const netPrefix = netBalance >= 0 ? '+' : '−'
  const NAVY = '#1e2d4a'

  return `
<div style="break-after:page;position:relative;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#0f172a;">
  <div style="position:relative;">
    ${pageHeader(logoUri, dateFrom, dateTo, today)}

    <!-- KPI strip: 5 cards, big number, no uppercase tracking -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:22px;">
      ${kpiCard('Saldo neto',           fmt(Math.abs(netBalance)), netColor, netPrefix)}
      ${kpiCard('Ingresos',             fmt(totalIncome),          '#22c55e', '+')}
      ${kpiCard('Gastos',               fmt(totalExpense),         '#ef4444')}
      ${kpiCard('Fact. por cobrar',     fmt(facturasPendientes),   NAVY)}
      ${kpiCard('Préstamos pendientes', fmt(Math.max(0, loanPending)), loanPending > 0 ? '#f97316' : NAVY)}
    </div>

    <!-- Bar chart — fills remaining page space -->
    <div>
      <div style="font-size:9px;font-weight:600;color:#94a3b8;margin-bottom:10px;letter-spacing:0.3px;">Evolución mensual · ingresos vs gastos operativos</div>
      <div style="background:#fff;border:1.5px solid #e8eef6;border-radius:12px;padding:16px 14px;">
        ${buildBarChartSvg(monthBars)}
      </div>
    </div>
  </div>
  ${WATERMARK}
</div>`
}

// ── Page 2: Expense breakdown ─────────────────────────────────────────────────

function buildPage2(
  transactions: CashflowTransaction[],
  dateFrom: string,
  dateTo: string,
  today: string,
  logoUri: string,
): string {
  // ── Mirror ExpenseCategoryDonut filtering exactly ─────────────────────────────
  // t.type === 'expense', exclude 'Traspaso interno' and 'Préstamos'
  const expenseTxs = transactions.filter(
    t => t.type === 'expense' &&
         t.category !== 'Traspaso interno' &&
         t.category !== 'Préstamos',
  )

  const catMap = new Map<string, number>()
  for (const t of expenseTxs) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + Math.abs(t.amount))
  }
  const totalOperational = Array.from(catMap.values()).reduce((s, v) => s + v, 0)

  const slices: CatSlice[] = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name, amount,
      pct: totalOperational > 0 ? (amount / totalOperational) * 100 : 0,
      color: catColor(name),
    }))

  // Loans — use t.type for correct sign
  const loanRows    = transactions.filter(t => t.category === 'Préstamos')
  const loanIn      = loanRows.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const loanOut     = loanRows.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)
  const loanPending = loanIn - loanOut

  const donutSvg = buildDonutSvg(slices, totalOperational)

  // ── Operational expense rows ──────────────────────────────────────────────────
  const opRows = slices.map(s => {
    const barPct = Math.max(3, Math.round(s.pct))
    return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;align-items:center;gap:7px;">
            <div style="width:9px;height:9px;border-radius:2px;background:${s.color};flex-shrink:0;"></div>
            <span style="font-size:9px;color:#334155;">${s.name}</span>
          </div>
        </td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#0f172a;white-space:nowrap;min-width:90px;">${fmt(s.amount)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:8.5px;color:#94a3b8;white-space:nowrap;min-width:38px;">${s.pct.toFixed(1)}%</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;min-width:80px;">
          <div style="height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;">
            <div style="height:100%;width:${barPct}%;background:${s.color};border-radius:5px;min-width:3px;"></div>
          </div>
        </td>
      </tr>`
  }).join('')

  // ── Loans section — label in col 1, amount in col 2, cols 3-4 empty ──────────
  const hasLoans = loanIn > 0 || loanOut > 0
  const loanSectionRows = hasLoans ? `
    <tr>
      <td colspan="4" style="padding:14px 10px 4px;background:#fff;">
        <div style="font-size:8px;font-weight:700;color:#94a3b8;border-bottom:1.5px solid #e8eef6;padding-bottom:6px;">PRÉSTAMOS</div>
      </td>
    </tr>
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:9px;color:#334155;">Préstamos recibidos</span>
      </td>
      <td style="padding:7px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#22c55e;white-space:nowrap;min-width:90px;">+${fmt(loanIn)}</td>
      <td colspan="2" style="border-bottom:1px solid #f1f5f9;"></td>
    </tr>
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:9px;color:#334155;">Préstamos devueltos</span>
      </td>
      <td style="padding:7px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#ef4444;white-space:nowrap;min-width:90px;">−${fmt(loanOut)}</td>
      <td colspan="2" style="border-bottom:1px solid #f1f5f9;"></td>
    </tr>
    <tr>
      <td style="padding:7px 10px;">
        <span style="font-size:9px;font-weight:600;color:#334155;">Pendiente devolver</span>
      </td>
      <td style="padding:7px 12px;text-align:right;font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#f97316;white-space:nowrap;min-width:90px;">${fmt(Math.max(0, loanPending))}</td>
      <td colspan="2"></td>
    </tr>` : ''

  const tableHeader = `
    <tr style="background:#1e2d4a;">
      <th style="padding:8px 10px;color:#fff;font-size:8px;font-weight:700;text-align:left;white-space:nowrap;">Categoría</th>
      <th style="padding:8px 12px;color:#fff;font-size:8px;font-weight:700;text-align:right;white-space:nowrap;min-width:90px;">Importe</th>
      <th style="padding:8px 8px;color:#fff;font-size:8px;font-weight:700;text-align:right;white-space:nowrap;min-width:38px;">%</th>
      <th style="padding:8px 10px;color:#fff;font-size:8px;font-weight:700;text-align:left;white-space:nowrap;min-width:80px;">Barra</th>
    </tr>`

  const opSectionHeader = `
    <tr>
      <td colspan="4" style="padding:8px 10px 4px;background:#fff;">
        <div style="font-size:8px;font-weight:700;color:#94a3b8;border-bottom:1.5px solid #e8eef6;padding-bottom:6px;">GASTOS OPERATIVOS</div>
      </td>
    </tr>`

  return `
<div style="position:relative;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#0f172a;">
  <div style="position:relative;">
    ${pageHeader(logoUri, dateFrom, dateTo, today)}

    <!-- Donut (40%) + table (60%) — tight, no empty space -->
    <div style="display:grid;grid-template-columns:38% 62%;gap:24px;align-items:start;">

      <!-- LEFT: donut fills column -->
      <div>
        ${donutSvg}
        <div style="font-size:8px;color:#94a3b8;margin-top:6px;text-align:center;line-height:1.5;">
          Gastos operativos por categoría<br/>
          <span style="color:#cbd5e1;">excl. traspasos y préstamos</span>
        </div>
      </div>

      <!-- RIGHT: unified table -->
      <div>
        ${slices.length > 0 || hasLoans ? `
        <table style="width:100%;border-collapse:collapse;table-layout:auto;">
          <thead>${tableHeader}</thead>
          <tbody>
            ${slices.length > 0 ? opSectionHeader + opRows : ''}
            ${loanSectionRows}
          </tbody>
        </table>` : '<div style="font-size:9px;color:#94a3b8;padding:12px 0;">Sin datos en el período.</div>'}
      </div>

    </div>
  </div>
  ${WATERMARK}
</div>`
}

// ── Page 3: Previsión de Cobros ───────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.round((new Date(isoB).getTime() - new Date(isoA).getTime()) / 86_400_000)
}

/** "YYYY-MM-DD" → "15 may 26" (compact for tight columns) */
function fmtDateCompact(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${String(Number(d)).padStart(2, '0')} ${MONTH_SHORT[Number(m) - 1].toLowerCase()} ${y.slice(2)}`
}

// Avoid-break wrapper — prevents any block from being sliced across pages
const AV = 'break-inside:avoid;page-break-inside:avoid;'

// Section header (coloured left border) wrapped in break-avoid
function sectionHeader(label: string, color: string): string {
  return `<div style="${AV}display:flex;align-items:center;gap:8px;margin-bottom:10px;margin-top:20px;">
    <div style="width:3px;height:14px;background:${color};border-radius:2px;flex-shrink:0;"></div>
    <div style="font-size:8.5px;font-weight:700;color:#1e2d4a;letter-spacing:0.5px;">${label}</div>
  </div>`
}

// Table header row (dark navy), optional tight padding for narrow columns
function thRow(cols: string[], tight = false): string {
  const p = tight ? '6px 5px' : '7px 9px'
  return `<tr style="background:#1e2d4a;">${
    cols.map(c => `<th style="padding:${p};color:#fff;font-size:7.5px;font-weight:700;text-align:left;white-space:nowrap;">${c}</th>`).join('')
  }</tr>`
}

function emptyState(msg: string): string {
  return `<div style="padding:16px 12px;font-size:8.5px;color:#94a3b8;font-style:italic;">${msg}</div>`
}

/**
 * Given a presupuesto + dealById map, returns { fixed, feeRate }.
 * fixed   = plan fixed fee × locations + addons + datafono (from economics snapshot)
 * feeRate = plan.variableFee (€/order), or null when no deal/plan is configured
 */
function getOfferBreakdown(
  p: Presupuesto,
  dealById: Map<string, Deal>,
): { fixed: number; feeRate: number | null } {
  if (!p.dealId) return { fixed: p.amountNet, feeRate: null }
  const deal = dealById.get(p.dealId)
  const cfg  = deal?.configurations[0]
  if (!cfg) return { fixed: p.amountNet, feeRate: null }

  const plan      = PLANS[cfg.plan]
  const eco       = cfg.economics
  const fixedBase = Math.ceil(plan.priceMonthly * cfg.locations)
  const fixed     = fixedBase + eco.addonFeeMonthly + eco.datafonoFeeMonthly

  return { fixed, feeRate: plan.variableFee ?? null }
}

function buildPage3(
  invoices: Invoice[],
  presupuestos: Presupuesto[],
  deals: Deal[],
  dateFrom: string,
  dateTo: string,
  today: string,
  logoUri: string,
): string {
  // ── Deal lookup ───────────────────────────────────────────────────────────────
  const dealById = new Map<string, Deal>(deals.map(d => [d.id, d]))

  /**
   * Display name for a client: use brandName when it's distinct from company.name,
   * otherwise use company.name. Falls back to the invoice/presupuesto clientName
   * when there is no linked deal.
   */
  function displayNameFor(dealId: string | null, fallback: string): string {
    if (!dealId) return fallback
    const d = dealById.get(dealId)
    if (!d) return fallback
    const brand = d.company.brandName
    if (brand && brand.trim() !== d.company.name.trim()) return brand.trim()
    return d.company.name
  }

  // ── 1. Facturas vencidas ──────────────────────────────────────────────────────
  const overdueInvoices = invoices
    .filter(i => i.status === 'overdue')
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))

  // ── 2. Facturas emitidas ──────────────────────────────────────────────────────
  const issuedInvoices = invoices
    .filter(i => i.status === 'issued')
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))

  // ── 3. Ofertas aceptadas ──────────────────────────────────────────────────────
  const acceptedOffers = presupuestos
    .filter(p => p.status === 'accepted')
    .sort((a, b) => b.amountTotal - a.amountTotal)

  // ── 4. Ofertas enviadas ───────────────────────────────────────────────────────
  const sentOffers = presupuestos
    .filter(p => p.status === 'sent')
    .sort((a, b) => b.amountTotal - a.amountTotal)

  // ── Pre-compute offer breakdowns ──────────────────────────────────────────────
  const acceptedBreakdowns = acceptedOffers.map(p => getOfferBreakdown(p, dealById))
  const sentBreakdowns     = sentOffers.map(p => getOfferBreakdown(p, dealById))

  // ── Totals ────────────────────────────────────────────────────────────────────
  const totalOverdue       = overdueInvoices.reduce((s, i) => s + i.amountTotal, 0)
  const totalIssued        = issuedInvoices.reduce((s, i) => s + i.amountTotal, 0)
  const totalAccepted      = acceptedBreakdowns.reduce((s, b) => s + b.fixed, 0)
  const totalSent          = sentBreakdowns.reduce((s, b) => s + b.fixed, 0)

  // confirmed = facturas + aceptadas; potential = confirmed + en negociación
  const totalConfirmed = totalOverdue + totalIssued + totalAccepted
  const totalPotential = totalConfirmed + totalSent

  // ── Invoice row renderer ──────────────────────────────────────────────────────
  function invoiceRow(inv: Invoice, extraCol: string): string {
    const client = displayNameFor(inv.dealId, inv.clientName)
    return `
      <tr style="${AV}">
        <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-family:'Courier New',monospace;font-size:8px;white-space:nowrap;">${esc(inv.number)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(client)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;font-size:8px;font-weight:700;color:#0f172a;white-space:nowrap;">${fmt(inv.amountTotal)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-size:8px;white-space:nowrap;">${extraCol}</td>
      </tr>`
  }

  // ── Offer row renderer (Fijo + Fee/pedido) ────────────────────────────────────
  function offerRows(
    offers: Presupuesto[],
    breakdowns: ReturnType<typeof getOfferBreakdown>[],
    tight: boolean,
    withExpiry: boolean,
  ): string {
    const pad = tight ? '4px 5px' : '4px 8px'
    const fs  = tight ? '7.5px' : '8px'
    return offers.map((offer, i) => {
      const { fixed, feeRate } = breakdowns[i]
      const client   = displayNameFor(offer.dealId, offer.clientName)
      const rateText = feeRate !== null
        ? feeRate.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/ped.'
        : '—'
      const rateCell = feeRate !== null
        ? `<span style="font-size:${fs};color:#64748b;">${rateText}</span>`
        : `<span style="color:#cbd5e1;">—</span>`
      const expiryCell = withExpiry
        ? `<td style="padding:${pad};border-bottom:1px solid #f1f5f9;font-size:${fs};color:#94a3b8;white-space:nowrap;">${offer.validUntil ? fmtDateCompact(offer.validUntil.substring(0, 10)) : '—'}</td>`
        : ''
      return `
        <tr style="${AV}">
          <td style="padding:${pad};border-bottom:1px solid #f1f5f9;font-family:'Courier New',monospace;font-size:${fs};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(offer.number)}</td>
          <td style="padding:${pad};border-bottom:1px solid #f1f5f9;font-size:${fs};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(client)}</td>
          <td style="padding:${pad};border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;font-size:${fs};font-weight:700;color:#0f172a;white-space:nowrap;">${fmt(fixed)}</td>
          <td style="padding:${pad};border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;">${rateCell}</td>
          ${expiryCell}
        </tr>`
    }).join('')
  }

  // ── Overdue invoices block ────────────────────────────────────────────────────
  const overdueBlock = `
    <div style="${AV}border:1.5px solid #ef4444;border-radius:10px;overflow:hidden;">
      <div style="background:#fef2f2;padding:10px 12px;border-bottom:1px solid #fecaca;">
        <div style="font-size:8.5px;font-weight:700;color:#dc2626;">Facturas vencidas</div>
        ${overdueInvoices.length > 0
          ? `<div style="font-size:8px;color:#ef4444;margin-top:2px;">${overdueInvoices.length} factura${overdueInvoices.length > 1 ? 's' : ''} · ${fmt(totalOverdue)}</div>`
          : ''}
      </div>
      ${overdueInvoices.length === 0
        ? emptyState('Sin facturas vencidas')
        : `<table style="width:100%;border-collapse:collapse;table-layout:auto;">
          <thead>${thRow(['Nº', 'Cliente', 'Importe', 'Vencida'])}</thead>
          <tbody>${overdueInvoices.map(inv => {
            const days = inv.dueAt ? daysBetween(inv.dueAt, today) : 0
            return invoiceRow(inv, `<span style="color:#ef4444;font-weight:700;">${days}d</span>`)
          }).join('')}</tbody>
        </table>`}
    </div>`

  // ── Issued invoices block ─────────────────────────────────────────────────────
  const issuedBlock = `
    <div style="${AV}border:1.5px solid #1e2d4a;border-radius:10px;overflow:hidden;">
      <div style="background:#f0f4f8;padding:10px 12px;border-bottom:1px solid #cbd5e1;">
        <div style="font-size:8.5px;font-weight:700;color:#1e2d4a;">Facturas emitidas</div>
        ${issuedInvoices.length > 0
          ? `<div style="font-size:8px;color:#475569;margin-top:2px;">${issuedInvoices.length} factura${issuedInvoices.length > 1 ? 's' : ''} · ${fmt(totalIssued)}</div>`
          : ''}
      </div>
      ${issuedInvoices.length === 0
        ? emptyState('Sin facturas emitidas pendientes')
        : `<table style="width:100%;border-collapse:collapse;table-layout:auto;">
          <thead>${thRow(['Nº', 'Cliente', 'Importe', 'Vence el'])}</thead>
          <tbody>${issuedInvoices.map(inv => {
            const dueLabel = inv.dueAt ? fmtDateCompact(inv.dueAt.substring(0, 10)) : '—'
            return invoiceRow(inv, dueLabel)
          }).join('')}</tbody>
        </table>`}
    </div>`

  // ── Accepted offers block — Columns: Nº | Cliente | Fijo | Fee/pedido ──────────
  const acceptedBlock = `
    <div style="${AV}border:1.5px solid #22c55e;border-radius:10px;overflow:hidden;">
      <div style="background:#f0fdf4;padding:10px 12px;border-bottom:1px solid #bbf7d0;">
        <div style="font-size:8.5px;font-weight:700;color:#15803d;">Aceptadas · pendientes de facturar</div>
        ${acceptedOffers.length > 0
          ? `<div style="font-size:8px;color:#16a34a;margin-top:2px;">${acceptedOffers.length} oferta${acceptedOffers.length > 1 ? 's' : ''} · ${fmt(totalAccepted)}</div>`
          : ''}
      </div>
      ${acceptedOffers.length === 0
        ? emptyState('Sin ofertas aceptadas')
        : `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <colgroup>
            <col style="width:70px;"/>
            <col/>
            <col style="width:80px;"/>
            <col style="width:72px;"/>
          </colgroup>
          <thead>${thRow(['Nº oferta', 'Cliente', 'Fijo', 'Fee/pedido'])}</thead>
          <tbody>${offerRows(acceptedOffers, acceptedBreakdowns, false, false)}</tbody>
        </table>`}
    </div>`

  // ── Sent offers block — Columns: Nº | Cliente | Fijo | Fee/pedido | Expira ─────
  const sentBlock = `
    <div style="${AV}border:1.5px solid #cbd5e1;border-radius:10px;overflow:hidden;">
      <div style="background:#f8fafc;padding:10px 12px;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:8.5px;font-weight:700;color:#475569;">En negociación</div>
        ${sentOffers.length > 0
          ? `<div style="font-size:8px;color:#94a3b8;margin-top:2px;">${sentOffers.length} oferta${sentOffers.length > 1 ? 's' : ''} · ${fmt(totalSent)}</div>`
          : ''}
      </div>
      ${sentOffers.length === 0
        ? emptyState('Sin ofertas enviadas activas')
        : `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <colgroup>
            <col style="width:64px;"/>
            <col/>
            <col style="width:72px;"/>
            <col style="width:68px;"/>
            <col style="width:52px;"/>
          </colgroup>
          <thead>${thRow(['Nº oferta', 'Cliente', 'Fijo', 'Fee/pedido', 'Expira'], true)}</thead>
          <tbody>${offerRows(sentOffers, sentBreakdowns, true, true)}</tbody>
        </table>`}
    </div>`

  // ── Total Previsto summary card ───────────────────────────────────────────────
  function totalRow(label: string, value: number, color: string, indent = false): string {
    return `
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:${indent ? '3px 0 3px 12px' : '5px 0'};border-bottom:1px solid #f1f5f9;">
        <span style="font-size:${indent ? '8' : '9'}px;color:${indent ? '#94a3b8' : '#64748b'};">${label}</span>
        <span style="font-family:'Courier New',monospace;font-size:${indent ? '8.5' : '9.5'}px;font-weight:600;color:${color};">${fmt(value)}</span>
      </div>`
  }

  const totalCard = `
    <div style="${AV}background:#fff;border:1.5px solid #1e2d4a;border-radius:12px;padding:16px 18px;margin-top:20px;">
      <div style="font-size:9px;font-weight:700;color:#1e2d4a;letter-spacing:0.3px;margin-bottom:12px;padding-bottom:8px;border-bottom:1.5px solid #e8eef6;">TOTAL PREVISTO</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 32px;">
        <div>
          ${totalRow('Facturas vencidas',    totalOverdue,    '#ef4444')}
          ${totalRow('Facturas emitidas',    totalIssued,     '#1e2d4a')}
          ${totalRow('Ofertas aceptadas',    totalAccepted,   '#22c55e')}
          ${totalRow('Ofertas en negociación', totalSent,     '#94a3b8')}
        </div>
        <div>
          <div style="padding:10px 14px;background:#f0f4f8;border-radius:8px;margin-bottom:10px;">
            <div style="font-size:8px;color:#64748b;margin-bottom:4px;">Total confirmado</div>
            <div style="font-size:16px;font-weight:800;color:#1e2d4a;font-family:'Courier New',monospace;">${fmt(totalConfirmed)}</div>
            <div style="font-size:7.5px;color:#94a3b8;margin-top:3px;">Facturas vencidas + emitidas + aceptadas</div>
          </div>
          <div style="padding:10px 14px;background:#1e2d4a;border-radius:8px;">
            <div style="font-size:8px;color:#94a3b8;margin-bottom:4px;">Total potencial</div>
            <div style="font-size:16px;font-weight:800;color:#fff;font-family:'Courier New',monospace;">${fmt(totalPotential)}</div>
            <div style="font-size:7.5px;color:#64748b;margin-top:3px;">Confirmado + en negociación</div>
          </div>
        </div>
      </div>
    </div>`

  return `
<div style="break-before:page;position:relative;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#0f172a;">
  <div style="position:relative;">
    ${pageHeader(logoUri, dateFrom, dateTo, today)}

    <!-- Page title -->
    <div style="font-size:14px;font-weight:800;color:#1e2d4a;letter-spacing:-0.3px;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #e8eef6;">
      Previsión de Cobros
    </div>

    <!-- COBROS PENDIENTES -->
    <div style="${AV}">
      ${sectionHeader('COBROS PENDIENTES', '#ef4444')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        ${overdueBlock}
        ${issuedBlock}
      </div>
    </div>

    <!-- OFERTAS -->
    <div style="${AV}">
      ${sectionHeader('OFERTAS', '#3b82f6')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        ${acceptedBlock}
        ${sentBlock}
      </div>
    </div>

    <!-- TOTAL PREVISTO -->
    ${totalCard}

  </div>
  ${WATERMARK}
</div>`
}

// ── Full report HTML ──────────────────────────────────────────────────────────

function buildFullReport(
  transactions: CashflowTransaction[],
  invoices: Invoice[],
  presupuestos: Presupuesto[],
  deals: Deal[],
  dateFrom: string,
  dateTo: string,
  today: string,
  logoUri: string,
): string {
  const styles = `
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family:Helvetica,Arial,sans-serif;
      font-size:11px; line-height:1.5; color:#0f172a; background:#fff;
      -webkit-print-color-adjust:exact; print-color-adjust:exact;
    }`

  const p1 = buildPage1(transactions, invoices, dateFrom, dateTo, today, logoUri)
  const p2 = buildPage2(transactions, dateFrom, dateTo, today, logoUri)
  const p3 = buildPage3(invoices, presupuestos, deals, dateFrom, dateTo, today, logoUri)

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

// ── Main export ───────────────────────────────────────────────────────────────

export interface CashflowReportInput {
  transactions: CashflowTransaction[]
  invoices: Invoice[]
  presupuestos: Presupuesto[]
  deals: Deal[]
  dateFrom: string
  dateTo: string
}

export async function generateCashflowReportPdf(input: CashflowReportInput): Promise<Buffer> {
  const logoUri = readLogoDataUri()
  const today   = new Date().toISOString().split('T')[0]
  const html    = buildFullReport(
    input.transactions,
    input.invoices,
    input.presupuestos,
    input.deals,
    input.dateFrom,
    input.dateTo,
    today,
    logoUri,
  )
  return renderHtmlToPdf(html)
}
