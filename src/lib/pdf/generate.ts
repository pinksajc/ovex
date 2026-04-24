// =========================================
// SERVER-SIDE PDF GENERATOR — Propuesta Comercial Platomico
// server-only
//
// 12 páginas:
//  1. Portada            2. Índice
//  3. Sobre Platomico    4. Nuestro propósito
//  5. Planes y add-ons   6. Detalle de módulos
//  7. Soporte            8. Proceso de activación
//  9. Próximos pasos     10. Resumen económico
//  11. Anexo: datos de las partes
//  12. Página de firma
//
// Arquitectura de saltos de página:
//   Cada sección vive en <div class="pg"> con break-after:page.
//   El logo PNG se embebe en base64 dentro del body (no en
//   headerTemplate de Puppeteer, que no renderiza imágenes fiablemente).
//   El footer de Puppeteer sólo lleva el número de página.
// =========================================

import fs from 'fs'
import path from 'path'
import type { Deal, DealConfiguration, DealEconomics, ProposalSections, DeliveryPlanId } from '@/types'
import { PLANS, ADDONS, HARDWARE, HARDWARE_MODE_LABELS, PLAN_FEATURES, RENTAL_MONTHLY_PRICE, DELIVERY_PLANS } from '@/lib/pricing/catalog'

// ── Logo ─────────────────────────────────────────────────────────────────────
// Leer una sola vez del disco; embebemos inline como data URI en cada página.

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

// ── Timeouts ─────────────────────────────────────────────────────────────────
const SET_CONTENT_MS = 15_000
const PDF_RENDER_MS  = 45_000

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`PDF timeout: ${label} (>${ms}ms)`)), ms)
    ),
  ])
}

// ── Puppeteer launcher ────────────────────────────────────────────────────────
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = (await import('puppeteer-core')).default
  const chromium  = (await import('@sparticuz/chromium')).default

  // Vercel/Lambda: chromium.executablePath() decompresses the .br binary
  // from node_modules/@sparticuz/chromium/bin/chromium.br on first call.
  // CHROME_EXECUTABLE_PATH overrides for local dev (e.g. /usr/bin/google-chrome).
  const executablePath =
    process.env.CHROME_EXECUTABLE_PATH ??
    (await chromium.executablePath())

  console.log('[renderHtmlToPdf] executablePath:', executablePath)

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--disable-dev-shm-usage', // avoids /dev/shm exhaustion in Lambda
      '--no-zygote',             // required in some Lambda environments
    ],
    defaultViewport: { width: 1240, height: 1754 },
    executablePath,
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await withTimeout(
      page.setContent(html, { waitUntil: 'domcontentloaded' }),
      SET_CONTENT_MS, 'setContent'
    )
    const pdf = await withTimeout(page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      // Header: espacio vacío (el logo va en el body de cada página)
      headerTemplate: `<div style="font-size:1px;"> </div>`,
      // Footer: datos legales + número de página
      footerTemplate: `
        <div style="
          width:100%; padding:3px 14mm;
          display:flex; align-items:center; justify-content:space-between;
          border-top:1px solid #dde6f0; box-sizing:border-box;
          font-family:Helvetica,Arial,sans-serif;
        ">
          <span style="font-size:7px; color:#94a3b8;">
            Platomico, S.L. · NIF B22741094 · Calle Antonio Machado 9, Rozas de Puerto Real, Madrid 28649 · hola@platomico.com
          </span>
          <span style="font-size:7px; color:#94a3b8; white-space:nowrap; margin-left:8px;">
            Pág. <span class="pageNumber"></span>
          </span>
        </div>`,
      margin: { top: '12mm', bottom: '14mm', left: '14mm', right: '14mm' },
    }), PDF_RENDER_MS, 'page.pdf')
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function generateProposalPdf(
  deal: Deal,
  cfg: DealConfiguration,
  sections: ProposalSections
): Promise<Buffer> {
  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const logoUri = readLogoDataUri()
  return renderHtmlToPdf(buildFullDossier(deal, cfg, sections, today, logoUri))
}

// ── Formatters ────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\n/g, '<br>')
}
function fmt(n: number): string {
  return n.toLocaleString('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}
// IVA-inclusive formatter (×1.21) for all client-facing monetary amounts in PDF
function fmtVAT(n: number): string {
  return (n * 1.21).toLocaleString('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}
function fmtN(n: number): string { return n.toLocaleString('es-ES') }
function fmt2(n: number): string {
  return n.toLocaleString('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}
function chk(v: boolean | string): string {
  if (typeof v === 'string') return `<span style="font-size:10px;color:#1e3a5f;">${v}</span>`
  return v
    ? `<span style="color:#1e3a5f;font-weight:700;font-size:11px;">✓</span>`
    : `<span style="color:#cbd5e1;font-size:11px;">—</span>`
}

// ── Shared UI primitives ─────────────────────────────────────────────────────

function pageHeader(logoUri: string): string {
  const imgOrText = logoUri
    ? `<img src="${logoUri}" style="height:24px;width:auto;display:block;" alt="Platomico"/>`
    : `<span style="font-size:15px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Platomico.</span>`
  return `
    <div style="
      display:flex; align-items:center; justify-content:space-between;
      padding-bottom:8px; margin-bottom:16px; border-bottom:1px solid #dde6f0;
    ">
      ${imgOrText}
    </div>`
}

function sectionTitle(title: string, sub?: string): string {
  return `
    <div style="margin-bottom:22px; padding-bottom:10px; border-bottom:2px solid #1e3a5f;">
      <div style="font-size:19px; font-weight:800; color:#0f172a; letter-spacing:-0.5px;">${title}</div>
      ${sub ? `<div style="font-size:10.5px; color:#64748b; margin-top:3px;">${sub}</div>` : ''}
    </div>`
}

function buildTable(
  headers: string[],
  rows: string[][],
  opts: { hi?: number; compact?: boolean } = {}
): string {
  const pad = opts.compact ? '6px 9px' : '9px 11px'
  const ths = headers.map((h, i) => {
    const hl = opts.hi === i
    return `<th style="
      padding:${pad}; text-align:left; font-size:9px; font-weight:700;
      text-transform:uppercase; letter-spacing:0.8px;
      background:${hl ? '#1e3a5f' : '#e8eef6'}; color:${hl ? '#fff' : '#1e3a5f'};
      border:1px solid ${hl ? '#1e3a5f' : '#d1dce8'};
    ">${h}</th>`
  }).join('')

  const trs = rows.map((cells, ri) => {
    const bg = ri % 2 === 0 ? '#fff' : '#f8fafc'
    const tds = cells.map((c, ci) => {
      const hl = opts.hi === ci
      return `<td style="
        padding:${pad}; font-size:10px;
        color:${hl ? '#1e3a5f' : '#334155'};
        background:${hl ? '#eef4fd' : bg};
        border:1px solid ${hl ? '#c5d9f0' : '#e8eef6'};
        font-weight:${hl ? '600' : '400'};
      ">${c}</td>`
    }).join('')
    return `<tr>${tds}</tr>`
  }).join('')

  return `<table style="width:100%;border-collapse:collapse;margin-top:10px;font-family:Helvetica,sans-serif;">
    <thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>
  </table>`
}

// Wraps a section in a page div with the logo header and CONFIDENCIAL watermark.
// break-after:page forces Puppeteer to start a new physical page after each section.
function pg(logoUri: string, content: string, last = false): string {
  return `
<div style="
  ${last ? '' : 'break-after:page;'}
  position:relative; min-height:220mm;
  font-family:Helvetica,Arial,sans-serif; font-size:11px; color:#0f172a;
">
  <!-- Content layer -->
  <div style="position:relative;">
    ${pageHeader(logoUri)}
    ${content}
  </div>
  <!-- CONFIDENCIAL watermark — rendered after content so it paints on top -->
  <div style="
    position:absolute; top:50%; left:50%;
    transform:translate(-50%,-50%) rotate(-38deg);
    font-size:72px; font-weight:900; letter-spacing:10px;
    color:rgba(30,58,95,0.04); white-space:nowrap;
    pointer-events:none; user-select:none;
    z-index:9999; font-family:Helvetica,sans-serif;
  ">CONFIDENCIAL</div>
</div>`
}

// ── Section 1: PORTADA ────────────────────────────────────────────────────────
function s1Cover(deal: Deal, cfg: DealConfiguration, today: string, logoUri: string): string {
  const plan = PLANS[cfg.plan]

  const content = `
    ${pageHeader(logoUri)}

    <!-- Tagline + título -->
    <div style="margin-bottom:32px;">
      <div style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:3px;margin-bottom:12px;">
        Gestiona tu restaurante desde un único lugar
      </div>
      <div style="font-size:38px;font-weight:900;color:#0f172a;letter-spacing:-1.5px;line-height:1.05;margin-bottom:12px;">
        Propuesta Comercial
      </div>
      <div style="width:56px;height:4px;background:#1e3a5f;border-radius:2px;"></div>
    </div>

    <!-- Preparada para -->
    <div style="background:#f8fafc;border:1px solid #e8eef6;border-radius:12px;padding:22px 26px;margin-bottom:22px;">
      <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Preparada para</div>
      <div style="font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;margin-bottom:8px;">${esc(deal.company.name)}</div>
      ${deal.company.cif ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px;">CIF: ${esc(deal.company.cif)}</div>` : ''}
      ${deal.contact.name ? `<div style="font-size:11px;color:#64748b;margin-bottom:2px;">Attn.: ${esc(deal.contact.name)}${deal.contact.email ? ` · ${esc(deal.contact.email)}` : ''}${deal.contact.phone ? ` · ${esc(deal.contact.phone)}` : ''}</div>` : ''}
      ${deal.company.address ? `<div style="font-size:11px;color:#94a3b8;">${esc(deal.company.address)}${deal.company.city ? `, ${esc(deal.company.city)}` : ''}</div>` : deal.company.city ? `<div style="font-size:11px;color:#94a3b8;">${esc(deal.company.city)}</div>` : ''}
    </div>

    <!-- Meta: fecha / versión / plan -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
      ${[
        ['Fecha',   `Madrid, ${today}`],
        ['Versión', `V1.0${cfg.version}${cfg.label ? ` · ${cfg.label}` : ''}`],
        ['Plan',    plan.label],
      ].map(([k, v], i) => `
        <div style="border:1px solid #dde6f0;border-radius:8px;padding:12px 14px;">
          <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${k}</div>
          <div style="font-size:${i === 2 ? '12px' : '11px'};font-weight:${i === 2 ? '700' : '600'};color:${i === 2 ? '#1e3a5f' : '#0f172a'};">${v}</div>
        </div>`).join('')}
    </div>

    <!-- Validez -->
    <div style="font-size:9px;color:#94a3b8;line-height:1.5;">
      Esta propuesta tiene validez de <strong style="color:#64748b;">30 días naturales</strong> desde su fecha de emisión.
    </div>`

  return `
<div style="break-after:page; position:relative; min-height:220mm; font-family:Helvetica,Arial,sans-serif; font-size:11px; color:#0f172a;">
  <div style="position:relative;">${content}</div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-38deg);font-size:72px;font-weight:900;letter-spacing:10px;color:rgba(30,58,95,0.04);white-space:nowrap;pointer-events:none;user-select:none;z-index:9999;font-family:Helvetica,sans-serif;">CONFIDENCIAL</div>
</div>`
}

// ── Section 2: ÍNDICE ─────────────────────────────────────────────────────────
function s2Index(logoUri: string): string {
  const items = [
    ['1', 'Sobre Platomico'],
    ['2', 'Nuestro propósito'],
    ['3', 'Detalle de módulos'],
    ['4', 'Planes y add-ons'],
    ['5', 'Soporte y acompañamiento'],
    ['6', 'Resumen económico'],
    ['7', 'Proceso de activación'],
    ['Anexo A', 'Datos de las partes'],
    ['Anexo B', 'Página de firma'],
  ]
  const content = `
    ${sectionTitle('Índice')}
    <div style="margin-top:4px;">
      ${items.map(([n, t], i) => `
        <div style="display:flex;align-items:center;padding:6px 0;${i < items.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}">
          <div style="width:56px;flex-shrink:0;font-size:9px;font-weight:700;color:#1e3a5f;font-family:'Courier New',monospace;">${n}.</div>
          <div style="flex:1;border-bottom:1px dotted #d1dce8;height:1px;margin:0 10px;"></div>
          <div style="font-size:11px;font-weight:500;color:#0f172a;">${t}</div>
        </div>`).join('')}
    </div>`
  return pg(logoUri, content)
}

// ── Section 3: SOBRE PLATOMICO ────────────────────────────────────────────────
function s3About(logoUri: string): string {
  const content = `
    ${sectionTitle('Sobre Platomico', 'El sistema operativo para la hostelería moderna')}
    <div style="font-size:11px;color:#334155;line-height:1.8;margin-bottom:22px;">
      <p style="margin-bottom:11px;">
        ROS es el sistema operativo para la hostelería moderna. Conecta pagos, pedidos y cocina
        para reducir errores, eliminar papel y ganar eficiencia operativa en cada turno.
      </p>
      <p style="margin-bottom:11px;">
        Nació en 2023 con un objetivo claro: que cualquier restaurante, independientemente de su tamaño,
        pueda acceder a la misma tecnología que las grandes cadenas de restauración, sin la complejidad
        ni el coste que estas soluciones suelen implicar.
      </p>
      <p>
        Hoy acompañamos a restaurantes independientes, grupos de restauración y dark kitchens en toda
        España, con una plataforma diseñada desde cero para el sector, por personas que conocen la
        hostelería desde dentro.
      </p>
    </div>

    `
  return pg(logoUri, content)
}

// ── Section 4: NUESTRO PROPÓSITO ──────────────────────────────────────────────
function s4Purpose(logoUri: string): string {
  const content = `
    ${sectionTitle('Nuestro propósito')}

    <div style="margin-bottom:26px;padding:18px 0 18px;border-top:2px solid #1e3a5f;border-bottom:1px solid #e8eef6;">
      <div style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;line-height:1.2;margin-bottom:6px;">
        "No cambies de equipo. Cambia de resultados."
      </div>
      <div style="font-size:11px;color:#64748b;">
        La tecnología que necesitas ya existe. Solo hay que ponerla a trabajar para ti.
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;margin-bottom:22px;">
      ${[
        ['🎯','Misión','Democratizar la tecnología de hostelería. Que cualquier restaurante pueda competir en igualdad de condiciones con las grandes cadenas.'],
        ['🔭','Visión','Ser la plataforma de referencia para la hostelería en habla hispana, conectando más de 10.000 locales en 2027.'],
        ['💡','Valores','Simplicidad antes que funcionalidad. Honestidad en el precio. Obsesión por el tiempo de activación. Soporte sin burocracia.'],
      ].map(([ic,t,d]) => `
        <div style="border:1px solid #e8eef6;border-radius:8px;padding:16px;">
          <div style="font-size:22px;margin-bottom:7px;">${ic}</div>
          <div style="font-size:11px;font-weight:700;color:#1e3a5f;margin-bottom:5px;">${t}</div>
          <div style="font-size:10px;color:#64748b;line-height:1.6;">${d}</div>
        </div>`).join('')}
    </div>

    <div style="font-size:10.5px;color:#334155;line-height:1.6;margin-top:6px;">
      ROS no es solo software más. Es el compromiso de que la tecnología trabaje para el restaurante, y no al revés.
      Por eso ofrecemos contratos sin permanencia, activación en 24 horas y soporte nativo en español.
    </div>`
  return pg(logoUri, content)
}

// ── Section 5: PLANES Y ADD-ONS ───────────────────────────────────────────────
function s5Plans(deal: Deal, cfg: DealConfiguration, logoUri: string): string {
  const tiers = ['starter', 'growth', 'pro'] as const
  const hiCol = tiers.indexOf(cfg.plan) + 1
  const eco = cfg.economics as DealEconomics & {
    renEnabled?: boolean; renFeePerOrder?: number; renVenues?: number
    kdsVenues?: number; kioskVenues?: number
    deliveryPlan?: string; deliveryPlanKey?: string
    deliveryFixedFee?: number; deliveryFixedMonthly?: number
    deliveryExtraFeePerOrder?: number; deliveryIncludedOrders?: number
  }
  const deliveryPlanId = (eco.deliveryPlanKey ?? eco.deliveryPlan ?? 'start') as DeliveryPlanId
  const deliveryPlanData = DELIVERY_PLANS[deliveryPlanId]
  // Prefer persisted catalog snapshot; fall back to live catalog lookup
  const s5ExtraFeePerOrder = eco.deliveryExtraFeePerOrder ?? deliveryPlanData.extraOrderFee
  const s5IncludedOrders = eco.deliveryIncludedOrders ?? deliveryPlanData.includedOrders
  const s5FixedFeePerLoc = eco.deliveryFixedFee ?? deliveryPlanData.priceMonthly
  const renEnabled = eco.renEnabled === true
  const renFeePerOrder = eco.renFeePerOrder ?? 0.10
  const renVenues = eco.renVenues ?? 1
  const deliveryPerVenue = cfg.deliveryOrdersPerVenue ?? 0
  const renMonthly = renEnabled ? renFeePerOrder * deliveryPerVenue * renVenues : 0
  const s5KdsVenues = eco.kdsVenues ?? cfg.locations
  const s5KioskVenues = eco.kioskVenues ?? cfg.locations
  const hwItems = cfg.hardware.filter(h => h.quantity > 0)

  const planRows: string[][] = [
    ['Volumen tickets/mes/local', 'Hasta 500',                   '501 – 1.000',                    'Más de 1.000'],
    ['Precio base',               'Gratis',                      `${fmt(15)}/local/mes`,            `${fmt(35)}/local/mes`],
    ['Fee variable',              '0,08 €/ticket',               '0,05 €/ticket',                  '0,03 €/ticket'],
    ['Soporte',                   'Email',                       'Email + Chat',                   'Tel · Chat · Email'],
    ['Tiempo respuesta',          '48 h',                        '24 h',                           '4 h'],
    ['Onboarding',                'Self-service',                'Sesión remota',                  'Presencial/remoto'],
    ['Account Manager',           '—',                           '—',                              'Dedicado'],
    ['SLA uptime',                '99,0 %',                      '99,5 %',                         '99,9 %'],
  ]

  const planHeaders = ['Característica', ...tiers.map((t, i) => {
    const lbl = PLANS[t].label
    return i + 1 === hiCol ? `${lbl} ✓` : lbl
  })]

  const activeAddons = cfg.activeAddons

  const content = `
    ${sectionTitle('Planes y add-ons', `Plan seleccionado: ${PLANS[cfg.plan].label}`)}

    <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Comparativa de planes</div>
    ${buildTable(planHeaders, planRows, { hi: hiCol })}

    <div style="margin-top:16px;margin-bottom:4px;">
      <span style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;">ROS incluido en el plan</span>
      <span style="font-size:8.5px;color:#94a3b8;margin-left:6px;">· Por localización</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;margin-bottom:4px;">
      ${PLAN_FEATURES[cfg.plan].map(f => `
        <div style="display:flex;align-items:center;gap:5px;padding:2px 0;">
          <span style="color:#10b981;font-size:12px;line-height:1;font-weight:700;">✓</span>
          <span style="font-size:9.5px;color:#334155;">${f}</span>
        </div>
      `).join('')}
    </div>

    ${activeAddons.length > 0 || hwItems.length > 0 ? `
    <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-top:20px;margin-bottom:8px;">Add-ons y hardware incluidos en esta propuesta</div>
    <div style="display:flex;flex-direction:column;gap:5px;">
      ${activeAddons.map(id => {
        const addon = ADDONS[id]
        if (id === 'delivery_integrations') {
          const dpFixed = s5FixedFeePerLoc * cfg.locations  // use persisted per-loc fee
          return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:7px 11px;background:#f8fafc;border:1px solid #e8eef6;border-radius:6px;">
            <div>
              <span style="font-size:10px;font-weight:600;color:#0f172a;">${addon.label}</span>
              <span style="font-size:9px;color:#94a3b8;margin-left:7px;">${deliveryPlanData.label}</span>
              <div style="font-size:8.5px;color:#94a3b8;margin-top:3px;">
                ${s5IncludedOrders} pedidos incl. · Pedidos adic.: ${s5ExtraFeePerOrder.toFixed(2).replace('.', ',')}€/pedido (variable · mes vencido)
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-left:10px;">
              <span style="font-size:9px;color:#64748b;">${fmt(s5FixedFeePerLoc)}/local/mes</span><br/>
              <span style="font-size:10px;font-weight:700;color:#1e3a5f;font-family:'Courier New',monospace;">${fmt(dpFixed)}/mes</span>
            </div>
          </div>`
        }
        const precio = id === 'datafono'
          ? `${addon.feePercent}% GMV`
          : addon.perConsumption ? 'Por consumo'
          : id === 'kds'
          ? `${fmt(ADDONS['kds'].priceMonthly ?? 19)}/local/mes × ${s5KdsVenues} local${s5KdsVenues > 1 ? 'es' : ''} con KDS`
          : id === 'kiosk'
          ? `${fmt(ADDONS['kiosk'].priceMonthly ?? 19)}/local/mes × ${s5KioskVenues} local${s5KioskVenues > 1 ? 'es' : ''} con Kiosk`
          : `${fmt(addon.priceMonthly ?? 0)}${addon.perLocation ? '/local/mes' : '/mes'}`
        const total = id === 'datafono' ? fmt(eco.datafonoFeeMonthly)
          : addon.perConsumption ? '—'
          : id === 'kds' ? fmt((ADDONS['kds'].priceMonthly ?? 19) * s5KdsVenues)
          : id === 'kiosk' ? fmt((ADDONS['kiosk'].priceMonthly ?? 19) * s5KioskVenues)
          : fmt((addon.priceMonthly ?? 0) * (addon.perLocation ? cfg.locations : 1))
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 11px;background:#f8fafc;border:1px solid #e8eef6;border-radius:6px;">
          <div>
            <span style="font-size:10px;font-weight:600;color:#0f172a;">${addon.label}</span>
            <span style="font-size:9px;color:#94a3b8;margin-left:7px;">${addon.description}</span>
          </div>
          <div style="text-align:right;">
            <span style="font-size:9px;color:#64748b;margin-right:10px;">${precio}</span>
            <span style="font-size:10px;font-weight:700;color:#1e3a5f;font-family:'Courier New',monospace;">${total}/mes</span>
          </div>
        </div>`
      }).join('')}
      ${hwItems.map(item => {
        const hw = HARDWARE[item.hardwareId]
        const lineTotal = item.unitPrice * item.quantity
        const rentalUnit = hw.rentalMonthlyPrice ?? RENTAL_MONTHLY_PRICE
        const importe = item.mode === 'rented'
          ? `${fmt(rentalUnit * item.quantity)}/mes`
          : item.mode === 'financed' && item.financeMonths
          ? `${fmt(Math.ceil(lineTotal / item.financeMonths))}/mes`
          : item.mode === 'included'
          ? 'Incluido en el plan'
          : fmt(lineTotal)
        const modeLabel = item.mode === 'rented' ? 'Mensualidad'
          : item.mode === 'included' ? 'Incluido en el plan'
          : HARDWARE_MODE_LABELS[item.mode]
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 11px;background:#f8fafc;border:1px solid #e8eef6;border-radius:6px;">
          <div>
            <span style="font-size:10px;font-weight:600;color:#0f172a;">${hw.label}</span>
            <span style="font-size:9px;color:#94a3b8;margin-left:7px;">${item.quantity} ud. · ${modeLabel}</span>
          </div>
          <span style="font-size:10px;font-weight:700;color:${item.mode === 'included' ? '#10b981' : '#1e3a5f'};font-family:'Courier New',monospace;">${importe}</span>
        </div>`
      }).join('')}
    </div>` : ''}

    ${renEnabled ? `
    <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-top:18px;margin-bottom:6px;padding-top:12px;border-top:1px solid #e8eef6;">REN — Logística propia</div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 11px;background:#f0f5fb;border:1px solid #dde6f0;border-radius:6px;">
      <div>
        <span style="font-size:10px;font-weight:600;color:#0f172a;">REN · Marketplace logístico</span>
        <span style="font-size:9px;color:#94a3b8;margin-left:7px;">Fee por pedido</span>
      </div>
      <span style="font-size:10px;font-weight:700;color:#1e3a5f;font-family:'Courier New',monospace;">${renFeePerOrder.toFixed(2).replace('.', ',')}€/pedido</span>
    </div>` : ''}

    <div style="margin-top:12px;background:#f8fafc;border:1px solid #e8eef6;border-radius:7px;padding:10px 14px;font-size:9.5px;color:#64748b;line-height:1.6;">
      Sin permanencia mínima · facturación mes a mes · el plan puede cambiarse en cualquier momento.
    </div>`
  return pg(logoUri, content)
}

// ── Section 6: DETALLE DE MÓDULOS ─────────────────────────────────────────────
function s6Modules(logoUri: string): string {
  const mods = [
    ['🖥️','Register POS','TPV táctil en iPad. Gestión de mesas, comandas y pagos integrados. Cierre de caja automático. Funciona sin conexión a internet.'],
    ['📺','KDS — Kitchen Display','Pantalla de cocina digital. Elimina el papel y los errores de comunicación. Muestra tiempos por plato y alerta sobre pedidos retrasados.'],
    ['📲','Kiosk — Self-ordering','Terminal de autopedido. Reduce colas en hora punta, activa el upselling automático y libera al personal para tareas de mayor valor.'],
    ['🌐','Web Ordering','Canal de pedidos online propio sin comisión por pedido. Integración directa con POS y cocina en tiempo real. Personalizable con tu marca.'],
    ['🛵','Delivery — Integraciones','Agrega Glovo, Uber Eats, Just Eat y más en un único panel. Sin tablets adicionales. Los pedidos llegan directamente a cocina.'],
    ['📊','Analítica','Dashboard de ventas en tiempo real. Productos top, rendimiento por local y por hora. Exportación de datos. Versión IA con predicciones de demanda.'],
  ]
  const content = `
    ${sectionTitle('Detalle de módulos', 'Tecnología diseñada para cada punto de la operación')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px;">
      ${mods.map(([ic,t,d]) => `
        <div style="border:1px solid #e8eef6;border-radius:10px;padding:16px;background:#fff;">
          <div style="font-size:24px;margin-bottom:7px;">${ic}</div>
          <div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-bottom:5px;">${t}</div>
          <div style="font-size:10px;color:#64748b;line-height:1.65;">${d}</div>
        </div>`).join('')}
    </div>`
  return pg(logoUri, content)
}

// ── Section 7: SOPORTE ────────────────────────────────────────────────────────
function s7Support(cfg: DealConfiguration, logoUri: string): string {
  const hiCol = cfg.plan === 'starter' ? 1 : cfg.plan === 'growth' ? 2 : 3
  const rows: string[][] = [
    ['Canal de soporte',    'Email',                    'Email + WhatsApp',               'Teléfono · WhatsApp · Email'],
    ['Tiempo de respuesta', '48 h hábiles',             '24 h hábiles',                   '4 h hábiles'],
    ['Onboarding',          'Documentación self-service','Sesión guiada remota',           'Onboarding presencial o remoto'],
    ['Account Manager',     '—',                        '—',                              'Dedicado'],
    ['SLA uptime',          '99,0 %',                   '99,5 %',                         '99,9 %'],
    ['Formación equipo',    'Vídeos y guías',           'Sesión remota (2 h)',            'Sesión presencial (4 h)'],
    ['Actualizaciones',     'Automáticas',              'Automáticas + notas de versión', 'Automáticas + briefing previo'],
  ]
  const content = `
    ${sectionTitle('Soporte y acompañamiento', 'Equipo nativo en español, especializado en hostelería')}
    ${buildTable(['', 'Starter', 'Growth', 'Pro'], rows, { hi: hiCol })}
    <div style="margin-top:13px;background:#f0f5fb;border-left:3px solid #1e3a5f;border-radius:0 6px 6px 0;padding:11px 14px;font-size:10px;color:#334155;line-height:1.6;">
      Nuestro equipo de soporte está formado por especialistas en hostelería con experiencia operativa en restaurantes.
      No subcontratamos el soporte técnico — todos los agentes conocen el sector y hablan tu idioma.
    </div>`
  return pg(logoUri, content)
}

// ── Section 8: ACTIVACIÓN ─────────────────────────────────────────────────────
function s8Activation(logoUri: string): string {
  const phases = [
    ['01','Selección y firma',     'Revisión final de la propuesta, firma digital del contrato de servicios.'],
    ['02','Configuración técnica', 'Setup de la cuenta, configuración de locales, permisos y parámetros de operación.'],
    ['03','Migración de datos',    'Importación de la carta, familias, modificadores y productos existentes.'],
    ['04','Formación del equipo',  'Sesión de formación para el personal de sala, barra y cocina.'],
    ['05','Go Live',               'Activación en producción, primera operación en vivo con soporte on-site o remoto.'],
  ]
  const content = `
    ${sectionTitle('Proceso de activación', 'De la firma al primer pedido real en menos de 24 horas')}
    <div style="display:flex;flex-direction:column;">
      ${phases.map(([n,t,d], i) => `
        <div style="display:flex;align-items:flex-start;gap:13px;padding:13px 0;${i < phases.length - 1 ? 'border-bottom:1px solid #e8eef6;' : ''}">
          <div style="width:34px;height:34px;background:#1e3a5f;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:10px;font-weight:800;color:#fff;">${n}</span>
          </div>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:2px;">${t}</div>
            <div style="font-size:10px;color:#64748b;line-height:1.5;">${d}</div>
          </div>
        </div>`).join('')}
    </div>`
  return pg(logoUri, content)
}

// ── Section 9: POR QUÉ PLATOMICO ─────────────────────────────────────────────
function s9Why(logoUri: string): string {
  const reasons = [
    ['🎯','100% nativo hostelería','Diseñado exclusivamente para restaurantes, bares y dark kitchens. Sin adaptaciones de software genérico.'],
    ['⚡','Activación en 24 horas','Todo el proceso desde la firma hasta el primer pedido en vivo, garantizado en menos de un día laborable.'],
    ['📅','Sin permanencia','Contratos mes a mes. Sin penalizaciones por cancelación. Te quedas porque quieres, no porque estés atrapado.'],
    ['📈','Crece contigo','1 local o 100, el precio se adapta. La plataforma escala sin necesidad de cambiar de solución.'],
    ['🇪🇸','Soporte en español','Equipo nativo, en horario español, con conocimiento real del sector de la hostelería.'],
    ['🔗','Integraciones nativas','Glovo, Uber Eats, Just Eat, pasarelas de pago, sistemas contables. Todo conectado sin desarrollos a medida.'],
  ]
  const content = `
    ${sectionTitle('Por qué Platomico', 'Seis razones que nos diferencian')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">
      ${reasons.map(([ic,t,d]) => `
        <div style="border:1px solid #e8eef6;border-radius:8px;padding:15px;">
          <div style="font-size:22px;margin-bottom:7px;">${ic}</div>
          <div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-bottom:4px;">${t}</div>
          <div style="font-size:10px;color:#64748b;line-height:1.55;">${d}</div>
        </div>`).join('')}
    </div>`
  return pg(logoUri, content)
}

// ── Section 10: PRÓXIMOS PASOS ────────────────────────────────────────────────
function s10NextSteps(deal: Deal, logoUri: string): string {
  const steps = [
    ['1','Revisión de la propuesta', 'Lectura y validación de todos los términos y configuración acordada. Tiempo estimado: 15-20 minutos.'],
    ['2','Confirmación y ajustes',   `Comunica cualquier ajuste necesario a tu Account Executive. <strong>${esc(deal.contact.name)}</strong> recibirá respuesta en menos de 24 horas.`],
    ['3','Firma del contrato',        'Firma digital del contrato de servicios — recibirás un enlace DocuSign por email.'],
    ['4','Go Live',                   'Activación del servicio y primer pedido en vivo en menos de 24 horas hábiles.'],
  ]
  const content = `
    ${sectionTitle('Próximos pasos')}
    <div style="display:flex;flex-direction:column;margin-bottom:22px;">
      ${steps.map(([n,t,d], i) => `
        <div style="display:flex;align-items:flex-start;gap:13px;padding:13px 0;${i < steps.length - 1 ? 'border-bottom:1px solid #e8eef6;' : ''}">
          <div style="width:30px;height:30px;border:2px solid #1e3a5f;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:12px;font-weight:800;color:#1e3a5f;">${n}</span>
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:2px;">${t}</div>
            <div style="font-size:10px;color:#64748b;line-height:1.5;">${d}</div>
          </div>
        </div>`).join('')}
    </div>
    <div style="background:#f0f5fb;border-radius:10px;padding:15px 18px;display:flex;align-items:center;gap:13px;">
      <div style="font-size:26px;">📬</div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-bottom:2px;">¿Alguna duda antes de firmar?</div>
        <div style="font-size:10px;color:#334155;line-height:1.5;">
          Escríbenos a <strong>hola@platomico.com</strong> o llámanos. Estaremos encantados de resolver cualquier pregunta sobre la configuración, el precio o el proceso de activación.
        </div>
      </div>
    </div>`
  return pg(logoUri, content)
}

// ── Section 11: RESUMEN ECONÓMICO ─────────────────────────────────────────────
function s11Economics(deal: Deal, cfg: DealConfiguration, sections: ProposalSections, logoUri: string): string {
  const eco = cfg.economics as DealEconomics & {
    renEnabled?: boolean
    renFeePerOrder?: number
    renVenues?: number
    discountPercent?: number
    kdsVenues?: number
    kioskVenues?: number
    discountName?: string
    deliveryPlan?: string
    deliveryPlanKey?: string
    deliveryFixedFee?: number       // per local/mes — canonical persisted field
    deliveryFixedMonthly?: number   // total (fee × locations) — backward compat
    deliveryExtraFeePerOrder?: number
    deliveryIncludedOrders?: number
  }
  const s11DeliveryPlanId = (eco.deliveryPlanKey ?? eco.deliveryPlan ?? 'start') as DeliveryPlanId
  const s11DeliveryPlan = DELIVERY_PLANS[s11DeliveryPlanId]
  const deliveryActive = cfg.activeAddons.includes('delivery_integrations')
  const s11DeliveryFixed = deliveryActive
    ? (eco.deliveryFixedFee != null
        ? eco.deliveryFixedFee * cfg.locations
        : (eco.deliveryFixedMonthly ?? s11DeliveryPlan.priceMonthly * cfg.locations))
    : 0
  const s11ExtraFeePerOrder = eco.deliveryExtraFeePerOrder ?? s11DeliveryPlan.extraOrderFee
  const plan = PLANS[cfg.plan]
  const activeAddons = cfg.activeAddons.map(id => ADDONS[id])
  const hwItems = cfg.hardware.filter(h => h.quantity > 0)

  const renEnabled = eco.renEnabled === true
  const renFeePerOrder = eco.renFeePerOrder ?? 0.10
  const renVenues = eco.renVenues ?? 1
  const deliveryPerVenue = cfg.deliveryOrdersPerVenue ?? 0
  const renMonthly = renEnabled ? renFeePerOrder * deliveryPerVenue * renVenues : 0

  // KDS/Kiosk venue counts — still needed for per-addon display rows
  const kdsVenues = eco.kdsVenues ?? cfg.locations
  const kioskVenues = eco.kioskVenues ?? cfg.locations

  // KDS/Kiosk per-venue-count adjustment (kdsVenues may differ from cfg.locations)
  const kdsActive = cfg.activeAddons.includes('kds')
  const kioskActive = cfg.activeAddons.includes('kiosk')
  const kdsAdj = kdsActive ? (ADDONS['kds'].priceMonthly ?? 19) * (kdsVenues - cfg.locations) : 0
  const kioskAdj = kioskActive ? (ADDONS['kiosk'].priceMonthly ?? 19) * (kioskVenues - cfg.locations) : 0
  const adjustedSoftwareBase = eco.softwareRevenueMonthly + kdsAdj + kioskAdj + s11DeliveryFixed

  const discountPercent = eco.discountPercent ?? 0
  const discountAmount = adjustedSoftwareBase * (discountPercent / 100)
  const adjustedSoftware = adjustedSoftwareBase - discountAmount
  const fixedMonthlyNet = adjustedSoftware + eco.hardwareRevenueMonthly

  const execSummary = sections.executiveSummary
    ? sections.executiveSummary +
      (renEnabled && deliveryPerVenue > 0
        ? ` Incluye logística propia a través de REN con ${fmtN(deliveryPerVenue * renVenues)} pedidos de delivery mensuales en ${renVenues} local${renVenues > 1 ? 'es' : ''}.`
        : '')
    : ''

  const simpleRow = (label: string, value: string, red = false) => `
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f1f5f9;">
      <span style="font-size:9.5px;color:${red ? '#dc2626' : '#64748b'};">${label}</span>
      <span style="font-size:9.5px;font-weight:600;color:${red ? '#dc2626' : '#0f172a'};font-family:'Courier New',monospace;">${value}</span>
    </div>`

  // Hardware items by mode
  const hwSold     = hwItems.filter(i => i.mode === 'sold')
  const hwMonthly  = hwItems.filter(i => i.mode === 'financed' || i.mode === 'rented')
  const hwIncluded = hwItems.filter(i => i.mode === 'included')
  const hwUpfrontNet = hwSold.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  const hwItemRow = (item: typeof hwItems[0], net: number, suffix: string) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #f1f5f9;gap:4px;">
      <span style="font-size:9px;color:#334155;flex-shrink:0;">${HARDWARE[item.hardwareId].label} · ${item.quantity} ud.</span>
      <span style="font-size:9.5px;font-weight:700;color:#1e3a5f;font-family:'Courier New',monospace;">${fmt(net)}${suffix}</span>
    </div>`

  const content = `
    ${sectionTitle('Resumen económico', `${deal.company.name} · Plan ${plan.label}`)}

    <div style="display:grid;grid-template-columns:${renEnabled ? '1fr 1fr 1fr' : '1fr 1fr'};gap:10px;margin-bottom:14px;">
      <!-- ROS (informacional) -->
      <div style="border:1px solid #dde6f0;border-radius:8px;padding:12px;">
        <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e8eef6;">ROS</div>
        ${simpleRow('Plan', plan.label)}
        ${simpleRow('Precio base', plan.priceMonthly === 0
          ? 'Gratis'
          : `${fmt(plan.priceMonthly)}/local/mes × ${cfg.locations} local${cfg.locations > 1 ? 'es' : ''}`)}
        ${simpleRow('Fee variable', `${plan.variableFee}€/ticket`)}
        ${discountPercent > 0 ? simpleRow(eco.discountName ? `Descuento ${eco.discountName}` : 'Descuento', `−${discountPercent}%`, true) : ''}
        ${(() => {
          // Add-ons total row: engine addonFeeMonthly + venue adj + delivery
          const totalAddons = eco.addonFeeMonthly + kdsAdj + kioskAdj + s11DeliveryFixed
          return totalAddons > 0 ? simpleRow('Add-ons (total)', `${fmt(totalAddons)}/mes`) : ''
        })()}
        ${activeAddons.length > 0 ? `
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e8eef6;">
            <div style="font-size:7.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Detalle add-ons</div>
            ${activeAddons.map(a => {
              const addonNet = a.id === 'delivery_integrations' ? s11DeliveryFixed
                : a.id === 'kds' ? (ADDONS['kds'].priceMonthly ?? 19) * kdsVenues
                : a.id === 'kiosk' ? (ADDONS['kiosk'].priceMonthly ?? 19) * kioskVenues
                : a.priceMonthly != null ? a.priceMonthly * (a.perLocation ? cfg.locations : 1) : null
              const addonVal = a.id === 'delivery_integrations'
                ? `${fmt(s11DeliveryFixed)}/mes`
                : a.id === 'datafono' ? `${a.feePercent}% GMV`
                : a.perConsumption ? 'Por consumo'
                : addonNet != null ? `${fmt(addonNet)}/mes` : '—'
              const addonSub = a.id === 'delivery_integrations'
                ? `<div style="font-size:7.5px;color:#94a3b8;">${s11DeliveryPlan.label} · ${s11ExtraFeePerOrder.toFixed(2).replace('.', ',')}€/ped. adic. (variable)</div>`
                : ''
              return `<div style="padding:2px 0;">
                <div style="display:flex;justify-content:space-between;gap:4px;">
                  <span style="font-size:8.5px;color:#334155;">${a.label}</span>
                  <span style="font-size:8px;color:#1e3a5f;font-family:'Courier New',monospace;text-align:right;">${addonVal}</span>
                </div>
                ${addonSub}
              </div>`
            }).join('')}
          </div>` : ''}
      </div>

      ${renEnabled ? `
      <!-- REN (informacional) -->
      <div style="border:1px solid #dde6f0;border-radius:8px;padding:12px;">
        <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e8eef6;">REN</div>
        ${simpleRow('Fee por pedido', `${renFeePerOrder.toFixed(2).replace('.', ',')}€/pedido`)}
        ${simpleRow('Pedidos/mes/local', fmtN(deliveryPerVenue))}
        ${simpleRow('Locales con REN', String(renVenues))}
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #e8eef6;font-size:8px;color:#94a3b8;line-height:1.4;">
          Coste variable · liquidado a mes vencido según pedidos reales
        </div>
      </div>` : ''}

      <!-- Hardware -->
      <div style="border:1px solid #dde6f0;border-radius:8px;padding:12px;">
        <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e8eef6;">Hardware</div>
        ${hwItems.length === 0
          ? `<div style="font-size:10px;color:#94a3b8;font-style:italic;">Sin hardware configurado</div>`
          : `
          ${hwSold.length > 0 ? `
            <div style="font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Pago único (upfront)</div>
            ${hwSold.map(item => hwItemRow(item, item.unitPrice * item.quantity, '')).join('')}
            ${hwSold.length > 1 ? `
              <div style="display:flex;justify-content:space-between;padding:3px 0;margin-top:2px;">
                <span style="font-size:8.5px;font-weight:700;color:#64748b;">Subtotal upfront</span>
                <span style="font-size:9px;font-weight:800;color:#1e3a5f;font-family:'Courier New',monospace;">${fmt(hwUpfrontNet)}</span>
              </div>` : ''}` : ''}
          ${hwMonthly.length > 0 ? `
            <div style="font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-top:${hwSold.length > 0 ? '8' : '0'}px;margin-bottom:4px;">Mensualidad</div>
            ${hwMonthly.map(item => {
              const lineTotal = item.unitPrice * item.quantity
              const rentalUnitPrice = HARDWARE[item.hardwareId].rentalMonthlyPrice ?? RENTAL_MONTHLY_PRICE
              const net = item.mode === 'financed' && item.financeMonths ? Math.ceil(lineTotal / item.financeMonths) : rentalUnitPrice * item.quantity
              return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #f1f5f9;gap:4px;">
                <span style="font-size:9px;color:#334155;flex-shrink:0;">${HARDWARE[item.hardwareId].label} · ${item.quantity} ud.</span>
                <span style="font-size:9.5px;font-weight:600;color:#1e3a5f;font-family:'Courier New',monospace;">${fmt(net)}/mes</span>
              </div>`
            }).join('')}` : ''}
          ${hwIncluded.length > 0 ? `
            <div style="font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-top:${(hwSold.length > 0 || hwMonthly.length > 0) ? '8' : '0'}px;margin-bottom:4px;">Incluido en el plan</div>
            ${hwIncluded.map(item => `
              <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f1f5f9;">
                <span style="font-size:9px;color:#334155;">${HARDWARE[item.hardwareId].label} · ${item.quantity} ud.</span>
                <span style="font-size:9px;color:#10b981;font-weight:600;">Incluido</span>
              </div>`).join('')}` : ''}
        `}
      </div>
    </div>

    <!-- Total fijo mensual / Coste variable estimado (below columns) -->
    ${cfg.calculateVariable ? (() => {
      const rosTotal = plan.variableFee * eco.totalMonthlyVolume
      const renTotal = renEnabled && renVenues > 0 ? renFeePerOrder * deliveryPerVenue * renVenues : 0
      const varTotal = rosTotal + renTotal
      return `
    <div style="border:2px solid #1e3a5f;border-radius:12px;padding:16px 20px;background:#f0f5fb;margin-bottom:10px;">
      <div style="font-size:8.5px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;text-align:center;">Coste variable estimado</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid #dde6f0;">
          <span style="font-size:9px;color:#334155;">ROS · ${plan.variableFee.toFixed(2).replace('.', ',')}€/ticket × ${fmtN(eco.totalMonthlyVolume)} pedidos</span>
          <span style="font-size:10px;font-weight:700;color:#1e3a5f;font-family:'Courier New',monospace;">${fmt(rosTotal)}/mes</span>
        </div>
        ${renEnabled && renVenues > 0 ? `
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid #dde6f0;">
          <span style="font-size:9px;color:#334155;">REN · ${renFeePerOrder.toFixed(2).replace('.', ',')}€/pedido × ${fmtN(deliveryPerVenue * renVenues)} pedidos</span>
          <span style="font-size:10px;font-weight:700;color:#1e3a5f;font-family:'Courier New',monospace;">${fmt(renTotal)}/mes</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid #dde6f0;">
          <span style="font-size:9px;color:#334155;">Base imponible</span>
          <span style="font-size:10px;font-weight:700;color:#1e3a5f;font-family:'Courier New',monospace;">${fmt2(varTotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid #dde6f0;">
          <span style="font-size:9px;color:#334155;">IVA 21%</span>
          <span style="font-size:10px;font-weight:700;color:#1e3a5f;font-family:'Courier New',monospace;">${fmt2(varTotal * 0.21)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:6px 0 2px;">
          <span style="font-size:9.5px;font-weight:700;color:#334155;">Total estimado (IVA incl.)</span>
          <span style="font-size:18px;font-weight:900;color:#1e3a5f;font-family:'Courier New',monospace;">${fmt2(varTotal * 1.21)}/mes</span>
        </div>
      </div>
    </div>
    <div style="border:1px solid #e8eef6;border-radius:8px;padding:10px 14px;background:#f8fafc;font-size:8.5px;color:#334155;line-height:1.6;margin-bottom:6px;">
      Coste estimado basado en volumen configurado. Se factura a mes vencido según pedidos reales.${hwUpfrontNet > 0 ? `
      <br><strong>Pago único hardware:</strong> ${fmt(hwUpfrontNet)} — facturado a la activación.` : ''}
    </div>`
    })() : `
    <div style="border:2px solid #1e3a5f;border-radius:12px;padding:14px 20px;background:#f0f5fb;margin-bottom:10px;">
      <div style="font-size:8.5px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;text-align:center;">Total fijo / mes (add-ons + hardware mensualidad)</div>
      <!-- Breakdown rows: Plan / Add-ons / Hardware -->
      <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #dde6f0;">
        ${simpleRow('Plan', `${fmt(eco.planFeeMonthly)}/mes`)}
        ${(eco.addonFeeMonthly + kdsAdj + kioskAdj + s11DeliveryFixed) > 0
          ? simpleRow('Add-ons', `${fmt(eco.addonFeeMonthly + kdsAdj + kioskAdj + s11DeliveryFixed)}/mes`)
          : ''}
        ${eco.hardwareRevenueMonthly > 0 ? simpleRow('Hardware (cuotas)', `${fmt(eco.hardwareRevenueMonthly)}/mes`) : ''}
        ${discountPercent > 0 ? simpleRow(eco.discountName ? `Descuento ${eco.discountName}` : 'Descuento', `−${fmt(discountAmount)}/mes`, true) : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;">
        <div style="text-align:center;">
          <div style="font-size:22px;font-weight:900;color:#334155;font-family:'Courier New',monospace;line-height:1;">${fmt(fixedMonthlyNet)}</div>
          <div style="font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">neto</div>
        </div>
        <div style="font-size:16px;color:#94a3b8;font-weight:300;margin-bottom:8px;">+</div>
        <div style="text-align:center;">
          <div style="font-size:22px;font-weight:900;color:#64748b;font-family:'Courier New',monospace;line-height:1;">${fmt(fixedMonthlyNet * 0.21)}</div>
          <div style="font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">IVA 21%</div>
        </div>
        <div style="font-size:16px;color:#94a3b8;font-weight:300;margin-bottom:8px;">=</div>
        <div style="text-align:center;background:#1e3a5f;padding:8px 16px;border-radius:8px;">
          <div style="font-size:26px;font-weight:900;color:#fff;font-family:'Courier New',monospace;line-height:1;">${fmtVAT(fixedMonthlyNet)}</div>
          <div style="font-size:7px;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:1px;margin-top:2px;">total/mes</div>
        </div>
      </div>
      ${discountPercent > 0 ? `<div style="font-size:8px;color:#dc2626;margin-top:8px;text-align:center;">Descuento −${discountPercent}% aplicado sobre neto · ahorro ${fmt(discountAmount)}/mes</div>` : ''}
    </div>

    <!-- Footer variable -->
    <div style="border:1px solid #e8eef6;border-radius:8px;padding:10px 14px;background:#f8fafc;font-size:8.5px;color:#334155;line-height:1.6;">
      <strong>Total fijo/mes:</strong> ${fmt(fixedMonthlyNet)}
      + <strong>variable por pedido:</strong>
      ROS: ${plan.variableFee.toFixed(2).replace('.', ',')}€/ticket${renEnabled ? ` · REN: ${renFeePerOrder.toFixed(2).replace('.', ',')}€/pedido` : ''}
      — liquidado a mes vencido en factura.${hwUpfrontNet > 0 ? `
      <br><strong>Pago único hardware:</strong> ${fmt(hwUpfrontNet)} — facturado a la activación.` : ''}
    </div>
    `}

    `
  return pg(logoUri, content)
}

// ── Section 12: ANEXO DATOS ───────────────────────────────────────────────────
function s12Annex(deal: Deal, cfg: DealConfiguration, today: string, logoUri: string): string {
  const content = `
    ${sectionTitle('Anexo A: Datos de las partes')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
      <!-- Platomico -->
      <div style="border:1.5px solid #1e3a5f;border-radius:10px;overflow:hidden;">
        <div style="background:#1e3a5f;padding:11px 15px;">
          <div style="font-size:8px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Prestador del servicio</div>
          <div style="font-size:14px;font-weight:800;color:#fff;">Platomico, S.L.</div>
        </div>
        <div style="padding:14px;">
          ${[
            ['NIF',                'B22741094'],
            ['Domicilio social',   'C/ Antonio Machado 9, Rozas de Puerto Real, Madrid 28649'],
            ['Registro Mercantil', 'Madrid, hoja M-858953'],
            ['Email',             'hola@platomico.com'],
            ['Web',               'platomico.com'],
          ].map(([k,v]) => `
            <div style="padding:4px 0;border-bottom:1px solid #f1f5f9;display:flex;flex-direction:column;gap:1px;">
              <span style="font-size:7.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">${k}</span>
              <span style="font-size:10px;color:#0f172a;font-weight:500;">${v}</span>
            </div>`).join('')}
        </div>
      </div>
      <!-- Cliente -->
      <div style="border:1px solid #dde6f0;border-radius:10px;overflow:hidden;">
        <div style="background:#e8eef6;padding:11px 15px;">
          <div style="font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Cliente</div>
          <div style="font-size:14px;font-weight:800;color:#1e3a5f;">${esc(deal.company.name)}</div>
        </div>
        <div style="padding:14px;">
          ${[
            ['NIF / CIF',  deal.company.cif || '— (a cumplimentar)'],
            ['Domicilio',  deal.company.address || deal.company.city || '— (a cumplimentar)'],
            ['Contacto',   deal.contact.name],
            ['Email',      deal.contact.email],
            ['Teléfono',   deal.contact.phone || '—'],
          ].map(([k,v]) => `
            <div style="padding:4px 0;border-bottom:1px solid #f1f5f9;display:flex;flex-direction:column;gap:1px;">
              <span style="font-size:7.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">${k}</span>
              <span style="font-size:10px;color:#0f172a;font-weight:500;">${v}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div style="margin-top:14px;background:#f8fafc;border:1px solid #e8eef6;border-radius:8px;padding:13px 15px;font-size:9.5px;color:#64748b;line-height:1.6;">
      La presente propuesta tiene validez de <strong>30 días naturales</strong> a partir de la fecha de emisión (Madrid, ${today}).
      Los precios indicados son en euros e incluyen IVA al 21%.
      La aceptación de esta propuesta implica la celebración de un contrato de prestación de servicios
      bajo las Condiciones Generales publicadas en <strong>platomico.com/legal</strong>.
    </div>
    <div style="margin-top:10px;background:#f8fafc;border:1px solid #e8eef6;border-radius:8px;padding:13px 15px;font-size:9.5px;color:#64748b;line-height:1.6;">
      <strong style="color:#334155;">DESPLAZAMIENTOS Y DIETAS.</strong> Los desplazamientos, dietas, pernoctas y demás gastos en los que incurra el prestador del servicio como consecuencia directa de la ejecución del presente contrato fuera de la Comunidad de Madrid serán repercutidos íntegramente al cliente mediante factura independiente acompañada de los justificantes correspondientes, tomando como referencia orientativa los límites establecidos por la normativa fiscal vigente en España.
    </div>
    <div style="margin-top:10px;background:#f8fafc;border:1px solid #e8eef6;border-radius:8px;padding:13px 15px;font-size:9.5px;color:#64748b;line-height:1.6;">
      <strong style="color:#334155;">FACTURACIÓN.</strong> Los servicios contratados en virtud del presente acuerdo se facturarán de forma trimestral, emitiéndose la correspondiente factura al inicio de cada trimestre natural. El cliente se obliga a abonar cada factura en un plazo máximo de treinta (30) días naturales desde su recepción.
    </div>
    <div style="margin-top:10px;background:#f8fafc;border:1px solid #e8eef6;border-radius:8px;padding:13px 15px;font-size:9.5px;color:#64748b;line-height:1.6;">
      <strong style="color:#334155;">PROTECCIÓN DE DATOS.</strong> En cumplimiento del Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD), Platomico, S.L. tratará los datos de carácter personal facilitados por el Cliente exclusivamente para la gestión, prestación y facturación de los servicios contratados. Los datos no serán cedidos a terceros salvo obligación legal. El Cliente podrá ejercer sus derechos de acceso, rectificación, supresión, portabilidad y oposición dirigiéndose a hola@platomico.com. El responsable del tratamiento es Platomico, S.L., NIF B22741094.
    </div>`
  return pg(logoUri, content)
}

// ── Section 13: FIRMA ─────────────────────────────────────────────────────────
function s13Signature(deal: Deal, today: string, logoUri: string): string {
  const content = `
    ${sectionTitle('Anexo B: Aceptación y firma del contrato')}
    <div style="font-size:11px;color:#334155;line-height:1.7;margin-bottom:22px;">
      Las partes abajo firmantes declaran haber leído y comprendido la totalidad de la presente propuesta comercial
      y manifiestan su conformidad con los términos, condiciones y precios recogidos en el mismo.
      Mediante la firma de este documento, el Cliente acepta los servicios de Platomico, S.L.
      y autoriza el inicio del proceso de activación descrito en la Sección 6.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-bottom:26px;">
      <div style="border:1.5px solid #1e3a5f;border-radius:10px;padding:18px;">
        <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Por Platomico, S.L.</div>
        <div style="font-size:10px;color:#64748b;margin-bottom:18px;">NIF B22741094 · Madrid</div>
        <div style="border-bottom:1.5px solid #1e3a5f;margin-bottom:7px;height:46px;"></div>
        <div style="font-size:11px;font-weight:700;color:#0f172a;">César Castro</div>
        <div style="font-size:9px;color:#64748b;">Platomico, S.L.</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">
          <span style="font-size:9px;color:#94a3b8;">Lugar y fecha</span>
          <div style="border-bottom:1px solid #cbd5e1;width:150px;height:16px;"></div>
        </div>
      </div>
      <div style="border:1px solid #dde6f0;border-radius:10px;padding:18px;">
        <div style="font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Por: ${esc(deal.company.name)}</div>
        <div style="font-size:10px;color:#64748b;margin-bottom:18px;">${deal.company.cif ? `CIF ${deal.company.cif}` : 'Cliente'}</div>
        <div style="border-bottom:1.5px solid #334155;margin-bottom:7px;height:46px;"></div>
        <div style="font-size:11px;font-weight:700;color:#0f172a;">${esc(deal.contact.name)}</div>
        <div style="font-size:9px;color:#64748b;">${esc(deal.contact.email)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">
          <span style="font-size:9px;color:#94a3b8;">Lugar y fecha</span>
          <div style="border-bottom:1px solid #cbd5e1;width:150px;height:16px;"></div>
        </div>
      </div>
    </div>
    <div style="margin-top:18px;text-align:center;font-size:8.5px;color:#94a3b8;line-height:1.6;">
      DOCUMENTO CONFIDENCIAL · Al firmar, el Cliente acepta las Condiciones Generales publicadas en platomico.com/legal<br>
      © Platomico, S.L. · ${new Date().getFullYear()} · Todos los derechos reservados.
    </div>`
  // Última página: last=true → sin break-after
  return pg(logoUri, content, true)
}

// ── Full dossier assembler ────────────────────────────────────────────────────
function buildFullDossier(
  deal: Deal,
  cfg: DealConfiguration,
  sections: ProposalSections,
  today: string,
  logoUri: string
): string {
  const styles = `
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family:Helvetica,Arial,sans-serif;
      font-size:11px; line-height:1.5; color:#0f172a;
      background:#fff;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    p { margin:0; }
    strong { font-weight:700; }
    /* Ensure break-after:page is respected in print/PDF mode */
    @media print {
      .pg { break-after: page; }
      .pg:last-child { break-after: auto; }
    }`

  const pages = [
    s1Cover(deal, cfg, today, logoUri),
    s2Index(logoUri),
    s3About(logoUri),
    s4Purpose(logoUri),
    s6Modules(logoUri),
    s5Plans(deal, cfg, logoUri),
    s7Support(cfg, logoUri),
    s11Economics(deal, cfg, sections, logoUri),
    s8Activation(logoUri),
    s12Annex(deal, cfg, today, logoUri),
    s13Signature(deal, today, logoUri),
  ].join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<style>${styles}</style>
</head>
<body>
${pages}
</body>
</html>`
}
