// =========================================
// SERVER-SIDE PDF GENERATOR
// server-only — never import in client components
//
// Uses puppeteer-core + @sparticuz/chromium to render
// a self-contained HTML string directly to A4 PDF bytes.
//
// Local dev: set CHROME_EXECUTABLE_PATH in .env.local
//   e.g. /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
// Production (Vercel): @sparticuz/chromium provides the binary automatically.
// =========================================

import type { Deal, DealConfiguration, ProposalSections } from '@/types'
import { PLANS, ADDONS, HARDWARE, HARDWARE_MODE_LABELS } from '@/lib/pricing/catalog'

// ---- Puppeteer launcher ----

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = (await import('puppeteer-core')).default
  const chromium = (await import('@sparticuz/chromium')).default

  const executablePath =
    process.env.CHROME_EXECUTABLE_PATH ?? (await chromium.executablePath())

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754 },
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '16mm', right: '16mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// ---- Public entry point ----

export async function generateProposalPdf(
  deal: Deal,
  cfg: DealConfiguration,
  sections: ProposalSections
): Promise<Buffer> {
  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const html = buildProposalHtml(deal, cfg, sections, today)
  return renderHtmlToPdf(html)
}

// ---- Formatting helpers (no external deps) ----

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtN(n: number): string {
  return n.toLocaleString('es-ES')
}

// ---- HTML template ----

function buildProposalHtml(
  deal: Deal,
  cfg: DealConfiguration,
  sections: ProposalSections,
  today: string
): string {
  const eco = cfg.economics
  const plan = PLANS[cfg.plan]
  const hardwareItems = cfg.hardware.filter((h) => h.quantity > 0)

  const addonRows = cfg.activeAddons.map((id) => {
    const addon = ADDONS[id]
    const price = id === 'datafono'
      ? `${addon.feePercent}% GMV`
      : addon.perConsumption
        ? 'por consumo'
        : addon.priceMonthly != null
          ? `${fmt(addon.priceMonthly * cfg.locations)}/mes`
          : '—'
    return `<div class="row"><span>${addon.label}</span><span class="mono light">${price}</span></div>`
  }).join('')

  const hwRows = hardwareItems.map((item) => {
    const hw = HARDWARE[item.hardwareId]
    const lineTotal = item.unitPrice * item.quantity
    const price = item.mode === 'financed' && item.financeMonths
      ? `${fmt(lineTotal / item.financeMonths)}/mes`
      : fmt(lineTotal)
    return `
      <div class="hw-row">
        <div>
          <div class="hw-name">${hw.label}</div>
          <div class="hw-sub">${item.quantity} ud. · ${HARDWARE_MODE_LABELS[item.mode]}${item.mode === 'financed' && item.financeMonths ? ` ${item.financeMonths}m` : ''}</div>
        </div>
        <div class="mono">${price}</div>
      </div>`
  }).join('')

  const planPrice = plan.priceMonthly === 0
    ? `Gratis + ${plan.variableFee}€/pedido`
    : plan.variableFee > 0
      ? `${plan.priceMonthly}€/mes + ${plan.variableFee}€/pedido`
      : `${plan.priceMonthly}€/mes`

  const paybackColor = eco.paybackMonths === null ? '#71717a'
    : eco.paybackMonths <= 12 ? '#16a34a'
    : eco.paybackMonths <= 24 ? '#d97706'
    : '#dc2626'

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: #18181b;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page { max-width: 740px; margin: 0 auto; }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 20px;
    border-bottom: 1px solid #e4e4e7;
    margin-bottom: 20px;
  }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-mark {
    width: 32px; height: 32px; background: #09090b;
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; position: relative;
  }
  .logo-p {
    font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -1px;
  }
  .logo-dot {
    position: absolute; bottom: 5px; right: 5px;
    width: 8px; height: 8px; background: #10b981; border-radius: 50%;
  }
  .brand-name { font-size: 15px; font-weight: 700; color: #09090b; line-height: 1.1; }
  .brand-sub  { font-size: 9px; color: #a1a1aa; margin-top: 2px; }
  .header-right { text-align: right; }
  .badge-commercial {
    display: inline-block;
    background: #09090b; color: #fff;
    font-size: 8px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px;
    padding: 4px 10px; border-radius: 20px;
  }
  .header-date { font-size: 9px; color: #a1a1aa; margin-top: 5px; }

  /* ── Company block ── */
  .company-block {
    display: flex; align-items: flex-end; justify-content: space-between;
    margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e4e4e7;
  }
  .prepared-for { font-size: 9px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .company-name { font-size: 24px; font-weight: 700; color: #09090b; letter-spacing: -0.5px; line-height: 1.1; }
  .company-meta { display: flex; gap: 12px; margin-top: 6px; }
  .company-meta span { font-size: 10px; color: #71717a; }
  .contact-block { text-align: right; }
  .contact-name  { font-size: 11px; font-weight: 600; color: #3f3f46; }
  .contact-info  { font-size: 10px; color: #a1a1aa; margin-top: 1px; }
  .version-tag {
    display: inline-block;
    font-size: 9px; font-family: 'Courier New', monospace;
    color: #a1a1aa; background: #f4f4f5;
    border: 1px solid #e4e4e7; padding: 2px 7px; border-radius: 4px;
  }

  /* ── Sections ── */
  .section { margin-bottom: 22px; }
  .section-label {
    font-size: 8px; font-weight: 700; color: #a1a1aa;
    text-transform: uppercase; letter-spacing: 2px;
    margin-bottom: 10px;
  }
  .prose { font-size: 10.5px; color: #3f3f46; line-height: 1.6; white-space: pre-wrap; }

  /* ── Pills (exec summary) ── */
  .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .pill {
    display: flex; align-items: center; gap: 5px;
    border: 1px solid #e4e4e7; border-radius: 20px;
    padding: 4px 10px;
  }
  .pill-label { font-size: 8px; color: #a1a1aa; }
  .pill-value { font-size: 9px; font-family: 'Courier New', monospace; font-weight: 600; color: #18181b; }
  .pill-green  { border-color: #bbf7d0; background: #f0fdf4; }
  .pill-green .pill-value { color: #16a34a; }
  .pill-amber  { border-color: #fde68a; background: #fffbeb; }
  .pill-amber .pill-value { color: #d97706; }
  .pill-red    { border-color: #fecaca; background: #fef2f2; }
  .pill-red .pill-value   { color: #dc2626; }

  /* ── Metric grid ── */
  .metric-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 1px; background: #e4e4e7; border-radius: 10px;
    overflow: hidden; margin-top: 10px;
  }
  .metric {
    background: #fff; padding: 14px 16px;
  }
  .metric-label { font-size: 8px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .metric-value { font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace; color: #09090b; }
  .metric-sub   { font-size: 8px; color: #a1a1aa; margin-top: 3px; line-height: 1.3; }

  /* ── Margin bar ── */
  .margin-bar {
    display: flex; align-items: center; justify-content: space-between;
    background: #fafafa; border-radius: 10px; padding: 12px 16px;
    margin-top: 8px;
  }
  .margin-bar-label { font-size: 10px; color: #71717a; }
  .margin-bar-sub   { font-size: 9px; color: #a1a1aa; margin-top: 1px; }
  .margin-bar-value { font-size: 16px; font-weight: 700; font-family: 'Courier New', monospace; color: #09090b; text-align: right; }
  .margin-bar-pct   { font-size: 9px; color: #a1a1aa; font-family: 'Courier New', monospace; }

  /* ── Config columns ── */
  .config-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 10px; }
  .config-col-label { font-size: 8px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 3px 0; border-bottom: 1px solid #f4f4f5; font-size: 10px;
  }
  .row:last-child { border-bottom: none; }
  .row span:first-child { color: #71717a; }
  .mono   { font-family: 'Courier New', monospace; }
  .strong { font-weight: 700; color: #09090b; }
  .light  { color: #71717a; }

  .addon-divider { border-top: 1px solid #f4f4f5; margin-top: 10px; padding-top: 10px; }
  .addon-label   { font-size: 8px; color: #a1a1aa; margin-bottom: 6px; }

  /* ── Hardware ── */
  .hw-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 5px 0; border-bottom: 1px solid #f4f4f5; }
  .hw-row:last-child { border-bottom: none; }
  .hw-name { font-size: 10.5px; font-weight: 600; color: #18181b; }
  .hw-sub  { font-size: 9px; color: #a1a1aa; margin-top: 1px; }
  .hw-total { border-top: 1px solid #e4e4e7; margin-top: 8px; padding-top: 8px; }

  /* ── Signature block ── */
  .signature-section {
    margin-top: 32px;
    border-top: 2px solid #09090b;
    padding-top: 20px;
    page-break-inside: avoid;
  }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 20px; }
  .sig-box {
    border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px;
  }
  .sig-box-label { font-size: 9px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .sig-line {
    border-bottom: 1px solid #09090b; margin-bottom: 6px;
    height: 36px;
  }
  .sig-name   { font-size: 10px; font-weight: 600; color: #18181b; }
  .sig-role   { font-size: 9px; color: #a1a1aa; margin-top: 1px; }
  .sig-date-line { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
  .sig-date-label { font-size: 9px; color: #a1a1aa; }
  .sig-date-box   { border-bottom: 1px solid #d4d4d8; width: 100px; height: 18px; }

  /* ── Footer ── */
  .footer {
    margin-top: 28px; padding-top: 14px;
    border-top: 1px solid #e4e4e7;
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer-left { display: flex; align-items: center; gap: 8px; }
  .footer-logo { width: 14px; height: 14px; background: #09090b; border-radius: 3px; }
  .footer-text { font-size: 8.5px; color: #a1a1aa; line-height: 1.4; }
  .footer-right { font-size: 8px; font-family: 'Courier New', monospace; color: #a1a1aa; white-space: nowrap; }

  /* Page breaks */
  .section { page-break-inside: avoid; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo">
      <div class="logo-mark">
        <span class="logo-p">P</span>
        <span class="logo-dot"></span>
      </div>
      <div>
        <div class="brand-name">Platomico</div>
        <div class="brand-sub">Gestión de pedidos · Hostelería</div>
      </div>
    </div>
    <div class="header-right">
      <span class="badge-commercial">Propuesta Comercial</span>
      <div class="header-date">${today}</div>
    </div>
  </div>

  <!-- Company -->
  <div class="company-block">
    <div>
      <div class="prepared-for">Preparada para</div>
      <div class="company-name">${deal.company.name}</div>
      <div class="company-meta">
        ${deal.company.city ? `<span>${deal.company.city}</span>` : ''}
        ${deal.company.cif ? `<span>CIF ${deal.company.cif}</span>` : ''}
      </div>
      <div style="margin-top:8px">
        <span class="version-tag">v${cfg.version}${cfg.label ? ` · ${cfg.label}` : ''}</span>
        <span style="font-size:9px;color:#a1a1aa;margin-left:8px">Preparada por ${deal.owner}</span>
      </div>
    </div>
    <div class="contact-block">
      <div class="contact-name">${deal.contact.name}</div>
      <div class="contact-info">${deal.contact.email}</div>
      ${deal.contact.phone ? `<div class="contact-info" style="font-family:'Courier New',monospace">${deal.contact.phone}</div>` : ''}
    </div>
  </div>

  ${sections.executiveSummary ? `
  <!-- Resumen ejecutivo -->
  <div class="section">
    <div class="section-label">Resumen ejecutivo</div>
    <div class="prose">${escHtml(sections.executiveSummary)}</div>
    <div class="pills">
      <div class="pill"><span class="pill-label">Plan</span><span class="pill-value">${plan.label}</span></div>
      <div class="pill"><span class="pill-label">Locales</span><span class="pill-value">${cfg.locations}</span></div>
      <div class="pill"><span class="pill-label">Pedidos/mes</span><span class="pill-value">${fmtN(cfg.dailyOrdersPerLocation)} por local</span></div>
      <div class="pill"><span class="pill-label">GMV mensual</span><span class="pill-value">${fmt(eco.totalMonthlyGMV)}</span></div>
      ${eco.paybackMonths !== null ? `
      <div class="pill ${eco.paybackMonths <= 12 ? 'pill-green' : eco.paybackMonths <= 24 ? 'pill-amber' : 'pill-red'}">
        <span class="pill-label">Payback</span>
        <span class="pill-value">${eco.paybackMonths} meses</span>
      </div>` : ''}
    </div>
  </div>` : ''}

  <!-- Impacto económico -->
  <div class="section">
    <div class="section-label">Impacto económico</div>
    <div class="metric-grid">
      <div class="metric">
        <div class="metric-label">MRR</div>
        <div class="metric-value">${fmt(eco.totalMonthlyRevenue)}</div>
        <div class="metric-sub">ingresos recurrentes/mes</div>
      </div>
      <div class="metric">
        <div class="metric-label">ARR</div>
        <div class="metric-value">${fmt(eco.annualRevenue)}</div>
        <div class="metric-sub">ingresos recurrentes/año</div>
      </div>
      <div class="metric">
        <div class="metric-label">Hardware</div>
        <div class="metric-value">${eco.hardwareCostTotal > 0 ? fmt(eco.hardwareCostTotal) : '—'}</div>
        <div class="metric-sub">${eco.hardwareCostTotal > 0 ? 'total dispositivos' : 'sin hardware'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Payback</div>
        <div class="metric-value" style="color:${paybackColor}">${eco.paybackMonths !== null ? `${eco.paybackMonths}m` : '—'}</div>
        <div class="metric-sub">${eco.paybackMonths !== null ? 'recuperación inversión' : 'sin inversión neta'}</div>
      </div>
    </div>
    <div class="margin-bar">
      <div>
        <div class="margin-bar-label">Margen bruto estimado</div>
        <div class="margin-bar-sub">Software al 80%${eco.hardwareCostTotal > 0 ? ', hardware a coste' : ''}</div>
      </div>
      <div>
        <div class="margin-bar-value">${fmt(eco.grossMarginMonthly)}/mes</div>
        <div class="margin-bar-pct" style="text-align:right">${eco.grossMarginPercent.toFixed(0)}% sobre MRR</div>
      </div>
    </div>
    ${sections.economicsSummary ? `<div class="prose" style="margin-top:10px">${escHtml(sections.economicsSummary)}</div>` : ''}
  </div>

  ${sections.solution ? `
  <!-- Solución -->
  <div class="section">
    <div class="section-label">Solución propuesta</div>
    <div class="prose">${escHtml(sections.solution)}</div>
  </div>` : ''}

  <!-- Configuración comercial -->
  <div class="section">
    <div class="section-label">Configuración comercial</div>
    <div class="config-cols">
      <div>
        <div class="config-col-label">Software</div>
        <div class="row"><span>Plan</span><span class="mono">${plan.label}</span></div>
        <div class="row"><span>Precio base</span><span class="mono light">${planPrice}</span></div>
        <div class="row"><span>Locales</span><span class="mono">${cfg.locations}</span></div>
        <div class="row"><span>Pedidos/mes/local</span><span class="mono">${fmtN(cfg.dailyOrdersPerLocation)}</span></div>
        <div class="row"><span>Ticket medio</span><span class="mono">${fmt(cfg.averageTicket)}</span></div>
        <div class="row"><span>Fee mensual</span><span class="mono strong">${fmt(eco.softwareRevenueMonthly)}</span></div>
        ${cfg.activeAddons.length > 0 ? `
        <div class="addon-divider">
          <div class="addon-label">Add-ons</div>
          ${addonRows}
        </div>` : ''}
      </div>
      <div>
        <div class="config-col-label">Hardware</div>
        ${hardwareItems.length > 0 ? `
          ${hwRows}
          <div class="hw-total">
            <div class="row"><span>Total hardware</span><span class="mono strong">${fmt(eco.hardwareCostTotal)}</span></div>
            ${eco.paybackMonths !== null ? `<div class="row"><span>Payback estimado</span><span class="mono">${eco.paybackMonths} meses</span></div>` : ''}
          </div>
        ` : `<div style="font-size:10px;color:#a1a1aa;font-style:italic">Sin hardware configurado</div>`}
      </div>
    </div>
  </div>

  ${sections.nextSteps ? `
  <!-- Próximos pasos -->
  <div class="section">
    <div class="section-label">Próximos pasos</div>
    <div class="prose">${escHtml(sections.nextSteps)}</div>
  </div>` : ''}

  <!-- Bloque de firma -->
  <div class="signature-section">
    <div class="section-label">Aceptación y firma</div>
    <div style="font-size:10px;color:#71717a;margin-top:4px">
      La firma de este documento implica la aceptación de los términos y condiciones de Platomico
      para la prestación de los servicios descritos en esta propuesta.
    </div>
    <div class="sig-grid">
      <div class="sig-box">
        <div class="sig-box-label">Cliente</div>
        <div class="sig-line"></div>
        <div class="sig-name">${deal.contact.name}</div>
        <div class="sig-role">${deal.company.name}</div>
        <div class="sig-date-line">
          <span class="sig-date-label">Fecha</span>
          <div class="sig-date-box"></div>
        </div>
      </div>
      <div class="sig-box">
        <div class="sig-box-label">Platomico</div>
        <div class="sig-line"></div>
        <div class="sig-name">${deal.owner}</div>
        <div class="sig-role">Platomico SL</div>
        <div class="sig-date-line">
          <span class="sig-date-label">Fecha</span>
          <div class="sig-date-box"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <div class="footer-logo"></div>
      <div class="footer-text">
        Propuesta preparada por Platomico para ${escHtml(deal.company.name)}.<br/>
        Los datos económicos son proyecciones basadas en la configuración acordada.
      </div>
    </div>
    <div class="footer-right">v${cfg.version} · ${today}</div>
  </div>

</div>
</body>
</html>`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>')
}
