// =========================================
// CONTRACT PDF GENERATOR — Condiciones Generales del Servicio
// server-only
//
// Estructura:
//  Pág. 1  — Encabezado, Partes e Identificación del Contrato
//  Pág. 2  — Exponen + Servicios contratados
//  Págs. 3+ — Cláusulas 1ª–20ª (flujo automático)
//  Pág. (N) — Firmas
//  Pág. (N+1) — Anexo I (SLA)
//  Pág. (N+2) — Anexo II (Encargado del Tratamiento)
//  Pág. (N+3) — Anexo III (Inventario de Equipos)
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
  return d.toISOString().split('T')[0]
}

// ── Services table rows ───────────────────────────────────────────────────────

function renderServiceRows(items: InvoiceLineItem[]): string {
  if (!items || items.length === 0) return ''
  return items
    .filter((i) => i.type === 'line')
    .map((item) => `
      <tr>
        <td>${esc(item.description || '—')}${item.period ? `<div class="item-period">${esc(item.period)}</div>` : ''}</td>
        <td class="right mono">${fmt(item.quantity)}</td>
        <td class="right mono">${fmt(item.unitPrice)} €</td>
        <td class="right mono fw6">${fmt(item.amount)} €</td>
      </tr>`)
    .join('')
}

// ── Watermark helper ──────────────────────────────────────────────────────────

const WM = `<div class="watermark">CONFIDENCIAL</div>`

// ── Page header helper ────────────────────────────────────────────────────────

function pgHeader(logoHtml: string, label: string): string {
  return `
    <div class="pg-header">
      ${logoHtml}
      <span class="pg-header-label">${label}</span>
    </div>`
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateContractPdf(
  presupuesto: Presupuesto,
  params: ContractParams,
): Promise<Buffer> {
  const logo = readLogoDataUri()
  const { duracionMeses, permanenciaMeses, formaPago, fechaInicio, notas } = params

  const fechaFin  = addMonths(fechaInicio, duracionMeses)
  const today     = fmtDate(fechaInicio)
  const startStr  = fmtDate(fechaInicio)
  const endStr    = fmtDate(fechaFin)

  const items     = presupuesto.lineItems ?? []
  const vatAmount = presupuesto.amountNet * (presupuesto.vatRate / 100)
  const hasItems  = items.filter((i) => i.type === 'line').length > 0

  const logoHtml = logo
    ? `<img class="logo" src="${logo}" alt="Platomico"/>`
    : `<span style="font-size:14px;font-weight:700;color:#1e3a5f;">Platomico</span>`

  const lbl = (t: string) => pgHeader(logoHtml, `Condiciones Generales del Servicio · ${t}`)

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 9.5px;
    color: #1e293b;
    background: #fff;
    line-height: 1.6;
  }

  /* ── Page containers ── */
  .pg {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 20mm 16mm;
    position: relative;
    break-after: page;
    page-break-after: always;
  }
  .pg:last-child {
    break-after: avoid;
    page-break-after: avoid;
  }
  .pg-flow {
    width: 210mm;
    padding: 20mm 20mm 16mm;
    position: relative;
    break-after: auto;
    page-break-after: auto;
  }

  /* ── Watermark ── */
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 65px;
    font-weight: 900;
    color: rgba(0,0,0,0.04);
    letter-spacing: 18px;
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    z-index: 9999;
  }

  /* ── Logo header ── */
  .logo { height: 20px; object-fit: contain; }
  .pg-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 2px solid #1e3a5f;
    margin-bottom: 18px;
  }
  .pg-header-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #94a3b8;
  }

  /* ── Title ── */
  .contract-title {
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: #1e3a5f;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin: 20px 0 4px;
  }
  .contract-subtitle {
    text-align: center;
    font-size: 9px;
    color: #64748b;
    margin-bottom: 22px;
  }

  /* ── Section label ── */
  .section-label {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #94a3b8;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #f1f5f9;
  }

  /* ── Party blocks ── */
  .party-block {
    background: #f8fafc;
    border-left: 3px solid #1e3a5f;
    border-radius: 0 6px 6px 0;
    padding: 11px 14px;
    margin-bottom: 12px;
  }
  .party-role {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
    margin-bottom: 4px;
  }
  .party-name { font-size: 11px; font-weight: 700; color: #1e3a5f; margin-bottom: 3px; }
  .party-detail { font-size: 9px; color: #475569; line-height: 1.7; }

  /* ── Exponen ── */
  .exponen-block {
    background: #f0f4f8;
    border-radius: 6px;
    padding: 12px 14px;
    font-size: 9px;
    color: #334155;
    line-height: 1.7;
    margin-top: 14px;
  }
  .exponen-block p { margin-bottom: 6px; }
  .exponen-block p:last-child { margin-bottom: 0; }
  .exponen-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #1e3a5f;
    margin-bottom: 10px;
  }
  .acuerdan {
    margin-top: 12px;
    font-size: 10px;
    font-weight: 700;
    color: #1e3a5f;
    text-align: center;
    letter-spacing: 0.5px;
  }

  /* ── Services table ── */
  table.svc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 14px;
    font-size: 9.5px;
  }
  table.svc-table thead tr { background: #1e3a5f; color: #fff; }
  table.svc-table thead th {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    padding: 7px 9px;
    text-align: left;
  }
  table.svc-table thead th.right { text-align: right; }
  table.svc-table tbody tr { border-bottom: 1px solid #f1f5f9; }
  table.svc-table tbody td { padding: 7px 9px; color: #334155; }
  table.svc-table tbody td.right { text-align: right; }
  .item-period { font-size: 8px; color: #94a3b8; margin-top: 2px; }
  .mono { font-family: 'Courier New', monospace; }
  .right { text-align: right; }
  .fw6 { font-weight: 600; }

  /* ── Totals ── */
  .totals-box {
    margin-left: auto;
    width: 260px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    font-size: 9.5px;
    border-bottom: 1px solid #f1f5f9;
  }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.grand {
    background: #1e3a5f;
    color: #fff;
    font-weight: 700;
    padding: 10px 12px;
  }
  .totals-row .lbl { color: #64748b; }
  .totals-row.grand .lbl { color: #cbd5e1; font-size: 8.5px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.6px; }
  .totals-row .amt { font-family: 'Courier New', monospace; font-weight: 600; }
  .totals-row.grand .amt { font-size: 12px; }

  /* ── Clauses ── */
  .clause {
    margin-bottom: 14px;
    break-inside: avoid;
  }
  .clause-num {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #1e3a5f;
    margin-bottom: 4px;
  }
  .clause-body {
    font-size: 9.5px;
    color: #334155;
    line-height: 1.7;
  }
  .clause-body p { margin-bottom: 6px; }
  .clause-body p:last-child { margin-bottom: 0; }
  .sub-clause {
    margin-top: 6px;
    padding-left: 14px;
    border-left: 2px solid #e2e8f0;
  }
  .sub-clause-title { font-weight: 700; color: #1e3a5f; margin-bottom: 2px; }
  .highlight-box {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 5px 10px;
    margin: 6px 0 4px;
    font-size: 9px;
    font-weight: 700;
    color: #1e3a5f;
  }
  .notas-box {
    background: #fefce8;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 10px;
    font-size: 9.5px;
    color: #78350f;
    line-height: 1.7;
  }
  .notas-title { font-weight: 700; margin-bottom: 4px; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.8px; }

  /* ── Annex tables ── */
  table.anx-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    margin: 10px 0;
  }
  table.anx-table th {
    background: #1e3a5f;
    color: #fff;
    padding: 6px 8px;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    text-align: left;
  }
  table.anx-table td {
    padding: 6px 8px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }
  table.anx-table tr:last-child td { border-bottom: none; }
  .anx-title {
    font-size: 12px;
    font-weight: 700;
    color: #1e3a5f;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .anx-subtitle { font-size: 9px; color: #64748b; margin-bottom: 14px; }
  .cell-placeholder { color: #94a3b8; font-style: italic; }

  /* ── Signatures ── */
  .sig-intro {
    font-size: 9.5px;
    color: #475569;
    line-height: 1.8;
    text-align: center;
    margin: 20px 0 28px;
  }
  .sig-cols { display: flex; gap: 28px; margin-top: 12px; }
  .sig-col {
    flex: 1;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 18px;
  }
  .sig-col-title {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
    margin-bottom: 12px;
    padding-bottom: 7px;
    border-bottom: 1px solid #f1f5f9;
  }
  .sig-name { font-size: 10px; font-weight: 700; color: #1e3a5f; margin-bottom: 3px; }
  .sig-role { font-size: 9px; color: #64748b; margin-bottom: 2px; }
  .sig-nif  { font-size: 9px; color: #94a3b8; margin-bottom: 10px; }
  .sig-presigned {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 9px;
    font-weight: 700;
    color: #059669;
  }
  .sig-line {
    font-size: 9px;
    color: #475569;
    margin-bottom: 20px;
    padding-bottom: 4px;
    border-bottom: 1px solid #cbd5e1;
  }
  .sig-line-label {
    font-size: 8px;
    color: #94a3b8;
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
</style>
</head>
<body>

<!-- ══════════════════════════════════════════════════════════════════
     PÁGINA 1 — ENCABEZADO Y PARTES
══════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}

  ${lbl('Encabezado y Partes')}

  <div class="contract-title">Condiciones Generales del Servicio</div>
  <div class="contract-subtitle">En Madrid, a ${today}</div>

  <div class="section-label">Reunidos</div>

  <div class="party-block">
    <div class="party-role">De una parte — Proveedor</div>
    <div class="party-name">Platomico, S.L.</div>
    <div class="party-detail">
      NIF: B22741094 &nbsp;·&nbsp; Inscrita en el Registro Mercantil de Madrid<br/>
      C/ Antonio Machado 9, Rozas de Puerto Real, Madrid 28649<br/>
      Representada por <strong>César Augusto Castro Sáder</strong>, Administrador Único
      <br/>(en adelante, el «PROVEEDOR» o «Platomico»)
    </div>
  </div>

  <div class="party-block">
    <div class="party-role">De otra parte — Cliente</div>
    <div class="party-name">${esc(presupuesto.clientName)}</div>
    <div class="party-detail">
      ${presupuesto.clientCif ? `NIF/CIF: ${esc(presupuesto.clientCif)}<br/>` : ''}
      ${presupuesto.clientAddress ? `${esc(presupuesto.clientAddress)}<br/>` : ''}
      Representada en este acto por D./D.ª <strong>[NOMBRE DEL REPRESENTANTE]</strong>
      en calidad de <strong>[CARGO]</strong>
      <br/>(en adelante, el «CLIENTE»)
    </div>
  </div>

  <p style="font-size:9.5px;color:#475569;line-height:1.7;margin-top:10px;">
    Ambas partes se reconocen mutuamente capacidad legal suficiente para obligarse mediante el
    presente Contrato y, al efecto, <strong>EXPONEN</strong> lo siguiente, pasando a continuación a
    <strong>ACUERDAN</strong> las cláusulas que se desarrollan en las páginas siguientes.
  </p>

</div>


<!-- ══════════════════════════════════════════════════════════════════
     PÁGINA 2 — EXPONEN + SERVICIOS CONTRATADOS
══════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}

  ${lbl('Exponen y Servicios Contratados')}

  <div class="exponen-block">
    <div class="exponen-title">Exponen</div>
    <p>1.º Que Platomico, S.L. es una empresa especializada en el desarrollo y gestión de soluciones tecnológicas y software para el sector de la restauración.</p>
    <p>2.º Que el CLIENTE es una sociedad mercantil dedicada a la actividad de restauración y que desea contratar los servicios objeto de las presentes Condiciones Generales para la gestión operativa de dicho establecimiento.</p>
    <p>3.º Que las partes han mantenido conversaciones comerciales previas, en cuyo marco Platomico presentó al CLIENTE la oferta comercial nº <strong>${esc(presupuesto.id)}</strong>, relativa a la implantación del sistema ROS y del hardware asociado (la «Oferta»), oferta que ha sido aceptada por el CLIENTE y cuyo contenido económico se rige por lo dispuesto en la Cláusula 4ª.</p>
    <p>4.º Que, con carácter previo a la firma del presente documento, Platomico ha informado al CLIENTE de las funcionalidades y limitaciones del Servicio, del precio indicado en la Oferta, del período de permanencia mínima establecido en la Cláusula 6ª y de las condiciones de baja anticipada.</p>
    <p>5.º Que Platomico es titular de todos los derechos de propiedad intelectual e industrial sobre el software ROS y demás elementos tecnológicos objeto de las presentes Condiciones Generales, encontrándose facultada para conceder al CLIENTE la licencia de uso regulada en la Cláusula 12ª.</p>
    <p>6.º Que el sistema ROS cumple, o se encuentra en proceso de adaptación para cumplir, con los requisitos del Reglamento de Sistemas Informáticos de Facturación (Real Decreto 1007/2023), incluyendo, en su caso, la modalidad VERI*FACTU.</p>
  </div>

  <div class="acuerdan" style="margin-bottom:14px;">— ACUERDAN —</div>

  <!-- Servicios contratados -->
  <div class="section-label">Servicios contratados (Oferta ${esc(presupuesto.id)})</div>

  <table class="svc-table">
    <thead>
      <tr>
        <th>Descripción del servicio</th>
        <th class="right" style="width:55px;">Cantidad</th>
        <th class="right" style="width:90px;">Precio unit.</th>
        <th class="right" style="width:90px;">Importe</th>
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
      <span class="lbl">Total mensual</span>
      <span class="amt">${fmt(presupuesto.amountTotal)} €</span>
    </div>
  </div>

</div>


<!-- ══════════════════════════════════════════════════════════════════
     PÁGINAS 3+ — CLÁUSULAS (flujo automático)
══════════════════════════════════════════════════════════════════ -->
<div class="pg-flow">
  ${WM}

  ${lbl('Cláusulas 1ª–4ª')}

  <div class="clause">
    <div class="clause-num">Cláusula 1ª — Objeto y Ámbito de Aplicación</div>
    <div class="clause-body">
      <p>Con la firma del presente documento, el PROVEEDOR pone a disposición del CLIENTE el acceso a los servicios de los que es propietario bajo la marca comercial «PLATOMICO» (en adelante, los «Servicios»), contratados por el CLIENTE de conformidad con la Oferta comercial aceptada por éste (la «Oferta»).</p>
      <p>Las presentes Condiciones Generales regulan con carácter estable la relación entre el PROVEEDOR y el CLIENTE, y resultarán de aplicación a la Oferta identificada en el Expositivo y a cualquier otra Oferta, ampliación o renovación que el CLIENTE acepte durante la vigencia de la relación contractual, salvo que la Oferta correspondiente disponga expresamente otra cosa para algún extremo concreto.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 2ª — Forma de Prestación del Servicio</div>
    <div class="clause-body">
      <p><strong>2.1.</strong> El PROVEEDOR pondrá a disposición del CLIENTE el software ROS, en la versión del plan contratado, junto con el hardware acordado en la Oferta.</p>
      <p><strong>2.2.</strong> El CLIENTE podrá utilizar el software durante toda la vigencia del Contrato y conforme a los términos de la licencia de uso regulada en la Cláusula 12ª, para las necesidades ordinarias de su actividad de restauración.</p>
      <p><strong>2.3.</strong> El PROVEEDOR realizará una sesión de onboarding en la que instalará y configurará el software adaptándolo al negocio del CLIENTE, incluyendo la carga del menú, precios, imágenes, categorías y demás elementos necesarios, de modo que el CLIENTE quede en condiciones de operar por sí mismo tanto el software de punto de venta como el resto de terminales que, en su caso, hubiera contratado.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 3ª — Equipos: Titularidad, Origen y Devolución</div>
    <div class="clause-body">
      <p>A los efectos del presente documento, se entiende por «Equipos», «Terminales» o «Dispositivos» aquellos terminales físicos necesarios para el uso del Servicio, a título enunciativo y no limitativo: el Counter Stand, Bouncepad y los dispositivos tipo tablet (Android o iOS) en los que se ejecute el software ROS, ya sea en modalidad de punto de venta (POS), de kiosco de autoservicio o de pantalla de cocina (KDS), según el paquete contratado por el CLIENTE.</p>
      <div class="sub-clause">
        <p><span class="sub-clause-title">a) Identificación individualizada.</span> Cada tablet entregada al CLIENTE quedará identificada de forma individual en el Anexo III (Inventario de Equipos), que indicará, como mínimo, su tipología, marca y modelo, color, número de serie o identificador único, y la función asignada (POS, Kiosko o KDS). Cualquier sustitución se documentará mediante la actualización de dicho Anexo, sin que ello requiera la modificación formal del presente documento conforme a la Cláusula 16ª.</p>
        <p><span class="sub-clause-title">b) Origen de los Equipos.</span> Los Equipos podrán ser (i) aportados por el CLIENTE, quien los habrá adquirido por su cuenta y quedarán excluidos de las condiciones de la Oferta; o (ii) aportados por el PROVEEDOR, en cuyo caso se regirán por lo dispuesto en el apartado c). El origen de cada Equipo se hará constar en el Anexo III.</p>
        <p><span class="sub-clause-title">c) Equipos aportados por el PROVEEDOR — cesión de uso.</span> Los Equipos aportados por el PROVEEDOR se ceden en uso al CLIENTE (comodato) vinculado a la vigencia del presente documento. Por cada tablet aportada por el PROVEEDOR, el CLIENTE abonará una cuota mensual conforme a lo indicado en la Oferta (IVA no incluido), adicional a la cuota del Servicio, en concepto de mantenimiento, actualizaciones y sustitución del dispositivo en caso de avería no imputable al CLIENTE.</p>
        <p><span class="sub-clause-title">d) Equipos aportados por el CLIENTE.</span> El PROVEEDOR prestará únicamente soporte sobre el software instalado, sin asumir responsabilidad sobre el hardware, su mantenimiento o sustitución. El PROVEEDOR podrá condicionar la instalación del software al cumplimiento de unos requisitos técnicos mínimos.</p>
        <p><span class="sub-clause-title">e) Devolución.</span> El CLIENTE deberá devolver al PROVEEDOR los Equipos aportados por este último en el plazo de 10 días naturales desde la finalización o resolución del presente documento por cualquier causa, en condiciones normales de uso conforme al desgaste propio de su utilización ordinaria. El CLIENTE responderá del valor de reposición de cada Equipo en caso de pérdida, sustracción o deterioro que exceda del desgaste ordinario.</p>
      </div>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 4ª — Precio, Facturación y Forma de Pago</div>
    <div class="clause-body">
      <p><strong>4.1. Precio.</strong> El precio de los Servicios y, en su caso, de los Equipos es el que se determina en la Oferta aceptada por el CLIENTE, que queda incorporada al presente documento como parte integrante del mismo. La Oferta detallará los conceptos contratados, las cantidades, el precio unitario y total de cada uno, el IVA aplicable y la periodicidad de facturación correspondiente (única o recurrente).</p>
      <p><strong>4.2. Forma de pago.</strong> La forma de pago será <strong>${esc(formaPago)}</strong>${formaPago.toLowerCase().includes('domiciliación') || formaPago.toLowerCase().includes('transferencia') ? `, al IBAN <strong>ES69 1583 0001 1993 4722 6761</strong> (Platomico, S.L.)` : ''}. En caso de domiciliación bancaria, el CLIENTE suscribirá el correspondiente mandato SEPA. La devolución de un recibo o el rechazo de un cargo por causa imputable al CLIENTE conllevará la repercusión de los gastos bancarios ocasionados y facultará al PROVEEDOR, previo requerimiento no atendido en el plazo de 5 días, a suspender la prestación del Servicio hasta la regularización del pago.</p>
      <p><strong>4.3. Cuotas de pago único.</strong> Cuando la Oferta incluya servicios de alta, formación, onboarding u otros conceptos análogos de puesta en marcha del Servicio —con exclusión de los Desarrollos a Medida—, dichos Servicios se facturarán conforme a lo establecido en la sección «Set-up fee» de la Oferta y, en ausencia de determinación expresa en ésta, se facturarán en su totalidad de forma anticipada a la firma del presente documento.</p>
      <p><strong>4.4. Desarrollos a Medida.</strong> Cuando el CLIENTE solicite un desarrollo, integración o personalización específica no incluida en el plan estándar («Desarrollo a Medida»), el PROVEEDOR remitirá una Oferta de Desarrollo a Medida con el alcance, el plazo y el coste total, que deberá ser aceptada expresamente por el CLIENTE antes del inicio de los trabajos. El coste se abona en dos plazos: 50% por adelantado y 50% a la finalización y puesta en marcha. El CLIENTE dispondrá de 10 días naturales para comunicar disconformidades; transcurrido dicho plazo, el Desarrollo se entenderá aceptado. La propiedad intelectual del Desarrollo corresponderá al PROVEEDOR salvo pacto expreso en contrario.</p>
      <p><strong>4.5. Actualización del precio.</strong> El precio de las cuotas recurrentes podrá actualizarse en cada renovación anual aplicando la variación interanual del IPC publicado por el INE, o el porcentaje acordado expresamente con 30 días de antelación. En ausencia de acuerdo, el precio vigente se mantiene sin modificación hasta la siguiente renovación.</p>
      <p><strong>4.6. Facturación y morosidad.</strong> El PROVEEDOR emitirá factura mensualmente a mes vencido. El plazo de pago será de 30 días desde la fecha de emisión. El impago devengará automáticamente el interés de demora previsto en el art. 7 de la Ley 3/2004, de 29 de diciembre, así como la indemnización por costes de cobro prevista en su art. 8.</p>
      <p><strong>4.7. Prevalencia.</strong> En caso de contradicción entre la Oferta y el presente documento respecto del precio, la forma de pago o las condiciones de facturación, prevalecerá lo establecido en la Oferta.</p>
    </div>
  </div>

</div>

<div class="pg-flow">
  ${WM}

  ${lbl('Cláusulas 5ª–9ª')}

  <div class="clause">
    <div class="clause-num">Cláusula 5ª — Duración y Vigencia</div>
    <div class="clause-body">
      <p>El presente documento tendrá una duración de <strong>${duracionMeses} meses</strong>, con fecha de inicio el <strong>${startStr}</strong> y fecha de vencimiento el <strong>${endStr}</strong>. Transcurrido dicho período, se renovará automáticamente por períodos anuales sucesivos, salvo que cualquiera de las partes lo notifique a la otra de forma fehaciente (burofax, conducto notarial o correo electrónico con acuse de recibo) con una antelación mínima de 30 días naturales a la fecha de vencimiento en curso.</p>
      <div class="highlight-box">Inicio: ${startStr} &nbsp;·&nbsp; Vencimiento: ${endStr} &nbsp;·&nbsp; Duración: ${duracionMeses} meses</div>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 6ª — Período de Permanencia</div>
    <div class="clause-body">
      ${permanenciaMeses > 0
        ? `<p>El CLIENTE se compromete a mantener activos los Servicios contratados durante un período mínimo de permanencia de <strong>${permanenciaMeses} meses</strong> desde la fecha de inicio. La baja anticipada durante dicho período implicará la facturación de las mensualidades restantes hasta completar dicho período mínimo, en concepto de cláusula penal conforme al artículo 1152 del Código Civil.</p>`
        : `<p>Las partes no han pactado período mínimo de permanencia. Solo cuando Platomico suministre hardware o instalación de forma subvencionada o con descuento podrá pactarse un compromiso de permanencia, que quedará cuantificado en la Oferta correspondiente.</p>`
      }
      <p>Lo anterior no será de aplicación cuando la resolución anticipada traiga causa de un incumplimiento grave de las obligaciones del PROVEEDOR —incluido el incumplimiento reiterado de los niveles de servicio del Anexo I— no subsanado en el plazo de 15 días desde su requerimiento fehaciente, conforme al artículo 1124 del Código Civil; en tal caso el CLIENTE podrá resolver el Contrato sin penalización.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 7ª — Obligaciones del Proveedor</div>
    <div class="clause-body">
      <p>Sin perjuicio de las demás obligaciones asumidas en el presente documento, el PROVEEDOR se obliga a:</p>
      <p>(a) Prestar el Servicio con la diligencia profesional exigible a un ordenado empresario del sector tecnológico (art. 1104 CC), poniendo a disposición del CLIENTE el software ROS y, en su caso, los Equipos acordados en la Oferta, en los términos, plazos y condiciones pactados.</p>
      <p>(b) Realizar la sesión de onboarding, instalando y configurando el software conforme a las necesidades del negocio del CLIENTE.</p>
      <p>(c) Prestar el soporte técnico y cumplir los tiempos de respuesta y resolución establecidos en el Anexo I (SLA), así como mantener operativos los canales de reporte de incidencias.</p>
      <p>(d) Mantener el software actualizado, corrigiendo los errores de funcionamiento que le sean notificados y aplicando las actualizaciones de seguridad razonablemente necesarias.</p>
      <p>(e) Cumplir con la normativa aplicable a los sistemas informáticos de facturación (Ley 11/2021 y Real Decreto 1007/2023, incluida la modalidad VERI*FACTU), manteniendo dicho cumplimiento durante toda la vigencia del Contrato.</p>
      <p>(f) Actuar como Encargado del Tratamiento de los datos personales del CLIENTE conforme al RGPD y la LOPDGDD, en los términos del Anexo II.</p>
      <p>(g) Guardar la confidencialidad prevista en la Cláusula 11ª respecto de la información del CLIENTE a la que tenga acceso con ocasión de la prestación del Servicio.</p>
      <p>(h) Emitir puntualmente las facturas correspondientes conforme a lo pactado en la Cláusula 4ª.</p>
      <p>(i) Informar al CLIENTE de cualquier incidencia relevante que afecte de forma significativa a la disponibilidad o seguridad del Servicio.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 8ª — Obligaciones del Cliente</div>
    <div class="clause-body">
      <p>Sin perjuicio de las demás obligaciones asumidas en el presente documento, el CLIENTE se obliga a:</p>
      <p>(a) Abonar puntualmente el precio del Servicio en los términos, plazos y forma de pago pactados en la Cláusula 4ª.</p>
      <p>(b) Facilitar al PROVEEDOR, de forma veraz y en tiempo razonable, la información y colaboración necesarias para la correcta prestación del Servicio.</p>
      <p>(c) Destinar el software y los Equipos exclusivamente al desarrollo de su propia actividad empresarial y a los fines previstos en el presente documento, absteniéndose de cederlos o sublicenciarlos.</p>
      <p>(d) Abstenerse de realizar labores de ingeniería inversa, descompilación, copia o modificación no autorizada del software.</p>
      <p>(e) Custodiar adecuadamente los Equipos entregados y responder de su pérdida, sustracción o deterioro no atribuible al desgaste ordinario, en los términos de la Cláusula 3ª.</p>
      <p>(f) Designar una persona de contacto operativo para la coordinación del onboarding, la gestión de incidencias y las comunicaciones ordinarias con el PROVEEDOR.</p>
      <p>(g) Ser responsable frente a terceros y frente a la Administración del contenido que introduzca en el sistema (precios, productos, datos fiscales), así como del cumplimiento de la normativa aplicable a su propia actividad.</p>
      <p>(h) Notificar sin demora injustificada al PROVEEDOR cualquier incidencia de seguridad, uso indebido o acceso no autorizado del que tenga conocimiento.</p>
      <p>(i) Mantener actualizados sus datos de contacto, facturación y pago, comunicando cualquier variación conforme a la Cláusula 18ª.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 9ª — Soporte Técnico y Nivel de Servicio</div>
    <div class="clause-body">
      <p>El soporte técnico y el nivel de servicio aplicables al CLIENTE serán los correspondientes al plan contratado (Starter, Growth o Pro), según se identifique en la Oferta, y se prestarán conforme a las condiciones descritas en el Anexo I (Acuerdo de Nivel de Servicio).</p>
      <p>El PROVEEDOR podrá actualizar la denominación, contenido o alcance de los planes ofrecidos con carácter general a sus clientes, sin que ello suponga una reducción de las condiciones ya contratadas por el CLIENTE.</p>
      <p>En los planes Starter y Growth los tiempos de respuesta tienen carácter orientativo y de mejor esfuerzo («best effort»). En el plan Pro, dichos tiempos constituyen un Acuerdo de Nivel de Servicio garantizado, cuyo incumplimiento reiterado dará lugar a las consecuencias previstas en la Cláusula 6ª.</p>
      <p>El CLIENTE podrá solicitar el cambio de plan mediante la aceptación de una nueva Oferta, que sustituirá a la anterior a efectos de nivel de servicio desde la fecha en ella indicada.</p>
    </div>
  </div>

</div>

<div class="pg-flow">
  ${WM}

  ${lbl('Cláusulas 10ª–16ª')}

  <div class="clause">
    <div class="clause-num">Cláusula 10ª — Protección de Datos</div>
    <div class="clause-body">
      <p><strong>10.1.</strong> En cumplimiento del RGPD y de la LOPDGDD, las partes se informan mutuamente de que los datos personales de sus firmantes, así como de las personas que trabajen para cada una de ellas, serán tratados con la única finalidad de gestionar y ejecutar la relación contractual. Los datos no serán cedidos a terceros, salvo a aquellos que resulten imprescindibles para la propia ejecución del Contrato o para el cumplimiento de obligaciones legales.</p>
      <p><strong>10.2.</strong> En la medida en que la prestación del Servicio suponga el acceso del PROVEEDOR a datos de carácter personal responsabilidad del CLIENTE, el PROVEEDOR tendrá la consideración de Encargado del Tratamiento conforme al artículo 28 RGPD, suscribiéndose a tal efecto el Acuerdo de Encargado del Tratamiento que se adjunta como Anexo II.</p>
      <p><strong>10.3.</strong> El CLIENTE es responsable de la veracidad y exactitud de los datos que introduzca en el sistema, sin que el PROVEEDOR asuma responsabilidad alguna por los errores u omisiones en que aquel pudiera incurrir.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 11ª — Confidencialidad</div>
    <div class="clause-body">
      <p>Cada parte se obliga a mantener la más estricta confidencialidad respecto de la información técnica, comercial o de cualquier otra naturaleza a la que tenga acceso con ocasión del presente documento, y a no revelarla a terceros ni utilizarla para fines distintos de los aquí previstos, tanto durante su vigencia como durante los 2 años siguientes a su finalización, salvo obligación legal o requerimiento de autoridad competente.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 12ª — Propiedad Intelectual y Licencia de Software</div>
    <div class="clause-body">
      <p>El software ROS y demás desarrollos tecnológicos empleados en la prestación del Servicio son titularidad exclusiva de Platomico o de sus licenciantes. El presente documento no transmite al CLIENTE derecho de propiedad intelectual o industrial alguno, sino una licencia de uso no exclusiva, intransferible y limitada a la duración del Contrato y al número de terminales contratados.</p>
      <p>Finalizado el Contrato por cualquier causa, el CLIENTE cesará de inmediato en el uso del software, sin perjuicio de su derecho a solicitar la exportación de sus datos conforme a la Cláusula 10ª.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 13ª — Limitación de Responsabilidad</div>
    <div class="clause-body">
      <p>La responsabilidad total del PROVEEDOR frente al CLIENTE por cualquier daño derivado del presente documento quedará limitada, salvo dolo o negligencia grave conforme al artículo 1102 del Código Civil, al importe efectivamente satisfecho por el CLIENTE durante los 12 meses anteriores al hecho causante. En ningún caso el PROVEEDOR responderá de daños indirectos, lucro cesante o pérdida de datos u oportunidades de negocio.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 14ª — Fuerza Mayor</div>
    <div class="clause-body">
      <p>Ninguna de las partes será responsable del incumplimiento de sus obligaciones cuando este derive de un supuesto de fuerza mayor o caso fortuito conforme al artículo 1105 del Código Civil, incluyendo, entre otros, fallos de terceros proveedores de infraestructura, cortes de suministro eléctrico o de telecomunicaciones, catástrofes naturales o decisiones de autoridades públicas ajenas a la voluntad de las partes.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 15ª — Cesión y Subcontratación</div>
    <div class="clause-body">
      <p>Ninguna de las partes podrá ceder el presente documento ni los derechos y obligaciones derivados del mismo sin el consentimiento previo y por escrito de la otra, salvo en caso de fusión, escisión o transmisión global de su negocio, supuesto en el que bastará notificación previa fehaciente.</p>
      <p>El PROVEEDOR podrá subcontratar la prestación de servicios auxiliares (alojamiento, soporte de primer nivel, etc.), permaneciendo en todo caso responsable frente al CLIENTE del cumplimiento del Contrato.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 16ª — Modificación del Contrato</div>
    <div class="clause-body">
      <p>Cualquier modificación del presente documento deberá constar por escrito y ser firmada por los representantes debidamente apoderados de ambas partes, sin que las comunicaciones por correo electrónico ordinario o la mera tolerancia de una de las partes puedan entenderse como modificación tácita de lo pactado, conforme al principio de forma del artículo 1258 del Código Civil. Lo anterior se entiende sin perjuicio de la actualización del Anexo III conforme a la Cláusula 3ª.a) y de la suscripción de nuevas Ofertas conforme a la Cláusula 1ª.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 17ª — Nulidad Parcial</div>
    <div class="clause-body">
      <p>Si cualquiera de las cláusulas del presente documento fuera declarada nula, anulable o ineficaz, dicha nulidad no afectará a la validez del resto del Contrato, que continuará vigente e interpretándose en el sentido más próximo a la voluntad original de las partes.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 18ª — Notificaciones</div>
    <div class="clause-body">
      <p>Cualquier comunicación relativa al presente documento se dirigirá a las siguientes direcciones:</p>
      <p><strong>PROVEEDOR:</strong> hola@platomico.com / C/ Antonio Machado 9, Rozas de Puerto Real, Madrid 28649.</p>
      <p><strong>CLIENTE:</strong> [DIRECCIÓN DE CORREO ELECTRÓNICO DE CONTACTO] / [DOMICILIO A EFECTOS DE NOTIFICACIONES].</p>
      <p>Cualquier cambio de estos datos deberá comunicarse a la otra parte con una antelación mínima de 15 días.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 19ª — Cesión de Imagen</div>
    <div class="clause-body">
      <p>El CLIENTE autoriza al PROVEEDOR a dar publicidad a la relación de CLIENTE y PROVEEDOR formalizada en el presente documento en los medios y canales utilizados por el PROVEEDOR; en especial, el CLIENTE autoriza expresamente al PROVEEDOR al uso de su marca, logo, nombre comercial e imagen corporativa para tal fin publicitario en sus presentaciones y ofertas comerciales y en su página web.</p>
    </div>
  </div>

  <div class="clause">
    <div class="clause-num">Cláusula 20ª — Resolución Amistosa, Ley Aplicable y Jurisdicción</div>
    <div class="clause-body">
      <p>Con carácter previo al ejercicio de acciones judiciales, las partes procurarán resolver de buena fe cualquier controversia derivada del presente documento mediante negociación directa entre sus representantes, durante un plazo de 15 días desde su notificación fehaciente.</p>
      <p>El presente documento se regirá e interpretará de acuerdo con la legislación española. Para la resolución de cualquier controversia que no se resuelva conforme al párrafo anterior, ambas partes se someten expresamente a los Juzgados y Tribunales de Madrid, con renuncia a cualquier otro fuero que pudiera corresponderles.</p>
    </div>
  </div>

  ${notas ? `
  <div class="notas-box">
    <div class="notas-title">Condiciones especiales / Notas</div>
    ${esc(notas)}
  </div>` : ''}

</div>


<!-- ══════════════════════════════════════════════════════════════════
     FIRMAS
══════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}

  ${lbl('Firmas')}

  <div class="sig-intro">
    Y en prueba de conformidad con todo lo expuesto, las partes firman el presente documento
    en Madrid, a ${today}.
  </div>

  <div class="sig-cols">

    <div class="sig-col">
      <div class="sig-col-title">Por Platomico, S.L.</div>
      <div class="sig-name">César Augusto Castro Sáder</div>
      <div class="sig-role">Administrador Único</div>
      <div class="sig-nif">NIF sociedad: B22741094</div>
      <div class="sig-presigned">✓ Firmado</div>
    </div>

    <div class="sig-col">
      <div class="sig-col-title">Por ${esc(presupuesto.clientName)}</div>
      <div class="sig-name">${esc(presupuesto.clientName)}</div>
      ${presupuesto.clientCif     ? `<div class="sig-role">NIF/CIF: ${esc(presupuesto.clientCif)}</div>` : ''}
      ${presupuesto.clientAddress ? `<div class="sig-nif">${esc(presupuesto.clientAddress)}</div>`      : ''}
      <div style="margin-top:16px;">
        <div class="sig-line-label">Firma</div>
        <div class="sig-line">&nbsp;</div>
        <div class="sig-line-label">Nombre del representante</div>
        <div class="sig-line">&nbsp;</div>
        <div class="sig-line-label">Cargo</div>
        <div class="sig-line">&nbsp;</div>
        <div class="sig-line-label">DNI del firmante</div>
        <div class="sig-line">&nbsp;</div>
        <div class="sig-line-label">Fecha</div>
        <div class="sig-line">&nbsp;</div>
      </div>
    </div>

  </div>

</div>


<!-- ══════════════════════════════════════════════════════════════════
     ANEXO I — SLA
══════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}

  ${lbl('Anexo I — Acuerdo de Nivel de Servicio (SLA)')}

  <div class="anx-title">Anexo I</div>
  <div class="anx-subtitle">Acuerdo de Nivel de Servicio (SLA) — Contrato ${esc(presupuesto.id)}</div>

  <p style="font-size:9.5px;color:#334155;line-height:1.7;margin-bottom:12px;">
    El presente Anexo desarrolla el nivel de servicio aplicable en función del plan contratado por el CLIENTE, identificado en la Oferta.
  </p>

  <table class="anx-table" style="margin-bottom:16px;">
    <thead>
      <tr>
        <th>Plan</th>
        <th>Hardware con soporte incluido</th>
        <th>Canales de soporte</th>
        <th>Horario («horas hábiles»)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Starter</strong></td>
        <td>Register (POS)</td>
        <td>Centro de ayuda + correo electrónico</td>
        <td>L–V, 9:00–18:00</td>
      </tr>
      <tr>
        <td><strong>Growth</strong></td>
        <td>Register (POS) o Kiosk (a elección del CLIENTE)</td>
        <td>Centro de ayuda + correo electrónico</td>
        <td>L–V, 9:00–23:00</td>
      </tr>
      <tr>
        <td><strong>Pro</strong></td>
        <td>Register (POS) o Kiosk (a elección del CLIENTE)</td>
        <td>Teléfono + WhatsApp, con Customer Success Manager dedicado</td>
        <td>24 horas, todos los días</td>
      </tr>
    </tbody>
  </table>

  <p style="font-size:9px;color:#64748b;margin-bottom:10px;">En los planes Starter y Growth las «horas hábiles» se computan conforme al horario de la tabla anterior. En el plan Pro, al disponer de cobertura continua, los tiempos se computan en horas naturales.</p>

  <table class="anx-table">
    <thead>
      <tr>
        <th>Severidad</th>
        <th>Descripción</th>
        <th>Tiempo de respuesta</th>
        <th>Tiempo de resolución objetivo</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Crítica</strong></td>
        <td>Servicio caído o funcionalidad esencial no disponible</td>
        <td>4 horas hábiles</td>
        <td>8 horas hábiles</td>
      </tr>
      <tr>
        <td><strong>Alta</strong></td>
        <td>Funcionalidad relevante degradada, con impacto operativo significativo</td>
        <td>8 horas hábiles</td>
        <td>24 horas hábiles</td>
      </tr>
      <tr>
        <td><strong>Media</strong></td>
        <td>Incidencia con solución alternativa (workaround) disponible</td>
        <td>24 horas hábiles</td>
        <td>72 horas hábiles</td>
      </tr>
      <tr>
        <td><strong>Baja</strong></td>
        <td>Consultas, dudas de uso o solicitudes de mejora</td>
        <td>48 horas hábiles</td>
        <td>A planificar de mutuo acuerdo</td>
      </tr>
    </tbody>
  </table>

  <p style="font-size:9px;color:#64748b;margin-top:10px;">
    En los planes Starter y Growth, los tiempos anteriores son orientativos («best effort»); en el plan Pro constituyen un compromiso garantizado conforme a la Cláusula 9ª.
  </p>

</div>


<!-- ══════════════════════════════════════════════════════════════════
     ANEXO II — ENCARGADO DEL TRATAMIENTO (ART. 28 RGPD)
══════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}

  ${lbl('Anexo II — Acuerdo de Encargado del Tratamiento')}

  <div class="anx-title">Anexo II</div>
  <div class="anx-subtitle">Acuerdo de Encargado del Tratamiento (art. 28 RGPD) — Contrato ${esc(presupuesto.id)}</div>

  <table class="anx-table" style="margin-bottom:14px;">
    <tbody>
      <tr><td style="width:160px;font-weight:700;color:#1e3a5f;">Objeto</td><td>Prestación del Servicio ROS y gestión de los Equipos asociados descritos en el presente documento.</td></tr>
      <tr><td style="font-weight:700;color:#1e3a5f;">Duración</td><td>Coincidente con la duración del Contrato principal y sus renovaciones.</td></tr>
      <tr><td style="font-weight:700;color:#1e3a5f;">Naturaleza y finalidad</td><td>Gestión de pedidos y operaciones del establecimiento del CLIENTE a través del Servicio contratado.</td></tr>
      <tr><td style="font-weight:700;color:#1e3a5f;">Tipo de datos</td><td>Datos identificativos y de contacto de clientes finales; datos de transacciones y pedidos.</td></tr>
      <tr><td style="font-weight:700;color:#1e3a5f;">Categorías de interesados</td><td>Clientes finales del establecimiento del CLIENTE; personal del CLIENTE.</td></tr>
    </tbody>
  </table>

  <p style="font-size:9px;font-weight:700;color:#1e3a5f;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px;">Obligaciones del Proveedor como Encargado del Tratamiento:</p>

  <div style="font-size:9.5px;color:#334155;line-height:1.7;">
    <p style="margin-bottom:5px;">(a) Tratar los datos personales únicamente conforme a las instrucciones documentadas del CLIENTE, sin aplicarlos ni utilizarlos para fines distintos del objeto del Contrato, ni comunicarlos a terceros, salvo autorización expresa del CLIENTE.</p>
    <p style="margin-bottom:5px;">(b) Garantizar que las personas autorizadas para tratar los datos se comprometan a respetar la confidencialidad.</p>
    <p style="margin-bottom:5px;">(c) Adoptar las medidas técnicas y organizativas necesarias para garantizar la seguridad de los datos, atendiendo al estado de la tecnología, la naturaleza de los datos tratados y los riesgos a los que están expuestos, conforme al artículo 32 RGPD.</p>
    <p style="margin-bottom:5px;">(d) No subcontratar a otro encargado del tratamiento sin la autorización previa, específica o general, por escrito, del CLIENTE, en los términos de la Cláusula 15ª. <em>Subencargados actualmente autorizados: proveedores de infraestructura cloud (alojamiento y almacenamiento).</em></p>
    <p style="margin-bottom:5px;">(e) Asistir al CLIENTE, mediante las medidas técnicas y organizativas apropiadas y en la medida de lo posible, en la atención de solicitudes de ejercicio de derechos de los interesados y en el cumplimiento de sus obligaciones conforme a los artículos 32 a 36 RGPD.</p>
    <p style="margin-bottom:5px;">(f) A elección del CLIENTE, suprimir o devolver todos los datos personales una vez finalizada la prestación del Servicio, y suprimir las copias existentes, en el plazo de 30 días, salvo que resulte necesaria su conservación en virtud del Derecho de la Unión o de un Estado miembro.</p>
    <p style="margin-bottom:0;">(g) Poner a disposición del CLIENTE la información necesaria para demostrar el cumplimiento de estas obligaciones y permitir auditorías realizadas por el CLIENTE o un auditor autorizado.</p>
  </div>

</div>


<!-- ══════════════════════════════════════════════════════════════════
     ANEXO III — INVENTARIO DE EQUIPOS
══════════════════════════════════════════════════════════════════ -->
<div class="pg">
  ${WM}

  ${lbl('Anexo III — Inventario de Equipos')}

  <div class="anx-title">Anexo III</div>
  <div class="anx-subtitle">Inventario de Equipos — Contrato ${esc(presupuesto.id)} · ${esc(presupuesto.clientName)}</div>

  <p style="font-size:9.5px;color:#334155;line-height:1.7;margin-bottom:12px;">
    El presente Anexo identifica de forma individualizada los Equipos entregados al CLIENTE conforme a la Cláusula 3ª. Se actualizará cada vez que se sustituya o incorpore un nuevo Equipo, sin que ello requiera modificar formalmente el presente documento.
  </p>

  <table class="anx-table" style="margin-bottom:20px;">
    <thead>
      <tr>
        <th style="width:28px;">Nº</th>
        <th>Tipo</th>
        <th>Marca / Modelo</th>
        <th>Color</th>
        <th>Nº Serie / ID</th>
        <th>Función (POS/Kiosko/KDS)</th>
        <th>Origen</th>
        <th>Cuota mensual</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Tablet</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[Platomico/Cliente]</td><td class="cell-placeholder">[__] €</td></tr>
      <tr><td>2</td><td>Tablet</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[Platomico/Cliente]</td><td class="cell-placeholder">[__] €</td></tr>
      <tr><td>3</td><td>Tablet</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[Platomico/Cliente]</td><td class="cell-placeholder">[__] €</td></tr>
      <tr><td>4</td><td>Counter Stand</td><td class="cell-placeholder">[__]</td><td>—</td><td class="cell-placeholder">[__]</td><td>—</td><td class="cell-placeholder">[Platomico/Cliente]</td><td>—</td></tr>
      <tr><td>5</td><td>Bouncepad Kiosk</td><td class="cell-placeholder">[__]</td><td>—</td><td class="cell-placeholder">[__]</td><td>—</td><td class="cell-placeholder">[Platomico/Cliente]</td><td>—</td></tr>
    </tbody>
  </table>

  <p style="font-size:9px;font-weight:700;color:#1e3a5f;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px;">Historial de modificaciones</p>

  <table class="anx-table">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Equipo afectado (Nº)</th>
        <th>Motivo (avería / sustitución / alta / baja)</th>
        <th>Observaciones</th>
      </tr>
    </thead>
    <tbody>
      <tr><td class="cell-placeholder">[__/__/____]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td></tr>
      <tr><td class="cell-placeholder">[__/__/____]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td><td class="cell-placeholder">[__]</td></tr>
    </tbody>
  </table>

  <p style="font-size:8.5px;color:#94a3b8;margin-top:12px;line-height:1.6;">
    Cada actualización de este Anexo deberá comunicarse a la otra parte por escrito (correo electrónico a las direcciones designadas en la Cláusula 18ª) y conservarse junto con el presente documento.
  </p>

</div>

</body>
</html>`

  return renderHtmlToPdf(html)
}
