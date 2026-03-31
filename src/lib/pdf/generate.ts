// =========================================
// SERVER-SIDE PDF GENERATOR — Propuesta Comercial Platomico
// server-only
//
// 13 secciones:
//  1. Portada            2. Índice
//  3. Sobre Platomico    4. Nuestro propósito
//  5. Planes y add-ons   6. Detalle de módulos
//  7. Soporte            8. Proceso de activación
//  9. Por qué Platomico  10. Próximos pasos
//  11. Resumen económico 12. Anexo: datos de las partes
//  13. Página de firma
//
// Env vars:
//   CHROME_EXECUTABLE_PATH  — local dev (Chrome instalado)
//   Producción              — @sparticuz/chromium lo resuelve solo
// =========================================

import fs from 'fs'
import path from 'path'
import type { Deal, DealConfiguration, ProposalSections } from '@/types'
import { PLANS, ADDONS, ADDON_ORDER, HARDWARE, HARDWARE_MODE_LABELS } from '@/lib/pricing/catalog'

// =========================================
// Logo — leer del filesystem y convertir a base64
// =========================================

function getLogoBase64(): { data: string; mime: string } {
  // Intentar PNG primero (logo real), luego SVG (fallback)
  for (const { file, mime } of [
    { file: 'logo_platomico.png', mime: 'image/png' },
    { file: 'logo_platomico.svg', mime: 'image/svg+xml' },
  ]) {
    try {
      const buf = fs.readFileSync(path.join(process.cwd(), 'public', file))
      return { data: buf.toString('base64'), mime }
    } catch {
      // continuar con siguiente
    }
  }
  return { data: '', mime: '' }
}

function logoImgTag(b64: string, mime: string, style: string): string {
  if (!b64) {
    return `<span style="font-size:16px;font-weight:800;color:#0f172a;font-family:Helvetica,sans-serif;">Platomico.</span>`
  }
  return `<img src="data:${mime};base64,${b64}" style="${style}" alt="Platomico"/>`
}

// =========================================
// Puppeteer launcher
// =========================================

const SET_CONTENT_TIMEOUT_MS = 15_000
const PDF_RENDER_TIMEOUT_MS  = 45_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`PDF generation timed out: ${label} (>${ms}ms)`)), ms)
    ),
  ])
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = (await import('puppeteer-core')).default
  const chromium  = (await import('@sparticuz/chromium')).default

  const executablePath =
    process.env.CHROME_EXECUTABLE_PATH ?? (await chromium.executablePath())

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754 },
    executablePath,
    headless: true,
  })

  const { data: logoB64, mime: logoMime } = getLogoBase64()

  const logoHeaderHtml = logoB64
    ? `<img src="data:${logoMime};base64,${logoB64}" style="height:18px;width:auto;" alt="Platomico"/>`
    : `<span style="font-size:10px;font-weight:800;color:#0f172a;font-family:Helvetica,sans-serif;">Platomico.</span>`

  try {
    const page = await browser.newPage()
    await withTimeout(
      page.setContent(html, { waitUntil: 'domcontentloaded' }),
      SET_CONTENT_TIMEOUT_MS,
      'setContent'
    )

    const pdf = await withTimeout(page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="
          width:100%; margin:0; padding:4px 15mm 4px;
          display:flex; align-items:center; justify-content:space-between;
          border-bottom:1px solid #dde6f0; box-sizing:border-box;
        ">
          <div style="display:flex; align-items:center;">
            ${logoHeaderHtml}
          </div>
          <span style="font-size:7.5px; color:#94a3b8; font-family:Helvetica,sans-serif; letter-spacing:0.5px;">
            PROPUESTA COMERCIAL · CONFIDENCIAL
          </span>
        </div>`,
      footerTemplate: `
        <div style="
          width:100%; margin:0; padding:4px 15mm 4px;
          display:flex; align-items:center; justify-content:space-between;
          border-top:1px solid #dde6f0; box-sizing:border-box;
        ">
          <span style="font-size:7px; color:#94a3b8; font-family:Helvetica,sans-serif;">
            Platomico, S.L. · NIF B22741094 · Calle Antonio Machado 9, Rozas de Puerto Real, Madrid 28649 · hola@platomico.com
          </span>
          <span style="font-size:7px; color:#94a3b8; font-family:Helvetica,sans-serif; white-space:nowrap; margin-left:8px;">
            Pág. <span class="pageNumber"></span> de <span class="totalPages"></span>
          </span>
        </div>`,
      margin: { top: '18mm', bottom: '15mm', left: '15mm', right: '15mm' },
    }), PDF_RENDER_TIMEOUT_MS, 'page.pdf')
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// =========================================
// Entry point
// =========================================

export async function generateProposalPdf(
  deal: Deal,
  cfg: DealConfiguration,
  sections: ProposalSections
): Promise<Buffer> {
  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const { data: logoB64, mime: logoMime } = getLogoBase64()
  return renderHtmlToPdf(buildFullDossier(deal, cfg, sections, today, logoB64, logoMime))
}

// =========================================
// Helpers
// =========================================

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\n/g, '<br>')
}
function fmt(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtN(n: number): string {
  return n.toLocaleString('es-ES')
}
function check(v: boolean): string {
  return v
    ? `<span style="color:#1e3a5f;font-weight:700;">✓</span>`
    : `<span style="color:#94a3b8;">—</span>`
}
function pageBreak(): string {
  return `<div style="page-break-before:always;"></div>`
}
function sectionTitle(title: string, sub?: string): string {
  return `
    <div style="margin-bottom:18px; padding-bottom:10px; border-bottom:2px solid #1e3a5f;">
      <div style="font-size:8px; font-weight:700; color:#1e3a5f; text-transform:uppercase; letter-spacing:2px; margin-bottom:4px;">
        Platomico · Propuesta Comercial
      </div>
      <div style="font-size:20px; font-weight:800; color:#0f172a; letter-spacing:-0.5px;">${title}</div>
      ${sub ? `<div style="font-size:11px; color:#64748b; margin-top:3px;">${sub}</div>` : ''}
    </div>`
}

function buildTable(
  headers: string[],
  rows: string[][],
  opts: { highlightCol?: number; compact?: boolean } = {}
): string {
  const { highlightCol, compact } = opts
  const tdPad = compact ? '7px 10px' : '10px 12px'
  const thCells = headers.map((h, i) => {
    const hl = highlightCol === i
    return `<th style="
      padding:${tdPad}; text-align:left; font-size:9px; font-weight:700;
      text-transform:uppercase; letter-spacing:1px;
      background:${hl ? '#1e3a5f' : '#e8eef6'}; color:${hl ? '#fff' : '#1e3a5f'};
      border:1px solid ${hl ? '#1e3a5f' : '#d1dce8'};
    ">${h}</th>`
  }).join('')

  const bodyRows = rows.map((cells, ri) => {
    const rowBg = ri % 2 === 0 ? '#fff' : '#f8fafc'
    const tds = cells.map((c, ci) => {
      const hl = highlightCol === ci
      return `<td style="
        padding:${tdPad}; font-size:10px; color:${hl ? '#1e3a5f' : '#334155'};
        background:${hl ? '#eef4fd' : rowBg};
        border:1px solid ${hl ? '#c5d9f0' : '#e8eef6'};
        font-weight:${hl ? '600' : '400'};
      ">${c}</td>`
    }).join('')
    return `<tr>${tds}</tr>`
  }).join('')

  return `
    <table style="width:100%; border-collapse:collapse; margin-top:12px; font-family:Helvetica,sans-serif;">
      <thead><tr>${thCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`
}

// =========================================
// Section builders
// =========================================

// ── 1. PORTADA ──
function sectionCover(
  deal: Deal,
  cfg: DealConfiguration,
  today: string,
  logoB64: string,
  logoMime: string
): string {
  const plan = PLANS[cfg.plan]
  const logoTag = logoImgTag(logoB64, logoMime, 'height:36px; width:auto;')

  return `
    <div style="
      min-height:240mm; display:flex; flex-direction:column;
      font-family:Helvetica,sans-serif;
    ">
      <!-- Header: logo arriba a la derecha -->
      <div style="display:flex; justify-content:flex-end; margin-bottom:40px;">
        ${logoTag}
      </div>

      <!-- Título principal -->
      <div style="margin-bottom:32px;">
        <div style="font-size:9px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:3px; margin-bottom:12px;">
          PLATOMICO · Gestiona tu restaurante desde un único lugar
        </div>
        <div style="font-size:36px; font-weight:900; color:#0f172a; letter-spacing:-1px; line-height:1.1; margin-bottom:10px;">
          Propuesta<br>Comercial
        </div>
        <div style="width:60px; height:4px; background:#1e3a5f; border-radius:2px;"></div>
      </div>

      <!-- Datos del cliente -->
      <div style="background:#f8fafc; border:1px solid #e8eef6; border-radius:12px; padding:24px 28px; margin-bottom:28px;">
        <div style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:12px;">Preparada para</div>
        <div style="font-size:26px; font-weight:800; color:#0f172a; letter-spacing:-0.5px; margin-bottom:4px;">${esc(deal.company.name)}</div>
        ${deal.company.cif ? `<div style="font-size:12px; color:#64748b; margin-bottom:4px;">CIF: ${esc(deal.company.cif)}</div>` : ''}
        ${deal.contact.name ? `<div style="font-size:12px; color:#64748b;">Attn.: ${esc(deal.contact.name)}</div>` : ''}
      </div>

      <!-- Meta info -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:28px;">
        <div style="border:1px solid #dde6f0; border-radius:8px; padding:14px 16px;">
          <div style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Fecha</div>
          <div style="font-size:11px; font-weight:600; color:#0f172a;">Madrid, ${today}</div>
        </div>
        <div style="border:1px solid #dde6f0; border-radius:8px; padding:14px 16px;">
          <div style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Versión</div>
          <div style="font-size:11px; font-weight:600; color:#0f172a; font-family:'Courier New',monospace;">V1.0${cfg.version}${cfg.label ? ` · ${cfg.label}` : ''}</div>
        </div>
        <div style="border:1px solid #dde6f0; border-radius:8px; padding:14px 16px;">
          <div style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Plan</div>
          <div style="font-size:11px; font-weight:700; color:#1e3a5f;">${plan.label}</div>
        </div>
      </div>

      <!-- Confidencial notice -->
      <div style="
        margin-top:auto; border:1px solid #fde8e8; border-radius:8px;
        padding:12px 16px; background:#fff9f9;
        display:flex; align-items:center; gap:10px;
      ">
        <div style="
          width:28px; height:28px; background:#fee2e2; border-radius:6px;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
          font-size:14px;
        ">⚠</div>
        <div>
          <div style="font-size:9px; font-weight:700; color:#dc2626; text-transform:uppercase; letter-spacing:1px;">Documento confidencial</div>
          <div style="font-size:9px; color:#94a3b8; margin-top:1px;">
            Este documento contiene información comercial y técnica de carácter confidencial.
            Su divulgación a terceros no autorizados está expresamente prohibida.
          </div>
        </div>
      </div>

      <!-- Footer portada -->
      <div style="margin-top:20px; text-align:center; font-size:9px; color:#94a3b8; border-top:1px solid #e8eef6; padding-top:12px;">
        Platomico, S.L. · NIF B22741094 · Calle Antonio Machado 9, Rozas de Puerto Real, Madrid 28649 · hola@platomico.com
      </div>
    </div>`
}

// ── 2. ÍNDICE ──
function sectionIndex(): string {
  const items = [
    { n: '1', title: 'Sobre Platomico' },
    { n: '2', title: 'Nuestro propósito' },
    { n: '3', title: 'Planes y add-ons' },
    { n: '4', title: 'Detalle de módulos' },
    { n: '5', title: 'Soporte y acompañamiento' },
    { n: '6', title: 'Proceso de activación' },
    { n: '7', title: 'Por qué Platomico' },
    { n: '8', title: 'Próximos pasos' },
    { n: '9', title: 'Resumen económico' },
    { n: 'Anexo A', title: 'Datos de las partes' },
    { n: 'Anexo B', title: 'Página de firma' },
  ]

  return `
    ${sectionTitle('Índice')}
    <div style="margin-top:8px;">
      ${items.map((item, i) => `
        <div style="
          display:flex; align-items:center; gap:0;
          padding:10px 0;
          ${i < items.length - 1 ? 'border-bottom:1px solid #e8eef6;' : ''}
        ">
          <div style="
            width:52px; flex-shrink:0;
            font-size:9px; font-weight:700; color:#1e3a5f;
            font-family:'Courier New',monospace; letter-spacing:0.5px;
          ">${item.n}.</div>
          <div style="
            flex:1; border-bottom:1px dotted #d1dce8; height:1px; margin:0 10px;
          "></div>
          <div style="font-size:11px; font-weight:500; color:#0f172a; text-align:right;">
            ${item.title}
          </div>
        </div>`).join('')}
    </div>

    <div style="margin-top:28px; background:#f0f5fb; border-left:3px solid #1e3a5f; border-radius:0 6px 6px 0; padding:12px 16px; font-size:9.5px; color:#334155; line-height:1.6;">
      Esta propuesta ha sido preparada de forma personalizada y tiene validez de <strong>30 días naturales</strong> desde su fecha de emisión.
    </div>`
}

// ── 3. SOBRE PLATOMICO ──
function sectionAbout(): string {
  const kpis = [
    { value: '100+', label: 'Clientes activos' },
    { value: '3',    label: 'Países' },
    { value: '99,9%', label: 'Uptime garantizado' },
  ]

  return `
    ${sectionTitle('Sobre Platomico', 'El sistema operativo para la hostelería moderna')}

    <div style="font-size:11px; color:#334155; line-height:1.8; margin-bottom:24px;">
      <p style="margin-bottom:12px;">
        Platomico es el sistema operativo para la hostelería moderna. Conecta pagos, pedidos
        y cocina para reducir errores, eliminar papel y ganar eficiencia operativa en cada turno.
      </p>
      <p style="margin-bottom:12px;">
        Nació en 2023 con un objetivo claro: que cualquier restaurante, independientemente de
        su tamaño, pueda acceder a la misma tecnología que las grandes cadenas de restauración,
        sin la complejidad ni el coste que estas soluciones suelen implicar.
      </p>
      <p>
        Hoy acompañamos a restaurantes independientes, grupos de restauración y dark kitchens
        en toda España, con una plataforma diseñada desde cero para el sector, por personas
        que conocen la hostelería desde dentro.
      </p>
    </div>

    <!-- KPIs -->
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:24px;">
      ${kpis.map(k => `
        <div style="
          background:#1e3a5f; border-radius:10px; padding:20px 16px; text-align:center;
        ">
          <div style="font-size:28px; font-weight:900; color:#fff; font-family:'Courier New',monospace; line-height:1; margin-bottom:6px;">${k.value}</div>
          <div style="font-size:9px; color:rgba(255,255,255,0.65); text-transform:uppercase; letter-spacing:1px;">${k.label}</div>
        </div>`).join('')}
    </div>

    <!-- Categorías de cliente -->
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
      ${[
        { icon: '🍽️', title: 'Restaurantes independientes', desc: 'De 1 a 10 locales. Gestión centralizada sin estructura IT.' },
        { icon: '🏢', title: 'Grupos de restauración',      desc: 'Multi-local, multi-concepto. Reporting consolidado.' },
        { icon: '🌑', title: 'Dark kitchens',               desc: 'Operación 100% delivery. Integración nativa con plataformas.' },
      ].map(c => `
        <div style="border:1px solid #e8eef6; border-radius:8px; padding:14px; text-align:center;">
          <div style="font-size:22px; margin-bottom:6px;">${c.icon}</div>
          <div style="font-size:10px; font-weight:700; color:#1e3a5f; margin-bottom:4px;">${c.title}</div>
          <div style="font-size:9px; color:#64748b; line-height:1.5;">${c.desc}</div>
        </div>`).join('')}
    </div>`
}

// ── 4. NUESTRO PROPÓSITO ──
function sectionPurpose(): string {
  return `
    ${sectionTitle('Nuestro propósito')}

    <!-- Tagline -->
    <div style="
      background:#1e3a5f; border-radius:12px; padding:28px 32px; margin-bottom:28px; text-align:center;
    ">
      <div style="font-size:22px; font-weight:900; color:#fff; letter-spacing:-0.5px; line-height:1.2; margin-bottom:8px;">
        "No cambies de equipo.<br>Cambia de resultados."
      </div>
      <div style="font-size:11px; color:rgba(255,255,255,0.6);">
        La tecnología que necesitas ya existe. Solo hay que ponerla a trabajar para ti.
      </div>
    </div>

    <!-- Misión / Visión / Valores -->
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:24px;">
      ${[
        {
          icon: '🎯', title: 'Misión',
          desc: 'Democratizar la tecnología de hostelería. Que cualquier restaurante pueda competir en igualdad de condiciones con las grandes cadenas.',
        },
        {
          icon: '🔭', title: 'Visión',
          desc: 'Ser la plataforma de referencia para la hostelería en habla hispana, conectando más de 10.000 locales en 2027.',
        },
        {
          icon: '💡', title: 'Valores',
          desc: 'Simplicidad antes que funcionalidad. Honestidad en el precio. Obsesión por el tiempo de activación. Soporte sin burocracia.',
        },
      ].map(v => `
        <div style="border:1px solid #e8eef6; border-radius:8px; padding:18px;">
          <div style="font-size:22px; margin-bottom:8px;">${v.icon}</div>
          <div style="font-size:11px; font-weight:700; color:#1e3a5f; margin-bottom:6px;">${v.title}</div>
          <div style="font-size:10px; color:#64748b; line-height:1.6;">${v.desc}</div>
        </div>`).join('')}
    </div>

    <div style="background:#f0f5fb; border-left:3px solid #1e3a5f; border-radius:0 6px 6px 0; padding:14px 16px; font-size:10.5px; color:#334155; line-height:1.6;">
      Platomico no es un software más. Es el compromiso de que la tecnología trabaje para el restaurante, y no al revés.
      Por eso ofrecemos contratos sin permanencia, activación en 24 horas y soporte nativo en español.
    </div>`
}

// ── 5. PLANES Y ADD-ONS ──
function sectionPlansMatrix(deal: Deal, cfg: DealConfiguration): string {
  const planTiers = ['starter', 'growth', 'pro'] as const
  const hiCol = planTiers.indexOf(cfg.plan) + 1  // +1 porque col 0 es "Característica"

  // Tabla comparativa de planes
  const planRows: string[][] = [
    ['Volumen tickets/mes/local',
      'Hasta 500', '501 – 1.000', 'Más de 1.000'],
    ['Precio base',
      'Gratis', '15 €/local/mes', '35 €/local/mes'],
    ['Fee variable',
      '0,08 €/ticket', '0,05 €/ticket', '0,03 €/ticket'],
    ['Canal de soporte',
      'Email', 'Email + Chat', 'Teléfono · Chat · Email'],
    ['Tiempo de respuesta',
      '48 h', '24 h', '4 h'],
    ['Onboarding',
      'Self-service', 'Sesión remota', 'Presencial o remoto'],
    ['Account Manager',
      '—', '—', 'Dedicado'],
    ['SLA uptime',
      '99,0 %', '99,5 %', '99,9 %'],
  ]

  // Cabeceras con checkmark en plan seleccionado
  const planHeaders = ['Característica', ...planTiers.map((t, i) => {
    const p = PLANS[t]
    return i + 1 === hiCol ? `${p.label}<br><span style="font-size:8px;opacity:0.8;">✓ Plan seleccionado</span>` : p.label
  })]

  // Matriz de módulos incluidos
  const moduleRows: string[][] = [
    ['Register POS',         check(true),  check(true),  check(true)],
    ['Analítica básica',     check(true),  check(true),  check(true)],
    ['Web Ordering',         check(false), check(true),  check(true)],
    ['Multi-local',          check(false), check(true),  check(true)],
    ['KDS',                  check(false), 'Add-on',     check(true)],
    ['Kiosk',                check(false), 'Add-on',     'Add-on'],
    ['Delivery integr.',     check(false), 'Add-on',     'Add-on'],
    ['Analítica IA',         check(false), 'Add-on',     'Add-on'],
    ['Account Manager',      check(false), check(false), check(true)],
  ]

  // Add-ons activos en este deal
  const activeAddons = cfg.activeAddons
  const eco = cfg.economics
  const hwItems = cfg.hardware.filter(h => h.quantity > 0)

  return `
    ${sectionTitle('Planes y add-ons', `Plan seleccionado: ${PLANS[cfg.plan].label} · ${cfg.locations} local${cfg.locations > 1 ? 'es' : ''}`)}

    <div style="font-size:11px; font-weight:700; color:#1e3a5f; margin-bottom:6px; text-transform:uppercase; letter-spacing:1px; font-size:9px;">
      Comparativa de planes
    </div>
    ${buildTable(planHeaders, planRows, { highlightCol: hiCol })}

    <div style="margin-top:24px; font-size:9px; font-weight:700; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
      Módulos incluidos por plan
    </div>
    ${buildTable(['Módulo', 'Starter', 'Growth', 'Pro'], moduleRows, { highlightCol: hiCol, compact: true })}

    ${activeAddons.length > 0 || hwItems.length > 0 ? `
    <div style="margin-top:24px; font-size:9px; font-weight:700; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
      Add-ons y hardware incluidos en esta propuesta
    </div>
    <div style="display:flex; flex-direction:column; gap:6px;">
      ${activeAddons.map(id => {
        const addon = ADDONS[id]
        const precio = id === 'datafono'
          ? `${addon.feePercent}% GMV`
          : addon.perConsumption
          ? 'Por consumo'
          : `${addon.priceMonthly} €${addon.perLocation ? '/local/mes' : '/mes'}`
        const total = id === 'datafono'
          ? fmt(eco.datafonoFeeMonthly)
          : addon.perConsumption
          ? '—'
          : fmt((addon.priceMonthly ?? 0) * (addon.perLocation ? cfg.locations : 1))
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#f8fafc; border:1px solid #e8eef6; border-radius:6px;">
            <div>
              <span style="font-size:10px; font-weight:600; color:#0f172a;">${addon.label}</span>
              <span style="font-size:9px; color:#94a3b8; margin-left:8px;">${addon.description}</span>
            </div>
            <div style="text-align:right;">
              <span style="font-size:9px; color:#64748b; margin-right:12px;">${precio}</span>
              <span style="font-size:10px; font-weight:700; color:#1e3a5f; font-family:'Courier New',monospace;">${total}/mes</span>
            </div>
          </div>`
      }).join('')}
      ${hwItems.map(item => {
        const hw = HARDWARE[item.hardwareId]
        const lineTotal = item.unitPrice * item.quantity
        const importe = item.mode === 'financed' && item.financeMonths
          ? `${fmt(lineTotal / item.financeMonths)}/mes`
          : item.mode === 'included' ? 'Incluido' : fmt(lineTotal)
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#f8fafc; border:1px solid #e8eef6; border-radius:6px;">
            <div>
              <span style="font-size:10px; font-weight:600; color:#0f172a;">${hw.label}</span>
              <span style="font-size:9px; color:#94a3b8; margin-left:8px;">${item.quantity} ud. · ${HARDWARE_MODE_LABELS[item.mode]}</span>
            </div>
            <span style="font-size:10px; font-weight:700; color:#1e3a5f; font-family:'Courier New',monospace;">${importe}</span>
          </div>`
      }).join('')}
    </div>` : ''}

    <div style="margin-top:14px; background:#f8fafc; border:1px solid #e8eef6; border-radius:8px; padding:12px 16px; font-size:9.5px; color:#64748b; line-height:1.6;">
      Sin permanencia mínima · facturación mes a mes · el plan puede cambiarse en cualquier momento desde el panel.
    </div>`
}

// ── 6. DETALLE DE MÓDULOS ──
function sectionModuleDetail(): string {
  const modules = [
    {
      icon: '🖥️', title: 'Register POS',
      desc: 'TPV táctil en iPad. Gestión de mesas, comandas y pagos integrados. Cierre de caja automático con cuadre diario. Funciona sin internet.',
    },
    {
      icon: '📺', title: 'KDS — Kitchen Display',
      desc: 'Pantalla de cocina digital. Elimina el papel y los errores por mal fax. Muestra tiempos por plato y alerta sobre pedidos retrasados.',
    },
    {
      icon: '📲', title: 'Kiosk — Self-ordering',
      desc: 'Terminal de autopedido. Reduce colas en hora punta, activa el upselling automático y libera al personal para tareas de mayor valor.',
    },
    {
      icon: '🌐', title: 'Web Ordering',
      desc: 'Canal de pedidos online propio. Sin comisión por pedido. Integración directa con POS y cocina en tiempo real. Personalizable con tu marca.',
    },
    {
      icon: '🛵', title: 'Delivery — Integraciones',
      desc: 'Agrega Glovo, Uber Eats, Just Eat y más en un único panel. Sin tablets adicionales. Los pedidos llegan directamente a cocina.',
    },
    {
      icon: '📊', title: 'Analítica',
      desc: 'Dashboard de ventas en tiempo real. Productos top, rendimiento por local y por hora. Exportación de datos. Versión IA con predicciones.',
    },
  ]

  return `
    ${sectionTitle('Detalle de módulos', 'Tecnología diseñada para cada punto de la operación')}

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
      ${modules.map(m => `
        <div style="border:1px solid #e8eef6; border-radius:10px; padding:18px; background:#fff;">
          <div style="font-size:24px; margin-bottom:8px;">${m.icon}</div>
          <div style="font-size:12px; font-weight:700; color:#1e3a5f; margin-bottom:6px;">${m.title}</div>
          <div style="font-size:10px; color:#64748b; line-height:1.65;">${m.desc}</div>
        </div>`).join('')}
    </div>`
}

// ── 7. SOPORTE Y ACOMPAÑAMIENTO ──
function sectionSupport(cfg: DealConfiguration): string {
  const hiCol = cfg.plan === 'starter' ? 1 : cfg.plan === 'growth' ? 2 : 3

  const rows: string[][] = [
    ['Canal de soporte',     'Email',                           'Email + Chat',                    'Teléfono · Chat · Email'],
    ['Tiempo de respuesta',  '48 h hábiles',                    '24 h hábiles',                    '4 h hábiles'],
    ['Onboarding',           'Documentación self-service',      'Sesión guiada remota',            'Onboarding presencial o remoto'],
    ['Account Manager',      '—',                               '—',                               'Dedicado'],
    ['SLA uptime',           '99,0 %',                          '99,5 %',                          '99,9 %'],
    ['Formación del equipo', 'Vídeos y guías',                  'Sesión remota (2 h)',              'Sesión presencial (4 h)'],
    ['Actualizaciones',      'Automáticas',                     'Automáticas + notas de versión',  'Automáticas + briefing previo'],
  ]

  return `
    ${sectionTitle('Soporte y acompañamiento', 'Equipo nativo en español, especializado en hostelería')}
    ${buildTable(['', 'Starter', 'Growth', 'Pro'], rows, { highlightCol: hiCol })}
    <div style="margin-top:14px; background:#f0f5fb; border-left:3px solid #1e3a5f; border-radius:0 6px 6px 0; padding:12px 16px; font-size:10px; color:#334155; line-height:1.6;">
      Nuestro equipo de soporte está formado por especialistas en hostelería con experiencia operativa en restaurantes.
      No subcontratamos el soporte técnico — todos los agentes conocen el sector y hablan tu idioma.
    </div>`
}

// ── 8. PROCESO DE ACTIVACIÓN ──
function sectionActivation(): string {
  const phases = [
    { n: '01', title: 'Selección y firma',      time: '< 2 h',        desc: 'Revisión final de la propuesta, firma digital del contrato de servicios.' },
    { n: '02', title: 'Configuración técnica',  time: '4 h',          desc: 'Setup de la cuenta, configuración de locales, permisos y parámetros de operación.' },
    { n: '03', title: 'Migración de datos',     time: '4 – 8 h',      desc: 'Importación de la carta, familias, modificadores y productos existentes.' },
    { n: '04', title: 'Formación del equipo',   time: '2 – 4 h',      desc: 'Sesión de formación para el personal de sala, barra y cocina.' },
    { n: '05', title: 'Go Live',                time: '< 24 h total', desc: 'Activación en producción, primera operación en vivo con soporte on-site o remoto.' },
  ]

  return `
    ${sectionTitle('Proceso de activación', 'De la firma al primer pedido real en menos de 24 horas')}

    <div style="display:flex; flex-direction:column; gap:0; margin-bottom:20px;">
      ${phases.map((p, i) => `
        <div style="
          display:flex; align-items:flex-start; gap:14px;
          padding:14px 0; ${i < phases.length - 1 ? 'border-bottom:1px solid #e8eef6;' : ''}
        ">
          <div style="
            width:36px; height:36px; background:#1e3a5f; border-radius:50%;
            display:flex; align-items:center; justify-content:center; flex-shrink:0;
          ">
            <span style="font-size:11px; font-weight:800; color:#fff;">${p.n}</span>
          </div>
          <div style="flex:1;">
            <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:3px;">
              <div style="font-size:12px; font-weight:700; color:#0f172a;">${p.title}</div>
              <div style="
                font-size:8px; font-weight:700; color:#1e3a5f; background:#dde6f0;
                padding:2px 8px; border-radius:20px; white-space:nowrap;
              ">${p.time}</div>
            </div>
            <div style="font-size:10px; color:#64748b; line-height:1.5;">${p.desc}</div>
          </div>
        </div>`).join('')}
    </div>

    <div style="
      background:#1e3a5f; border-radius:10px; padding:16px 20px;
      display:flex; align-items:center; gap:14px;
    ">
      <div style="font-size:28px;">⚡</div>
      <div>
        <div style="font-size:13px; font-weight:800; color:#fff; margin-bottom:3px;">Activación garantizada en 24 horas</div>
        <div style="font-size:10px; color:rgba(255,255,255,0.7); line-height:1.5;">
          Si el proceso de activación supera las 24 horas hábiles por causas imputables a Platomico,
          el primer mes de servicio es gratuito.
        </div>
      </div>
    </div>`
}

// ── 9. POR QUÉ PLATOMICO ──
function sectionWhyPlatomico(): string {
  const reasons = [
    { icon: '🎯', title: '100% nativo hostelería',    desc: 'Diseñado exclusivamente para restaurantes, bares y dark kitchens. Sin adaptaciones de software genérico.' },
    { icon: '⚡', title: 'Activación en 24 horas',    desc: 'Todo el proceso desde la firma hasta el primer pedido en vivo, garantizado en menos de un día laborable.' },
    { icon: '📅', title: 'Sin permanencia',            desc: 'Contratos mes a mes. Sin penalizaciones por cancelación. Te quedas porque quieres, no porque estés atrapado.' },
    { icon: '📈', title: 'Crece contigo',              desc: '1 local o 100, el precio se adapta. La plataforma escala sin necesidad de cambiar de solución.' },
    { icon: '🇪🇸', title: 'Soporte en español',        desc: 'Equipo nativo, en horario español, con conocimiento real del sector de la hostelería.' },
    { icon: '🔗', title: 'Integraciones nativas',      desc: 'Glovo, Uber Eats, Just Eat, pasarelas de pago, sistemas contables. Todo conectado sin desarrollos a medida.' },
  ]

  return `
    ${sectionTitle('Por qué Platomico', 'Seis razones que nos diferencian')}

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
      ${reasons.map(r => `
        <div style="border:1px solid #e8eef6; border-radius:8px; padding:16px;">
          <div style="font-size:24px; margin-bottom:8px;">${r.icon}</div>
          <div style="font-size:12px; font-weight:700; color:#1e3a5f; margin-bottom:5px;">${r.title}</div>
          <div style="font-size:10px; color:#64748b; line-height:1.55;">${r.desc}</div>
        </div>`).join('')}
    </div>`
}

// ── 10. PRÓXIMOS PASOS ──
function sectionNextSteps(deal: Deal): string {
  const steps = [
    { n: '1', title: 'Revisión de la propuesta',  desc: 'Lectura y validación de todos los términos y configuración acordada. Tiempo estimado: 15-20 minutos.' },
    { n: '2', title: 'Confirmación y ajustes',     desc: `Comunica cualquier ajuste necesario a tu Account Executive. ${esc(deal.contact.name)} recibirá respuesta en menos de 24 horas.` },
    { n: '3', title: 'Firma del contrato',          desc: 'Firma digital del contrato de servicios — recibirás un enlace DocuSign por email.' },
    { n: '4', title: 'Go Live',                     desc: 'Activación del servicio y primer pedido en vivo en menos de 24 horas hábiles.' },
  ]

  return `
    ${sectionTitle('Próximos pasos')}

    <div style="display:flex; flex-direction:column; gap:0; margin-bottom:24px;">
      ${steps.map((s, i) => `
        <div style="
          display:flex; align-items:flex-start; gap:14px;
          padding:14px 0; ${i < steps.length - 1 ? 'border-bottom:1px solid #e8eef6;' : ''}
        ">
          <div style="
            width:32px; height:32px; border:2px solid #1e3a5f; border-radius:50%;
            display:flex; align-items:center; justify-content:center; flex-shrink:0;
          ">
            <span style="font-size:13px; font-weight:800; color:#1e3a5f;">${s.n}</span>
          </div>
          <div>
            <div style="font-size:12px; font-weight:700; color:#0f172a; margin-bottom:3px;">${s.title}</div>
            <div style="font-size:10px; color:#64748b; line-height:1.5;">${s.desc}</div>
          </div>
        </div>`).join('')}
    </div>

    <div style="
      background:#f0f5fb; border-radius:10px; padding:16px 20px;
      display:flex; align-items:center; gap:14px;
    ">
      <div style="font-size:28px;">📬</div>
      <div>
        <div style="font-size:12px; font-weight:700; color:#1e3a5f; margin-bottom:2px;">¿Alguna duda antes de firmar?</div>
        <div style="font-size:10px; color:#334155; line-height:1.5;">
          Escríbenos a <strong>hola@platomico.com</strong> o llámanos. Estaremos encantados de resolver
          cualquier pregunta sobre la configuración, el precio o el proceso de activación.
        </div>
      </div>
    </div>`
}

// ── 11. RESUMEN ECONÓMICO ──
function sectionEconomics(deal: Deal, cfg: DealConfiguration, sections: ProposalSections): string {
  const eco = cfg.economics
  const plan = PLANS[cfg.plan]
  const activeAddons = cfg.activeAddons.map(id => ADDONS[id])
  const hwItems = cfg.hardware.filter(h => h.quantity > 0)

  const paybackColor = eco.paybackMonths === null ? '#64748b'
    : eco.paybackMonths <= 12 ? '#16a34a'
    : eco.paybackMonths <= 24 ? '#d97706' : '#dc2626'

  const kpiCards = [
    { label: 'MRR',      value: fmt(eco.totalMonthlyRevenue), sub: 'ingresos rec./mes' },
    { label: 'ARR',      value: fmt(eco.annualRevenue),       sub: 'ingresos rec./año' },
    { label: 'Hardware', value: eco.hardwareCostTotal > 0 ? fmt(eco.hardwareCostTotal) : '—', sub: eco.hardwareCostTotal > 0 ? 'inversión total' : 'sin hardware' },
    { label: 'Payback',  value: eco.paybackMonths != null ? `${eco.paybackMonths} m` : '—', sub: 'recuperación', color: paybackColor },
    { label: 'GMV/mes',  value: fmt(eco.totalMonthlyGMV),     sub: 'volumen gestionado' },
    { label: 'Margen',   value: `${eco.grossMarginPercent.toFixed(0)}%`, sub: fmt(eco.grossMarginMonthly)+'/mes' },
  ]

  return `
    ${sectionTitle('Resumen económico', `${deal.company.name} · Plan ${plan.label} · ${cfg.locations} local${cfg.locations > 1 ? 'es' : ''}`)}

    <!-- KPI grid -->
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px;">
      ${kpiCards.map(k => `
        <div style="border:1px solid #dde6f0; border-radius:8px; padding:14px 16px; background:#fff;">
          <div style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">${k.label}</div>
          <div style="font-size:22px; font-weight:800; color:${k.color || '#0f172a'}; font-family:'Courier New',monospace; line-height:1;">${k.value}</div>
          <div style="font-size:9px; color:#94a3b8; margin-top:4px;">${k.sub}</div>
        </div>`).join('')}
    </div>

    <!-- Config summary -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
      <!-- Software -->
      <div style="border:1px solid #dde6f0; border-radius:8px; padding:16px;">
        <div style="font-size:9px; font-weight:700; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #e8eef6;">
          Software
        </div>
        ${[
          ['Plan', plan.label],
          ['Precio base', plan.priceMonthly === 0 ? `Gratis + ${plan.variableFee}€/ticket` : `${plan.priceMonthly}€/mes/local + ${plan.variableFee}€/ticket`],
          ['Locales', String(cfg.locations)],
          ['Pedidos/mes/local', fmtN(cfg.dailyOrdersPerLocation)],
          ['Ticket medio', fmt(cfg.averageTicket)],
          ['Fee software/mes', fmt(eco.softwareRevenueMonthly)],
        ].map(([k, v]) => `
          <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9; font-family:Helvetica,sans-serif;">
            <span style="font-size:10px; color:#64748b;">${k}</span>
            <span style="font-size:10px; font-weight:600; color:#0f172a; font-family:'Courier New',monospace;">${v}</span>
          </div>`).join('')}
        ${activeAddons.length > 0 ? `
          <div style="margin-top:10px; padding-top:8px; border-top:1px solid #e8eef6;">
            <div style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Add-ons activos</div>
            ${activeAddons.map(a => `
              <div style="display:flex; justify-content:space-between; padding:3px 0; font-family:Helvetica,sans-serif;">
                <span style="font-size:10px; color:#334155;">${a.label}</span>
                <span style="font-size:9px; color:#1e3a5f; font-family:'Courier New',monospace;">
                  ${a.id === 'datafono' ? `${a.feePercent}% GMV` : a.perConsumption ? 'Por consumo' : a.priceMonthly != null ? `${fmt(a.priceMonthly * cfg.locations)}/mes` : '—'}
                </span>
              </div>`).join('')}
          </div>` : ''}
      </div>

      <!-- Hardware -->
      <div style="border:1px solid #dde6f0; border-radius:8px; padding:16px;">
        <div style="font-size:9px; font-weight:700; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #e8eef6;">
          Hardware
        </div>
        ${hwItems.length > 0 ? hwItems.map(item => {
          const hw = HARDWARE[item.hardwareId]
          const lineTotal = item.unitPrice * item.quantity
          const price = item.mode === 'financed' && item.financeMonths
            ? `${fmt(lineTotal / item.financeMonths)}/mes`
            : fmt(lineTotal)
          return `
            <div style="padding:6px 0; border-bottom:1px solid #f1f5f9;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <div style="font-size:10px; font-weight:600; color:#0f172a;">${hw.label}</div>
                  <div style="font-size:9px; color:#94a3b8;">${item.quantity} ud. · ${HARDWARE_MODE_LABELS[item.mode]}${item.mode === 'financed' && item.financeMonths ? ` ${item.financeMonths}m` : ''}</div>
                </div>
                <div style="font-size:10px; font-weight:600; color:#1e3a5f; font-family:'Courier New',monospace;">${price}</div>
              </div>
            </div>`
        }).join('') + `
          <div style="display:flex; justify-content:space-between; padding:8px 0 0; margin-top:2px;">
            <span style="font-size:10px; color:#64748b;">Total hardware</span>
            <span style="font-size:11px; font-weight:800; color:#1e3a5f; font-family:'Courier New',monospace;">${fmt(eco.hardwareCostTotal)}</span>
          </div>` : `<div style="font-size:10px; color:#94a3b8; font-style:italic; padding:8px 0;">Sin hardware configurado</div>`}
      </div>
    </div>

    ${sections.executiveSummary ? `
    <div style="background:#f0f5fb; border-left:3px solid #1e3a5f; border-radius:0 6px 6px 0; padding:14px 16px;">
      <div style="font-size:9px; font-weight:700; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Resumen ejecutivo</div>
      <div style="font-size:10.5px; color:#334155; line-height:1.6;">${esc(sections.executiveSummary)}</div>
    </div>` : ''}`
}

// ── 12. ANEXO: DATOS DE LAS PARTES ──
function sectionAnnexe(deal: Deal, today: string): string {
  return `
    ${sectionTitle('Anexo A: Datos de las partes')}

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <!-- Platomico -->
      <div style="border:1.5px solid #1e3a5f; border-radius:10px; overflow:hidden;">
        <div style="background:#1e3a5f; padding:12px 16px;">
          <div style="font-size:9px; font-weight:700; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Prestador del servicio</div>
          <div style="font-size:14px; font-weight:800; color:#fff;">Platomico, S.L.</div>
        </div>
        <div style="padding:16px;">
          ${[
            ['NIF',                'B22741094'],
            ['Domicilio social',   'C/ Antonio Machado 9, Rozas de Puerto Real, Madrid 28649'],
            ['Registro Mercantil', 'Madrid, hoja M-858953'],
            ['Email',             'hola@platomico.com'],
            ['Web',               'platomico.com'],
          ].map(([k, v]) => `
            <div style="padding:5px 0; border-bottom:1px solid #f1f5f9; display:flex; flex-direction:column; gap:1px;">
              <span style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px;">${k}</span>
              <span style="font-size:10px; color:#0f172a; font-weight:500;">${v}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Cliente -->
      <div style="border:1px solid #dde6f0; border-radius:10px; overflow:hidden;">
        <div style="background:#e8eef6; padding:12px 16px;">
          <div style="font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Cliente</div>
          <div style="font-size:14px; font-weight:800; color:#1e3a5f;">${esc(deal.company.name)}</div>
        </div>
        <div style="padding:16px;">
          ${[
            ['NIF / CIF',  deal.company.cif || '— (a cumplimentar)'],
            ['Domicilio',  deal.company.address || deal.company.city || '— (a cumplimentar)'],
            ['Contacto',   deal.contact.name],
            ['Email',      deal.contact.email],
            ['Teléfono',   deal.contact.phone || '—'],
          ].map(([k, v]) => `
            <div style="padding:5px 0; border-bottom:1px solid #f1f5f9; display:flex; flex-direction:column; gap:1px;">
              <span style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px;">${k}</span>
              <span style="font-size:10px; color:#0f172a; font-weight:500;">${v}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div style="margin-top:16px; background:#f8fafc; border:1px solid #e8eef6; border-radius:8px; padding:14px 16px; font-size:9.5px; color:#64748b; line-height:1.6;">
      La presente propuesta tiene validez de <strong>30 días naturales</strong> a partir de la fecha de emisión (${today}).
      Los precios indicados son en euros, sin IVA. El tipo de IVA aplicable es el vigente en la fecha de facturación.
      La aceptación de esta propuesta implica la celebración de un contrato de prestación de servicios
      bajo las Condiciones Generales publicadas en <strong>platomico.com/legal</strong>.
    </div>`
}

// ── 13. PÁGINA DE FIRMA ──
function sectionSignature(deal: Deal, today: string): string {
  return `
    ${sectionTitle('Anexo B: Aceptación y firma del contrato')}

    <div style="font-size:11px; color:#334155; line-height:1.7; margin-bottom:24px;">
      Las partes abajo firmantes declaran haber leído y comprendido la totalidad de la presente propuesta comercial
      y manifiestan su conformidad con los términos, condiciones y precios recogidos en el mismo.
      Mediante la firma de este documento, el Cliente acepta los servicios de Platomico, S.L.
      y autoriza el inicio del proceso de activación descrito en la Sección 6.
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:28px; margin-bottom:28px;">
      <!-- Platomico -->
      <div style="border:1.5px solid #1e3a5f; border-radius:10px; padding:20px;">
        <div style="font-size:9px; font-weight:700; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Por Platomico, S.L.</div>
        <div style="font-size:10px; color:#64748b; margin-bottom:20px;">NIF B22741094 · Madrid</div>
        <div style="border-bottom:1.5px solid #1e3a5f; margin-bottom:8px; height:48px;"></div>
        <div style="font-size:11px; font-weight:700; color:#0f172a;">${esc(deal.owner)}</div>
        <div style="font-size:9px; color:#64748b;">Platomico, S.L.</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
          <span style="font-size:9px; color:#94a3b8;">Lugar y fecha</span>
          <div style="border-bottom:1px solid #cbd5e1; width:160px; height:18px;"></div>
        </div>
      </div>

      <!-- Cliente -->
      <div style="border:1px solid #dde6f0; border-radius:10px; padding:20px;">
        <div style="font-size:9px; font-weight:700; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Por: ${esc(deal.company.name)}</div>
        <div style="font-size:10px; color:#64748b; margin-bottom:20px;">${deal.company.cif ? `CIF ${deal.company.cif}` : 'Cliente'}</div>
        <div style="border-bottom:1.5px solid #334155; margin-bottom:8px; height:48px;"></div>
        <div style="font-size:11px; font-weight:700; color:#0f172a;">${esc(deal.contact.name)}</div>
        <div style="font-size:9px; color:#64748b;">${esc(deal.contact.email)}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
          <span style="font-size:9px; color:#94a3b8;">Lugar y fecha</span>
          <div style="border-bottom:1px solid #cbd5e1; width:160px; height:18px;"></div>
        </div>
      </div>
    </div>

    <div style="margin-top:20px; text-align:center; font-size:8.5px; color:#94a3b8; line-height:1.6;">
      DOCUMENTO CONFIDENCIAL · Al firmar, el Cliente acepta las Condiciones Generales publicadas en platomico.com/legal.<br>
      © Platomico, S.L. · ${new Date().getFullYear()} · Todos los derechos reservados.
    </div>`
}

// =========================================
// Full dossier assembler
// =========================================

function buildFullDossier(
  deal: Deal,
  cfg: DealConfiguration,
  sections: ProposalSections,
  today: string,
  logoB64: string,
  logoMime: string
): string {
  // Watermark: position:fixed → repeats on every page in puppeteer
  const watermark = `
    <div style="
      position:fixed; top:50%; left:50%;
      transform:translate(-50%,-50%) rotate(-38deg);
      font-size:80px; font-weight:900; letter-spacing:10px;
      color:rgba(30,58,95,0.04); white-space:nowrap;
      pointer-events:none; z-index:0; user-select:none;
      font-family:Helvetica,sans-serif;
    ">CONFIDENCIAL</div>`

  const styles = `
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family:Helvetica,Arial,sans-serif;
      font-size:11px; line-height:1.5; color:#0f172a;
      background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact;
    }
    .page { max-width:680px; margin:0 auto; position:relative; z-index:1; }
    .section { page-break-inside:avoid; }
    p { margin:0; }`

  const secs = [
    sectionCover(deal, cfg, today, logoB64, logoMime),   // 1
    sectionIndex(),                                        // 2
    sectionAbout(),                                        // 3
    sectionPurpose(),                                      // 4
    sectionPlansMatrix(deal, cfg),                         // 5
    sectionModuleDetail(),                                 // 6
    sectionSupport(cfg),                                   // 7
    sectionActivation(),                                   // 8
    sectionWhyPlatomico(),                                 // 9
    sectionNextSteps(deal),                                // 10
    sectionEconomics(deal, cfg, sections),                 // 11
    sectionAnnexe(deal, today),                            // 12
    sectionSignature(deal, today),                         // 13
  ]

  const body = secs.map((s, i) => (i === 0 ? s : `${pageBreak()}<div class="section">${s}</div>`)).join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<style>${styles}</style>
</head>
<body>
${watermark}
<div class="page">
${body}
</div>
</body>
</html>`
}
