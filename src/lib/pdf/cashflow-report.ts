// =========================================
// CASHFLOW EXECUTIVE REPORT — PDF GENERATOR
// server-only
// Two pages:
//  1. Overview — KPIs + monthly bar chart
//  2. Where the money goes — expense donut + category table
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
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return String(Math.round(n))
}

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

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
  // Clamp to avoid full-circle edge case (gap of 0.001 radians)
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
  const cx = 110, cy = 110, outerR = 90, innerR = 56
  const vw = 220, vh = 220

  if (slices.length === 0) {
    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:${vw}px;height:${vh}px;">
      <text x="${cx}" y="${cy}" text-anchor="middle" font-size="10" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">Sin datos</text>
    </svg>`
  }

  let angle = -Math.PI / 2  // start at top
  let paths = ''
  for (const s of slices) {
    const sweep = (s.amount / totalExpense) * 2 * Math.PI
    if (sweep < 0.01) { angle += sweep; continue }
    paths += `<path d="${donutSlice(cx, cy, outerR, innerR, angle, angle + sweep)}" fill="${s.color}" stroke="white" stroke-width="1.5"/>\n`
    angle += sweep
  }

  // Centre text
  const totalLabel = fmtK(totalExpense)
  const centerText = `
    <text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e2d4a" font-family="Helvetica,Arial,sans-serif">${totalLabel} €</text>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="8" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">Total gastos</text>`

  return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:${vw}px;height:${vh}px;">${paths}${centerText}</svg>`
}

// ── SVG: Monthly bar chart ────────────────────────────────────────────────────

interface MonthBars { label: string; income: number; expense: number }

function buildBarChartSvg(months: MonthBars[]): string {
  const vw = 570, vh = 190
  const ml = 52, mr = 10, mt = 12, mb = 40
  const cw = vw - ml - mr
  const ch = vh - mt - mb

  if (months.length === 0) {
    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;"></svg>`
  }

  const maxIncome  = Math.max(...months.map(m => m.income), 0)
  const maxExpense = Math.max(...months.map(m => m.expense), 0)
  const rawMax = Math.max(maxIncome, maxExpense, 1)
  const axisMax = niceMax(rawMax)

  const n = months.length
  const groupW = cw / n
  const barW = Math.max(4, Math.min(Math.floor(groupW * 0.36), 20))
  const gap = 3

  // Grid lines at 0, 33%, 67%, 100% of axisMax
  const ticks = [0, axisMax / 3, (axisMax * 2) / 3, axisMax]

  let svg = `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">`

  // Background
  svg += `<rect x="${ml}" y="${mt}" width="${cw}" height="${ch}" fill="#f8fafc" rx="4"/>`

  // Grid lines + Y labels
  for (const tick of ticks) {
    const y = (mt + ch - (tick / axisMax) * ch).toFixed(1)
    svg += `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="#e8eef6" stroke-width="1"/>`
    svg += `<text x="${ml - 4}" y="${Number(y) + 3}" text-anchor="end" font-size="7" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">${fmtK(tick)}</text>`
  }

  // Bars + X labels
  for (let i = 0; i < n; i++) {
    const { label, income, expense } = months[i]
    const cx = ml + i * groupW + groupW / 2
    const pairW = 2 * barW + gap
    const x0 = cx - pairW / 2

    // Income bar
    const incH = income > 0 ? Math.max(2, (income / axisMax) * ch) : 0
    if (incH > 0) {
      const iy = (mt + ch - incH).toFixed(1)
      svg += `<rect x="${x0.toFixed(1)}" y="${iy}" width="${barW}" height="${incH.toFixed(1)}" fill="#22c55e" rx="2"/>`
    }

    // Expense bar
    const expH = expense > 0 ? Math.max(2, (expense / axisMax) * ch) : 0
    if (expH > 0) {
      const ey = (mt + ch - expH).toFixed(1)
      svg += `<rect x="${(x0 + barW + gap).toFixed(1)}" y="${ey}" width="${barW}" height="${expH.toFixed(1)}" fill="#ef4444" rx="2"/>`
    }

    // X label
    svg += `<text x="${cx.toFixed(1)}" y="${mt + ch + 14}" text-anchor="middle" font-size="7.5" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">${label}</text>`
  }

  // Bottom axis line
  svg += `<line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#dde6f0" stroke-width="1"/>`

  // Legend
  const lx = vw / 2 - 55
  const ly = vh - 7
  svg += `<rect x="${lx}" y="${ly - 7}" width="8" height="8" fill="#22c55e" rx="1"/>`
  svg += `<text x="${lx + 11}" y="${ly}" font-size="8" fill="#64748b" font-family="Helvetica,Arial,sans-serif">Ingresos</text>`
  svg += `<rect x="${lx + 68}" y="${ly - 7}" width="8" height="8" fill="#ef4444" rx="1"/>`
  svg += `<text x="${lx + 79}" y="${ly}" font-size="8" fill="#64748b" font-family="Helvetica,Arial,sans-serif">Gastos</text>`

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
    ? `<img src="${logoUri}" style="height:24px;width:auto;display:block;" alt="Platomico"/>`
    : `<span style="font-size:15px;font-weight:800;color:#0f172a;">Platomico.</span>`
  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:10px;margin-bottom:18px;border-bottom:2px solid #1e2d4a;">
      ${imgOrText}
      <div style="text-align:right;">
        <div style="font-size:15px;font-weight:800;color:#1e2d4a;letter-spacing:-0.3px;">Informe Financiero Ejecutivo</div>
        <div style="font-size:9px;color:#64748b;margin-top:3px;">Período: ${periodFrom} — ${periodTo}</div>
        <div style="font-size:8.5px;color:#94a3b8;margin-top:1px;">Generado: Madrid, ${fmtDateLong(today)}</div>
      </div>
    </div>`
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function kpiCard(label: string, value: string, sub: string, color: string, prefix = ''): string {
  return `
    <div style="border:1px solid #e8eef6;border-radius:10px;padding:14px 13px;background:#fff;">
      <div style="font-size:7.5px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:7px;font-weight:600;">${label}</div>
      <div style="font-size:${value.length > 10 ? '13' : '15'}px;font-weight:800;color:${color};font-family:'Courier New',monospace;line-height:1.1;">${prefix}${value}</div>
      <div style="font-size:8px;color:#94a3b8;margin-top:5px;line-height:1.4;">${sub}</div>
    </div>`
}

// ── simpleRow helper (shared with page 2) ─────────────────────────────────────

function simpleRow(label: string, value: string): string {
  return `
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f1f5f9;">
      <span style="font-size:9.5px;color:#64748b;">${label}</span>
      <span style="font-size:9.5px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${value}</span>
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

  const loanRows     = transactions.filter(t => t.category === 'Préstamos')
  const loanIn       = loanRows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const loanOut      = loanRows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const loanPending  = loanIn - loanOut

  const facturasPendientes = invoices
    .filter(i => i.status === 'issued' || i.status === 'overdue')
    .reduce((s, i) => s + i.amountTotal, 0)

  // Monthly bar chart data
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

  const content = `
    ${pageHeader(logoUri, dateFrom, dateTo, today)}

    <!-- KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:22px;">
      ${kpiCard('Saldo neto', fmt(Math.abs(netBalance)), 'Ingresos − gastos del período', netColor, netPrefix)}
      ${kpiCard('Ingresos', fmt(totalIncome), 'Transacciones positivas (sin traspasos)', '#22c55e', '+')}
      ${kpiCard('Gastos', fmt(totalExpense), 'Gastos operativos (sin traspasos ni préstamos)', '#ef4444', '')}
      ${kpiCard('Fact. por cobrar', fmt(facturasPendientes), 'Facturas emitidas + vencidas pendientes', '#1e2d4a', '')}
      ${kpiCard('Préstamos pendientes', fmt(Math.max(0, loanPending)), loanPending <= 0 ? 'Completamente devueltos' : `Recibido ${fmt(loanIn)} · Devuelto ${fmt(loanOut)}`, loanPending > 0 ? '#f97316' : '#22c55e', '')}
    </div>

    <!-- Monthly bar chart -->
    <div style="margin-bottom:8px;">
      <div style="font-size:9px;font-weight:700;color:#1e2d4a;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Evolución mensual · ingresos vs gastos</div>
      <div style="background:#fff;border:1px solid #e8eef6;border-radius:10px;padding:14px 12px;">
        ${buildBarChartSvg(monthBars)}
      </div>
    </div>

    <!-- Period summary -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px;">
      <div style="background:#f8fafc;border:1px solid #e8eef6;border-radius:8px;padding:12px 14px;">
        ${simpleRow('Ingresos totales',   fmt(totalIncome))}
        ${simpleRow('Gastos totales',     fmt(totalExpense))}
        ${simpleRow('Saldo neto',         fmt(Math.abs(netBalance)))}
      </div>
      <div style="background:#f8fafc;border:1px solid #e8eef6;border-radius:8px;padding:12px 14px;">
        ${simpleRow('Transacciones',      String(transactions.length))}
        ${simpleRow('Meses analizados',   String(sortedMonths.length))}
        ${simpleRow('Fact. por cobrar',   fmt(facturasPendientes))}
      </div>
      <div style="background:#f8fafc;border:1px solid #e8eef6;border-radius:8px;padding:12px 14px;">
        ${simpleRow('Préstamos recibidos',  fmt(loanIn))}
        ${simpleRow('Préstamos devueltos',  fmt(loanOut))}
        ${simpleRow('Pendiente devolver',   fmt(Math.max(0, loanPending)))}
      </div>
    </div>`

  return `
<div style="break-after:page;position:relative;min-height:220mm;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#0f172a;">
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
  // Expense transactions — exclude Traspaso interno, Préstamos, Refunds
  const EXCLUDE_CATS = new Set(['Traspaso interno', 'Préstamos', 'Refunds'])
  const expenseTxs = transactions.filter(
    t => t.amount < 0 && !EXCLUDE_CATS.has(t.category),
  )

  // Group by category
  const catMap = new Map<string, number>()
  for (const t of expenseTxs) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + Math.abs(t.amount))
  }
  const totalExpense = Array.from(catMap.values()).reduce((s, v) => s + v, 0)

  const slices: CatSlice[] = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      pct: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
      color: catColor(name),
    }))

  const donutSvg = buildDonutSvg(slices, totalExpense)

  // Legend entries (right of donut)
  const legendItems = slices.map(s => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f8fafc;">
      <div style="width:10px;height:10px;border-radius:2px;background:${s.color};flex-shrink:0;"></div>
      <span style="font-size:9px;color:#334155;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</span>
      <span style="font-size:9px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;white-space:nowrap;">${fmt(s.amount)}</span>
      <span style="font-size:8px;color:#94a3b8;width:32px;text-align:right;flex-shrink:0;">${s.pct.toFixed(1)}%</span>
    </div>`).join('')

  // Category table rows
  const tableRows = slices.map((s, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc'
    const barPct = Math.max(2, Math.round(s.pct))
    return `
      <tr>
        <td style="padding:6px 10px;background:${bg};border:1px solid #f0f4f8;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:8px;height:8px;border-radius:1px;background:${s.color};flex-shrink:0;"></div>
            <span style="font-size:9.5px;color:#334155;">${s.name}</span>
          </div>
        </td>
        <td style="padding:6px 10px;background:${bg};border:1px solid #f0f4f8;text-align:right;font-family:'Courier New',monospace;font-size:9.5px;font-weight:600;color:#0f172a;white-space:nowrap;">${fmt(s.amount)}</td>
        <td style="padding:6px 10px;background:${bg};border:1px solid #f0f4f8;text-align:right;font-size:9px;color:#64748b;">${s.pct.toFixed(1)}%</td>
        <td style="padding:6px 10px;background:${bg};border:1px solid #f0f4f8;width:110px;">
          <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${barPct}%;background:${s.color};border-radius:4px;"></div>
          </div>
        </td>
      </tr>`
  }).join('')

  const content = `
    ${pageHeader(logoUri, dateFrom, dateTo, today)}

    <div style="font-size:15px;font-weight:800;color:#1e2d4a;letter-spacing:-0.3px;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #e8eef6;">
      ¿Dónde va el dinero?
    </div>

    <!-- Donut + legend side by side -->
    <div style="display:grid;grid-template-columns:240px 1fr;gap:24px;align-items:start;margin-bottom:22px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        ${donutSvg}
        <div style="font-size:8px;color:#94a3b8;margin-top:6px;text-align:center;">Gastos por categoría<br/>(excl. traspasos, préstamos, refunds)</div>
      </div>
      <div style="padding-top:8px;">
        <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;display:grid;grid-template-columns:1fr auto auto;gap:0 8px;">
          <span>Categoría</span><span style="text-align:right;">Importe</span><span style="width:32px;text-align:right;">%</span>
        </div>
        ${legendItems || '<div style="font-size:9px;color:#94a3b8;padding:8px 0;">Sin gastos en el período.</div>'}
      </div>
    </div>

    <!-- Category breakdown table -->
    ${slices.length > 0 ? `
    <div style="font-size:9px;font-weight:700;color:#1e2d4a;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Detalle por categoría</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:6px 10px;background:#1e2d4a;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:left;border:1px solid #1e2d4a;">Categoría</th>
          <th style="padding:6px 10px;background:#1e2d4a;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:right;border:1px solid #1e2d4a;">Importe</th>
          <th style="padding:6px 10px;background:#1e2d4a;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:right;border:1px solid #1e2d4a;">%</th>
          <th style="padding:6px 10px;background:#1e2d4a;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:left;border:1px solid #1e2d4a;width:110px;">Proporción</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>` : ''}
  `

  return `
<div style="position:relative;min-height:220mm;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#0f172a;">
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
