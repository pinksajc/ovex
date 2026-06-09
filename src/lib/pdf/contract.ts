// =========================================
// CONTRACT PDF GENERATOR — Contrato de Prestación de Servicios
// server-only
//
// 4 páginas:
//  1. Encabezado + Partes
//  2. Objeto + Servicios contratados
//  3. Condiciones (duración, permanencia, pago, cláusulas)
//  4. Firmas
//
// Watermark CONFIDENCIAL en cada página.
// =========================================

import fs from 'fs'
import path from 'path'
import type { Presupuesto, InvoiceLineItem } from '@/types'
import { renderHtmlToPdf } from './generate'

export interface ContractParams {
  duracionMeses: number
  permanenciaMeses: number
  formaPago: string
  fechaInicio: string  // YYYY-MM-DD
  notas?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br/>')
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  // If we land on a non-existent day (e.g. Mar 31 + 1 month → May 1) adjust back
  return d.toISOString().split('T')[0]
}

// ── Services table rows ───────────────────────────────────────────────────────

function renderServiceRows(items: InvoiceLineItem[]): string {
  if (!items || items.length === 0) return ''

  return items
    .filter((i) => i.type === 'line')
    .map((item) => {
      const net = item.amount
      return `
        <tr>
          <td>${esc(item.description || '—')}${item.period ? `<div class="item-period">${esc(item.period)}</div>` : ''}</td>
          <td class="right mono">${fmt(item.quantity)}</td>
          <td class="right mono">${fmt(item.unitPrice)} €</td>
          <td class="right mono fw6">${fmt(net)} €</td>
        </tr>`
    })
    .join('')
}

// ── Watermark helper ──────────────────────────────────────────────────────────

const WM = `<div class="watermark">CONFIDENCIAL</div>`

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateContractPdf(
  presupuesto: Presupuesto,
  params: ContractParams,
): Promise<Buffer> {
  const logo = readLogoDataUri()

  const {
    duracionMeses,
    permanenciaMeses,
    formaPago,
    fechaInicio,
    notas,
  } = params

  const fechaFin  = addMonths(fechaInicio, duracionMeses)
  const today     = fmtDate(fechaInicio) // use start date as the "signing date" on page 1
  const startStr  = fmtDate(fechaInicio)
  const endStr    = fmtDate(fechaFin)

  const items       = presupuesto.lineItems ?? []
  const vatAmount   = presupuesto.amountNet * (presupuesto.vatRate / 100)
  const hasItems    = items.filter((i) => i.type === 'line').length > 0

  const logoHtml = logo
    ? `<img class="logo" src="${logo}" alt="Platomico"/>`
    : `<span style="font-size:14px;font-weight:700;color:#1e3a5f;">Platomico</span>`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10px;
    color: #1e293b;
    background: #fff;
  }

  /* ── Page containers ── */
  .pg {
    width: 210mm;
    min-height: 297mm;
    padding: 22mm 20mm 18mm;
    position: relative;
    /* No overflow:hidden — lets the diagonal watermark bleed to page edges */
    break-after: page;
    page-break-after: always;
  }
  .pg:last-child {
    break-after: avoid;
    page-break-after: avoid;
  }

  /* ── Watermark — full-page diagonal, matches Orvex PDF style ── */
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    /* Center then rotate so the text spans the full page diagonal */
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 130px;
    font-weight: 900;
    color: rgba(0,0,0,0.04);
    letter-spacing: 18px;
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    z-index: 0;
  }

  /* ── Content layer above watermark ── */
  .ct { position: relative; z-index: 1; }

  /* ── Logo header ── */
  .logo { height: 20px; object-fit: contain; }
  .pg-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 2px solid #1e3a5f;
    margin-bottom: 20px;
  }
  .pg-header-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #94a3b8;
  }

  /* ── Page 1: Title & Parties ── */
  .contract-title {
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    color: #1e3a5f;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin: 24px 0 6px;
  }
  .contract-subtitle {
    text-align: center;
    font-size: 9px;
    color: #64748b;
    margin-bottom: 28px;
  }
  .section-title {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #94a3b8;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #f1f5f9;
  }
  .party-block {
    background: #f8fafc;
    border-left: 3px solid #1e3a5f;
    border-radius: 0 6px 6px 0;
    padding: 12px 16px;
    margin-bottom: 14px;
  }
  .party-role {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
    margin-bottom: 5px;
  }
  .party-name {
    font-size: 12px;
    font-weight: 700;
    color: #1e3a5f;
    margin-bottom: 4px;
  }
  .party-detail {
    font-size: 9px;
    color: #475569;
    line-height: 1.7;
  }
  .exponen {
    background: #f0f4f8;
    border-radius: 6px;
    padding: 12px 16px;
    font-size: 9.5px;
    color: #334155;
    line-height: 1.7;
    margin-top: 18px;
  }
  .acuerdan {
    margin-top: 14px;
    font-size: 10.5px;
    font-weight: 700;
    color: #1e3a5f;
    text-align: center;
    letter-spacing: 0.5px;
  }

  /* ── Page 2: Services ── */
  .clause-num {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #1e3a5f;
    margin-bottom: 6px;
  }
  .clause-body {
    font-size: 9.5px;
    color: #475569;
    line-height: 1.7;
    margin-bottom: 16px;
  }
  table.svc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 18px;
    font-size: 9.5px;
  }
  table.svc-table thead tr {
    background: #1e3a5f;
    color: #fff;
  }
  table.svc-table thead th {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    padding: 8px 10px;
    text-align: left;
  }
  table.svc-table thead th.right { text-align: right; }
  table.svc-table tbody tr { border-bottom: 1px solid #f1f5f9; }
  table.svc-table tbody td {
    padding: 8px 10px;
    color: #334155;
  }
  table.svc-table tbody td.right { text-align: right; }
  .item-period { font-size: 8px; color: #94a3b8; margin-top: 2px; }
  .mono { font-family: 'Courier New', monospace; }
  .right { text-align: right; }
  .fw6 { font-weight: 600; }
  .totals-box {
    margin-left: auto;
    width: 280px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 14px;
    font-size: 10px;
    border-bottom: 1px solid #f1f5f9;
  }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.grand {
    background: #1e3a5f;
    color: #fff;
    font-weight: 700;
    padding: 11px 14px;
  }
  .totals-row .lbl { color: #64748b; }
  .totals-row.grand .lbl { color: #cbd5e1; font-size: 9px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.6px; }
  .totals-row .amt { font-family: 'Courier New', monospace; font-weight: 600; }
  .totals-row.grand .amt { font-size: 13px; }

  /* ── Page 3: Conditions ── */
  .clause { margin-bottom: 18px; }
  .clause .clause-num { margin-bottom: 4px; }
  .clause .clause-body { margin-bottom: 0; }
  .highlight-box {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #f0f4f8;
    border-radius: 6px;
    padding: 6px 12px;
    margin: 4px 0 8px;
    font-size: 9.5px;
    font-weight: 600;
    color: #1e3a5f;
  }

  /* ── Page 4: Signatures ── */
  .sig-intro {
    font-size: 9.5px;
    color: #475569;
    line-height: 1.8;
    text-align: center;
    margin: 24px 0 36px;
  }
  .sig-cols {
    display: flex;
    gap: 32px;
    margin-top: 16px;
  }
  .sig-col {
    flex: 1;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px;
  }
  .sig-col-title {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f1f5f9;
  }
  .sig-name { font-size: 11px; font-weight: 700; color: #1e3a5f; margin-bottom: 3px; }
  .sig-role { font-size: 9px; color: #64748b; margin-bottom: 2px; }
  .sig-nif  { font-size: 9px; color: #94a3b8; }
  .sig-presigned {
    margin-top: 16px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 9px;
    font-weight: 700;
    color: #059669;
  }
  .sig-line {
    font-size: 9px;
    color: #475569;
    margin-bottom: 24px;
    padding-bottom: 4px;
    border-bottom: 1px solid #cbd5e1;
  }
  .sig-line-label {
    font-size: 8px;
    color: #94a3b8;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
</style>
</head>
<body>

<!-- ══════════════════════════════════════════════════════════════════════
     PÁGINA 1 — ENCABEZADO Y PARTES
══════════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}
  <div class="ct">

    <div class="pg-header">
      ${logoHtml}
      <span class="pg-header-label">Documento confidencial</span>
    </div>

    <div class="contract-title">Contrato de Prestación de Servicios</div>
    <div class="contract-subtitle">En Madrid, a ${today}</div>

    <div class="section-title">Reunidos</div>

    <div class="party-block">
      <div class="party-role">De una parte — Proveedor</div>
      <div class="party-name">Platomico, S.L.</div>
      <div class="party-detail">
        NIF: B22741094<br/>
        C/ Antonio Machado 9, Rozas de Puerto Real, Madrid 28649<br/>
        Representada por <strong>César Augusto Castro Sáder</strong>, en calidad de <strong>Administrador Único</strong>
      </div>
    </div>

    <div class="party-block">
      <div class="party-role">De otra parte — Cliente</div>
      <div class="party-name">${esc(presupuesto.clientName)}</div>
      <div class="party-detail">
        ${presupuesto.clientCif ? `NIF/CIF: ${esc(presupuesto.clientCif)}<br/>` : ''}
        ${presupuesto.clientAddress ? esc(presupuesto.clientAddress) : ''}
      </div>
    </div>

    <div class="exponen">
      Ambas partes se reconocen mutuamente capacidad legal suficiente para obligarse mediante el
      presente contrato y, al efecto, <strong>EXPONEN</strong> que Platomico, S.L. es una empresa especializada
      en el desarrollo y gestión de soluciones tecnológicas para la restauración; y que el Cliente
      desea contratar los servicios descritos en el presente documento en los términos y condiciones
      que se detallan a continuación.
    </div>

    <div class="acuerdan">— ACUERDAN —</div>

  </div>
</div>


<!-- ══════════════════════════════════════════════════════════════════════
     PÁGINA 2 — OBJETO Y SERVICIOS CONTRATADOS
══════════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}
  <div class="ct">

    <div class="pg-header">
      ${logoHtml}
      <span class="pg-header-label">Contrato de Prestación de Servicios · Objeto del contrato</span>
    </div>

    <div class="clause">
      <div class="clause-num">Cláusula 1ª — Objeto del Contrato</div>
      <div class="clause-body">
        El presente contrato tiene por objeto la prestación, por parte de Platomico, S.L. al Cliente,
        de los servicios tecnológicos descritos a continuación, en los términos y condiciones pactados.
      </div>
    </div>

    <table class="svc-table">
      <thead>
        <tr>
          <th>Descripción del servicio</th>
          <th class="right" style="width:60px;">Cantidad</th>
          <th class="right" style="width:95px;">Precio unit.</th>
          <th class="right" style="width:95px;">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${hasItems
          ? renderServiceRows(items)
          : `<tr>
              <td>${esc(presupuesto.concept || 'Servicios según oferta')}</td>
              <td class="right mono">1</td>
              <td class="right mono">${fmt(presupuesto.amountNet)} €</td>
              <td class="right mono fw6">${fmt(presupuesto.amountNet)} €</td>
            </tr>`
        }
      </tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row">
        <span class="lbl">Base imponible</span>
        <span class="amt mono">${fmt(presupuesto.amountNet)} €</span>
      </div>
      <div class="totals-row">
        <span class="lbl">IVA (${fmt(presupuesto.vatRate)}%)</span>
        <span class="amt mono">${fmt(vatAmount)} €</span>
      </div>
      <div class="totals-row grand">
        <span class="lbl">Total contrato (mensual)</span>
        <span class="amt">${fmt(presupuesto.amountTotal)} €</span>
      </div>
    </div>

  </div>
</div>


<!-- ══════════════════════════════════════════════════════════════════════
     PÁGINA 3 — CONDICIONES
══════════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}
  <div class="ct">

    <div class="pg-header">
      ${logoHtml}
      <span class="pg-header-label">Contrato de Prestación de Servicios · Condiciones</span>
    </div>

    <div class="clause">
      <div class="clause-num">Cláusula 2ª — Duración y Vigencia</div>
      <div class="clause-body">
        El presente contrato tendrá una duración de <strong>${duracionMeses} meses</strong>, con fecha de inicio
        el <strong>${startStr}</strong> y fecha de vencimiento el <strong>${endStr}</strong>.
        Transcurrido dicho período, el contrato se renovará automáticamente por períodos anuales
        salvo que cualquiera de las partes lo notifique por escrito con al menos 30 días de antelación.
      </div>
      <div class="highlight-box">
        Inicio: ${startStr} &nbsp;·&nbsp; Fin: ${endStr}
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">Cláusula 3ª — Período de Permanencia</div>
      <div class="clause-body">
        El Cliente se compromete a mantener activos los servicios contratados durante un período
        mínimo de permanencia de <strong>${permanenciaMeses} meses</strong> desde la fecha de inicio del contrato.
        La baja anticipada durante dicho período implicará la facturación de las mensualidades restantes.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">Cláusula 4ª — Precio y Forma de Pago</div>
      <div class="clause-body">
        El precio de los servicios contratados es el detallado en la Cláusula 1ª.
        La forma de pago acordada es <strong>${esc(formaPago)}</strong>.<br/>
        Los pagos se realizarán al número de cuenta:
        <strong>IBAN: ES69 1583 0001 1993 4722 6761</strong> (Platomico, S.L.),
        en los plazos indicados en cada factura.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">Cláusula 5ª — Facturación</div>
      <div class="clause-body">
        Platomico emitirá factura mensualmente a mes vencido. El plazo de pago será de
        30 días desde la fecha de emisión de la factura. El impago de cualquier factura
        devengará intereses de demora conforme a la legislación vigente.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">Cláusula 6ª — Soporte Técnico</div>
      <div class="clause-body">
        El soporte técnico se prestará durante el horario indicado en el plan contratado.
        Las incidencias podrán reportarse a través de los canales habilitados por Platomico.
        Platomico se compromete a atender las incidencias críticas en un plazo máximo de 4 horas hábiles.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">Cláusula 7ª — Protección de Datos</div>
      <div class="clause-body">
        El tratamiento de datos de carácter personal se realizará conforme al Reglamento (UE) 2016/679
        (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD). Platomico actuará como Encargado del Tratamiento
        respecto de los datos del Cliente y suscribirá el correspondiente Acuerdo de Tratamiento de Datos.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">Cláusula 8ª — Ley Aplicable y Jurisdicción</div>
      <div class="clause-body">
        El presente contrato se regirá e interpretará de acuerdo con la legislación española.
        Para la resolución de cualquier controversia derivada de este contrato, ambas partes se
        someten a los Juzgados y Tribunales de <strong>Madrid</strong>, con renuncia a cualquier otro fuero.
      </div>
    </div>

    ${notas ? `
    <div class="clause">
      <div class="clause-num">Notas adicionales</div>
      <div class="clause-body">${esc(notas)}</div>
    </div>` : ''}

  </div>
</div>


<!-- ══════════════════════════════════════════════════════════════════════
     PÁGINA 4 — FIRMAS
══════════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}
  <div class="ct">

    <div class="pg-header">
      ${logoHtml}
      <span class="pg-header-label">Contrato de Prestación de Servicios · Firmas</span>
    </div>

    <div class="sig-intro">
      Y en prueba de conformidad con todo lo expuesto, las partes firman el presente
      contrato en Madrid, a ${today}.
    </div>

    <div class="sig-cols">

      <!-- Platomico — ya firmado -->
      <div class="sig-col">
        <div class="sig-col-title">Por Platomico, S.L.</div>
        <div class="sig-name">César Augusto Castro Sáder</div>
        <div class="sig-role">Administrador Único</div>
        <div class="sig-nif">NIF: B22741094</div>
        <div class="sig-presigned">✓ Firmado</div>
      </div>

      <!-- Cliente — datos prefijados, pendiente de firma -->
      <div class="sig-col">
        <div class="sig-col-title">Por ${esc(presupuesto.clientName)}</div>
        <!-- Pre-filled company data -->
        <div class="sig-name">${esc(presupuesto.clientName)}</div>
        ${presupuesto.clientCif     ? `<div class="sig-role">NIF/CIF: ${esc(presupuesto.clientCif)}</div>` : ''}
        ${presupuesto.clientAddress ? `<div class="sig-nif">${esc(presupuesto.clientAddress)}</div>`      : ''}
        <!-- Blank fields for handwritten completion -->
        <div style="margin-top: 18px;">
          <div class="sig-line-label">Firma</div>
          <div class="sig-line">&nbsp;</div>
          <div class="sig-line-label">Nombre del representante</div>
          <div class="sig-line">&nbsp;</div>
          <div class="sig-line-label">Cargo</div>
          <div class="sig-line">&nbsp;</div>
          <div class="sig-line-label">Fecha</div>
          <div class="sig-line">&nbsp;</div>
        </div>
      </div>

    </div>

  </div>
</div>

</body>
</html>`

  return renderHtmlToPdf(html)
}
