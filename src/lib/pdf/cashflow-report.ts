// =========================================
// CASHFLOW EXECUTIVE REPORT — PDF GENERATOR
// server-only
// Two pages:
//  1. Overview — KPIs + monthly bar chart
//  2. Where the money goes — expense donut + unified category table
// =========================================

import fs from 'fs'
import path from 'path'
import type { CashflowTransaction, Invoice } from '@/types'
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
const MONTH_SHORT = ['ene','feb','mar','abr','may','jun',
  'jul','ago','sep','oct','nov','dic']

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
  'Otros':               '#94a3b8',
  'Sin categoría':       '#cbd5e1',
  'Ingreso cliente':     '#22c55e',
  'Refunds':             '#fb923c',
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
  // Larger donut to fill the 40% left column
  const cx = 140, cy = 140, outerR = 118, innerR = 74
  const vw = 280, vh = 280

  if (slices.length === 0) {
    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
      <text x="${cx}" y="${cy}" text-anchor="middle" font-size="11" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">Sin datos</text>
    </svg>`
  }

  let angle = -Math.PI / 2
  let paths = ''
  for (const s of slices) {
    const sweep = (s.amount / totalExpense) * 2 * Math.PI
    if (sweep < 0.01) { angle += sweep; continue }
    paths += `<path d="${donutSlice(cx, cy, outerR, innerR, angle, angle + sweep)}" fill="${s.color}" stroke="white" stroke-width="2"/>\n`
    angle += sweep
  }

  const totalLabel = fmtK(totalExpense)
  const centerText = `
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" font-size="13" font-weight="800" fill="#1e2d4a" font-family="Helvetica,Arial,sans-serif">${totalLabel} €</text>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="9.5" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">Total gastos</text>
    <text x="${cx}" y="${cy + 21}" text-anchor="middle" font-size="8.5" fill="#cbd5e1" font-family="Helvetica,Arial,sans-serif">operativos</text>`

  return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">${paths}${centerText}</svg>`
}

// ── SVG: Monthly bar chart (with optional dual Y-axis) ────────────────────────

interface MonthBars { label: string; income: number; expense: number }

// Threshold: use dual axis when one side < 20% of the other
const DUAL_AXIS_RATIO = 0.2

function buildBarChartSvg(months: MonthBars[]): string {
  const vw = 600, vh = 340
  const ml = 60, mr = 60, mt = 16, mb = 42
  const cw = vw - ml - mr
  const ch = vh - mt - mb

  if (months.length === 0) {
    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;"></svg>`
  }

  const maxIncome  = Math.max(...months.map(m => m.income), 0)
  const maxExpense = Math.max(...months.map(m => m.expense), 0)

  const dualAxis = maxIncome > 0 && maxExpense > 0 && (
    maxIncome / maxExpense < DUAL_AXIS_RATIO ||
    maxExpense / maxIncome < DUAL_AXIS_RATIO
  )

  // Left axis = expenses, Right axis = income (when dual)
  const axisMaxExp = niceMax(dualAxis ? maxExpense : Math.max(maxIncome, maxExpense, 1))
  const axisMaxInc = dualAxis ? niceMax(maxIncome) : axisMaxExp

  const n = months.length
  const groupW = cw / n
  const barW = Math.max(6, Math.min(Math.floor(groupW * 0.45), 36))
  const gap = 5

  // 4 grid lines at 0%, 33%, 67%, 100% of left axis
  const ticks = [0, axisMaxExp / 3, (axisMaxExp * 2) / 3, axisMaxExp]

  let svg = `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">`

  // Background
  svg += `<rect x="${ml}" y="${mt}" width="${cw}" height="${ch}" fill="#f8fafc" rx="6"/>`

  // Grid lines + left Y labels (expense axis)
  for (const tick of ticks) {
    const y = (mt + ch - (tick / axisMaxExp) * ch).toFixed(1)
    svg += `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="${tick === 0 ? 'none' : '4,3'}"/>`
    svg += `<text x="${ml - 5}" y="${Number(y) + 3.5}" text-anchor="end" font-size="8" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">${fmtK(tick)}</text>`
  }

  // Right Y labels (income axis, only when dual)
  if (dualAxis) {
    const ticksInc = [0, axisMaxInc / 3, (axisMaxInc * 2) / 3, axisMaxInc]
    for (const tick of ticksInc) {
      const y = (mt + ch - (tick / axisMaxInc) * ch).toFixed(1)
      svg += `<text x="${ml + cw + 5}" y="${Number(y) + 3.5}" text-anchor="start" font-size="8" fill="#22c55e" font-family="Helvetica,Arial,sans-serif">${fmtK(tick)}</text>`
    }
    // Right axis label
    svg += `<text x="${ml + cw + 55}" y="${mt + ch / 2}" text-anchor="middle" font-size="7.5" fill="#22c55e" font-family="Helvetica,Arial,sans-serif" transform="rotate(-90,${ml + cw + 55},${mt + ch / 2})">Ingresos</text>`
  }

  // Bars
  for (let i = 0; i < n; i++) {
    const { label, income, expense } = months[i]
    const cx = ml + i * groupW + groupW / 2
    const pairW = 2 * barW + gap
    const x0 = cx - pairW / 2

    // Income bar — scale by income axis
    const incScale = dualAxis ? axisMaxInc : axisMaxExp
    const incH = income > 0 ? Math.max(3, (income / incScale) * ch) : 0
    if (incH > 0) {
      const iy = (mt + ch - incH).toFixed(1)
      svg += `<rect x="${x0.toFixed(1)}" y="${iy}" width="${barW}" height="${incH.toFixed(1)}" fill="#22c55e" rx="3"/>`
    }

    // Expense bar — scale by expense axis
    const expH = expense > 0 ? Math.max(3, (expense / axisMaxExp) * ch) : 0
    if (expH > 0) {
      const ey = (mt + ch - expH).toFixed(1)
      svg += `<rect x="${(x0 + barW + gap).toFixed(1)}" y="${ey}" width="${barW}" height="${expH.toFixed(1)}" fill="#ef4444" rx="3"/>`
    }

    // X label
    svg += `<text x="${cx.toFixed(1)}" y="${mt + ch + 16}" text-anchor="middle" font-size="8.5" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">${label}</text>`
  }

  // Bottom axis line
  svg += `<line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#cbd5e1" stroke-width="1.5"/>`

  // Legend
  const lx = vw / 2 - 62
  const ly = vh - 10
  svg += `<rect x="${lx}" y="${ly - 8}" width="10" height="10" fill="#22c55e" rx="2"/>`
  svg += `<text x="${lx + 14}" y="${ly}" font-size="9" fill="#64748b" font-family="Helvetica,Arial,sans-serif">Ingresos${dualAxis ? ' (eje dcho.)' : ''}</text>`
  svg += `<rect x="${lx + 90}" y="${ly - 8}" width="10" height="10" fill="#ef4444" rx="2"/>`
  svg += `<text x="${lx + 104}" y="${ly}" font-size="9" fill="#64748b" font-family="Helvetica,Arial,sans-serif">Gastos</text>`

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

// ── KPI card — no subtitle, large number ─────────────────────────────────────

function kpiCard(label: string, value: string, color: string, prefix = ''): string {
  const fontSize = value.length > 12 ? '14' : value.length > 9 ? '16' : '19'
  return `
    <div style="border:1.5px solid #e8eef6;border-radius:12px;padding:18px 16px 16px;background:#fff;">
      <div style="font-size:7.5px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;margin-bottom:10px;font-weight:700;">${label}</div>
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
  const operational = transactions.filter(
    t => t.category !== 'Traspaso interno' && t.category !== 'Préstamos',
  )
  const totalIncome  = operational.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpense = operational.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const netBalance   = totalIncome - totalExpense

  const loanRows    = transactions.filter(t => t.category === 'Préstamos')
  const loanIn      = loanRows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const loanOut     = loanRows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const loanPending = loanIn - loanOut

  const facturasPendientes = invoices
    .filter(i => i.status === 'issued' || i.status === 'overdue')
    .reduce((s, i) => s + i.amountTotal, 0)

  // Monthly bar chart data (operational only)
  const monthMap = new Map<string, { income: number; expense: number }>()
  for (const t of operational) {
    const mk = t.date.substring(0, 7)
    const e = monthMap.get(mk) ?? { income: 0, expense: 0 }
    if (t.amount > 0) e.income  += t.amount
    else              e.expense += Math.abs(t.amount)
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

  const content = `
    ${pageHeader(logoUri, dateFrom, dateTo, today)}

    <!-- KPI strip — 5 cards, no subtitles -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:24px;">
      ${kpiCard('Saldo neto',          fmt(Math.abs(netBalance)), netColor, netPrefix)}
      ${kpiCard('Ingresos',            fmt(totalIncome),          '#22c55e', '+')}
      ${kpiCard('Gastos',              fmt(totalExpense),         '#ef4444')}
      ${kpiCard('Fact. por cobrar',    fmt(facturasPendientes),   NAVY)}
      ${kpiCard('Préstamos pendientes',fmt(Math.max(0, loanPending)), loanPending > 0 ? '#f97316' : NAVY)}
    </div>

    <!-- Monthly bar chart — ~55-60% of page height -->
    <div>
      <div style="font-size:8.5px;font-weight:700;color:#1e2d4a;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;">Evolución mensual · ingresos vs gastos</div>
      <div style="background:#fff;border:1.5px solid #e8eef6;border-radius:12px;padding:16px 14px;">
        ${buildBarChartSvg(monthBars)}
      </div>
    </div>`

  return `
<div style="break-after:page;position:relative;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#0f172a;padding:0;">
  <div style="position:relative;">${content}</div>
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
  // Operational expenses: exclude Traspaso interno and Préstamos
  const EXCLUDE_CATS = new Set(['Traspaso interno', 'Préstamos'])
  const expenseTxs = transactions.filter(
    t => t.amount < 0 && !EXCLUDE_CATS.has(t.category),
  )

  // Group by category, sorted desc
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

  // Loans
  const loanRows    = transactions.filter(t => t.category === 'Préstamos')
  const loanIn      = loanRows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const loanOut     = loanRows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const loanPending = loanIn - loanOut

  const donutSvg = buildDonutSvg(slices, totalOperational)

  // ── Operational expense rows
  const opRows = slices.map(s => {
    const barPct = Math.max(2, Math.round(s.pct))
    return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;align-items:center;gap:7px;">
            <div style="width:9px;height:9px;border-radius:2px;background:${s.color};flex-shrink:0;"></div>
            <span style="font-size:9px;color:#334155;">${s.name}</span>
          </div>
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#0f172a;white-space:nowrap;">${fmt(s.amount)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:8.5px;color:#94a3b8;white-space:nowrap;">${s.pct.toFixed(1)}%</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;width:90px;">
          <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${barPct}%;background:${s.color};border-radius:4px;"></div>
          </div>
        </td>
      </tr>`
  }).join('')

  // ── Loans section rows (no bar column)
  const hasLoans = loanIn > 0 || loanOut > 0
  const loanSectionRows = hasLoans ? `
    <tr>
      <td colspan="4" style="padding:14px 10px 6px;background:#fff;">
        <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;border-bottom:1.5px solid #e8eef6;padding-bottom:6px;">Préstamos</div>
      </td>
    </tr>
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;" colspan="2">
        <span style="font-size:9px;color:#334155;">Préstamos recibidos</span>
      </td>
      <td colspan="2" style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#22c55e;white-space:nowrap;">+${fmt(loanIn)}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;" colspan="2">
        <span style="font-size:9px;color:#334155;">Préstamos devueltos</span>
      </td>
      <td colspan="2" style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#ef4444;white-space:nowrap;">−${fmt(loanOut)}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px;" colspan="2">
        <span style="font-size:9px;color:#334155;font-weight:600;">Pendiente devolver</span>
      </td>
      <td colspan="2" style="padding:6px 10px;text-align:right;font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#f97316;white-space:nowrap;">${fmt(Math.max(0, loanPending))}</td>
    </tr>` : ''

  const tableHeader = `
    <tr>
      <th style="padding:7px 10px;background:#1e2d4a;color:#fff;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left;border-radius:0;">Categoría</th>
      <th style="padding:7px 10px;background:#1e2d4a;color:#fff;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:right;">Importe</th>
      <th style="padding:7px 10px;background:#1e2d4a;color:#fff;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:right;">%</th>
      <th style="padding:7px 10px;background:#1e2d4a;color:#fff;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left;width:90px;">Proporción</th>
    </tr>`

  const opSectionHeader = `
    <tr>
      <td colspan="4" style="padding:0 10px 6px;background:#fff;">
        <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;border-bottom:1.5px solid #e8eef6;padding-bottom:6px;">Gastos operativos</div>
      </td>
    </tr>`

  const content = `
    ${pageHeader(logoUri, dateFrom, dateTo, today)}

    <!-- Donut (40%) + table (60%) -->
    <div style="display:grid;grid-template-columns:40% 60%;gap:28px;align-items:start;">

      <!-- LEFT: donut -->
      <div style="display:flex;flex-direction:column;align-items:center;padding-top:4px;">
        ${donutSvg}
        <div style="font-size:8px;color:#94a3b8;margin-top:8px;text-align:center;line-height:1.5;">
          Gastos operativos por categoría<br/>
          <span style="color:#cbd5e1;">(excl. traspasos y préstamos)</span>
        </div>
      </div>

      <!-- RIGHT: unified table -->
      <div>
        ${slices.length > 0 || hasLoans ? `
        <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;">
          <thead>${tableHeader}</thead>
          <tbody>
            ${slices.length > 0 ? opSectionHeader + opRows : ''}
            ${loanSectionRows}
          </tbody>
        </table>` : '<div style="font-size:9px;color:#94a3b8;padding:12px 0;">Sin datos en el período.</div>'}
      </div>

    </div>`

  return `
<div style="position:relative;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#0f172a;padding:0;">
  <div style="position:relative;">${content}</div>
  ${WATERMARK}
</div>`
}

// ── Full report HTML ──────────────────────────────────────────────────────────

function buildFullReport(
  transactions: CashflowTransaction[],
  invoices: Invoice[],
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
    }
    @media print {
      .pg { break-after: page; }
      .pg:last-child { break-after: auto; }
    }`

  const p1 = buildPage1(transactions, invoices, dateFrom, dateTo, today, logoUri)
  const p2 = buildPage2(transactions, dateFrom, dateTo, today, logoUri)

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><style>${styles}</style></head>
<body>
${p1}
${p2}
</body>
</html>`
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface CashflowReportInput {
  transactions: CashflowTransaction[]
  invoices: Invoice[]
  dateFrom: string
  dateTo: string
}

export async function generateCashflowReportPdf(input: CashflowReportInput): Promise<Buffer> {
  const logoUri = readLogoDataUri()
  const today   = new Date().toISOString().split('T')[0]
  const html    = buildFullReport(
    input.transactions,
    input.invoices,
    input.dateFrom,
    input.dateTo,
    today,
    logoUri,
  )
  return renderHtmlToPdf(html)
}
