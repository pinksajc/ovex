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

  /* ── Watermark — fixed so it renders above all content on every page ── */
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

  /* ── Content layer ── */
  .ct { position: relative; }

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
      <div class="clause-num">1. Objeto</div>
      <div class="clause-body">
        Platomico presta al Cliente los servicios de su plataforma tecnológica para hostelería y, en su caso, suministra el hardware asociado. El Cliente contrata únicamente los servicios y módulos que seleccione. La contratación de módulos adicionales, o la baja de los existentes, se formaliza por escrito sin necesidad de firmar un nuevo contrato, rigiéndose siempre por estas mismas condiciones.
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
     PÁGINAS 3+ — CONDICIONES GENERALES (flujo automático)
══════════════════════════════════════════════════════════════════════ -->
<div class="pg" style="break-after:auto;page-break-after:auto;">
  ${WM}
  <div class="ct">

    <div class="pg-header">
      ${logoHtml}
      <span class="pg-header-label">Contrato de Prestación de Servicios · Condiciones generales</span>
    </div>

    <div class="clause">
      <div class="clause-num">2. Duración y renovación</div>
      <div class="clause-body">
        El contrato entra en vigor el <strong>${startStr}</strong> y tiene una duración de <strong>${duracionMeses} meses</strong>, con vencimiento el <strong>${endStr}</strong>. Se prorroga automáticamente por períodos iguales al inicial, salvo que cualquiera de las partes comunique su voluntad de no renovar con al menos 30 días naturales de antelación al vencimiento.
      </div>
      <div class="highlight-box">Inicio: ${startStr} &nbsp;·&nbsp; Vencimiento: ${endStr} &nbsp;·&nbsp; Duración: ${duracionMeses} meses</div>
    </div>

    <div class="clause">
      <div class="clause-num">3. Precio y pago</div>
      <div class="clause-body">
        Las cuotas se facturan por mensualidades, en euros y sin incluir IVA ni otros impuestos aplicables. El pago vence a fin de mes y se realiza mediante <strong>${esc(formaPago)}</strong>
        ${formaPago.toLowerCase().includes('transferencia') ? ` al IBAN <strong>ES69 1583 0001 1993 4722 6761</strong> (Platomico, S.L.)` : ''}.
        El impago a vencimiento devenga automáticamente el interés de demora previsto en la Ley 3/2004 de lucha contra la morosidad, sin necesidad de requerimiento previo. Un retraso superior a 30 días faculta a Platomico para suspender el servicio, previa comunicación, sin que ello exima al Cliente de pagar lo devengado. Platomico puede revisar los precios en cada renovación avisando con 30 días de antelación; si el Cliente no acepta la revisión, puede resolver el contrato antes del nuevo período sin penalización, salvo permanencia vigente.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">4. Obligaciones de Platomico</div>
      <div class="clause-body">
        Platomico prestará los servicios con diligencia y conforme a los estándares del sector: pondrá los módulos contratados en funcionamiento, dará soporte según la cláusula 5, aplicará las actualizaciones y mejoras, adoptará medidas de seguridad razonables y tratará los datos conforme a la cláusula 7. El servicio se presta como software como servicio (SaaS); las interrupciones imputables a terceros (conectividad, pasarelas de pago, plataformas integradas) no serán responsabilidad de Platomico si actuó con la diligencia debida.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">5. Soporte y niveles de servicio (SLA)</div>
      <div class="clause-body">
        Platomico presta soporte técnico por los canales y en el horario pactados, priorizando la franja de servicio de hostelería. Las incidencias críticas —las que impiden cobrar, facturar o registrar ventas— se atienden con carácter preferente; las no críticas, dentro del siguiente día hábil. El incumplimiento grave y reiterado del SLA faculta al Cliente para resolver el contrato conforme a la cláusula 11, sin compensación por baja anticipada.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">6. Obligaciones del Cliente</div>
      <div class="clause-body">
        El Cliente se compromete a pagar puntualmente, usar el servicio conforme a la ley y al contrato, disponer de la conectividad y los equipos mínimos necesarios, custodiar sus credenciales de acceso y ser responsable de su uso, no ceder ni revender el servicio a terceros no autorizados, y facilitar información veraz y actualizada.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">7. Protección de datos</div>
      <div class="clause-body">
        El tratamiento de datos se rige por el RGPD y la LOPDGDD. Cuando, para prestar el servicio, Platomico trate datos personales de los que el Cliente sea responsable (clientes finales, empleados, pedidos), actuará como encargado del tratamiento conforme al art. 28 del RGPD: tratará los datos solo según las instrucciones documentadas del Cliente, mantendrá la confidencialidad, aplicará medidas de seguridad apropiadas, asistirá al Cliente en la atención de los derechos de los interesados, y devolverá o suprimirá los datos al terminar. La subcontratación a subencargados (alojamiento, infraestructura) queda sujeta a las mismas obligaciones, informándose al Cliente y permitiéndole oponerse por motivos justificados.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">8. Propiedad intelectual</div>
      <div class="clause-body">
        El software, la plataforma, los módulos y las marcas son titularidad exclusiva de Platomico o de sus licenciantes. El contrato no cede esos derechos, sino que concede al Cliente una licencia de uso no exclusiva, intransferible y limitada a la vigencia del contrato. El Cliente no podrá copiar, descompilar ni hacer ingeniería inversa del software. Los datos de negocio que el Cliente introduzca o genere son de su titularidad, sin perjuicio de la licencia que otorga a Platomico para tratarlos en lo necesario para prestar el servicio y, de forma agregada y anonimizada, para mejorar la plataforma. El uso de la marca de la otra parte con fines promocionales requiere autorización previa por escrito.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">9. Permanencia</div>
      <div class="clause-body">
        ${permanenciaMeses > 0
          ? `Las partes han acordado un período de permanencia de <strong>${permanenciaMeses} meses</strong> desde la fecha de inicio, vinculado al importe subvencionado o con descuento que queda cuantificado en la oferta asociada. La compensación por baja anticipada es decreciente y proporcional al tiempo ya cumplido, reduciéndose mes a mes, y nunca supera el importe subvencionado pendiente de amortizar. No se aplica si la baja se debe a un incumplimiento de Platomico.`
          : `Por defecto, el contrato no impone permanencia. Solo cuando Platomico suministre hardware o instalación de forma subvencionada o con descuento podrá pactarse un compromiso de permanencia, sujeto a estas reglas: se vincula exclusivamente al importe subvencionado, que quedará cuantificado; la compensación por baja anticipada es decreciente y proporcional al tiempo ya cumplido, reduciéndose mes a mes; y nunca supera el importe subvencionado pendiente de amortizar. No se aplica si la baja se debe a un incumplimiento de Platomico.`
        }
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">10. Confidencialidad</div>
      <div class="clause-body">
        Ambas partes mantendrán la confidencialidad de la información a la que accedan por el contrato (condiciones económicas, información técnica, comercial o de negocio), durante su vigencia y los 3 años siguientes. No se considera confidencial la información que sea o pase a ser pública sin incumplimiento, la que ya obrara legítimamente en poder de la parte receptora, o aquella cuya divulgación imponga la ley o una autoridad competente.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">11. Resolución</div>
      <div class="clause-body">
        El contrato puede resolverse por mutuo acuerdo, por fin de vigencia sin renovación, por incumplimiento grave no subsanado en 15 días desde el requerimiento escrito, o por las causas legales. Platomico podrá resolver, en particular, por impago reiterado o uso ilícito del servicio; el Cliente, por incumplimiento grave y no subsanado de Platomico, incluido el del SLA. A la terminación, Platomico pondrá a disposición del Cliente sus datos de negocio en un formato de uso común que permita su portabilidad.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">12. Responsabilidad</div>
      <div class="clause-body">
        Platomico responde de los daños directos y probados causados por incumplimiento doloso o gravemente negligente. Salvo en los casos en que la ley no lo permita (dolo, daños a las personas), su responsabilidad total acumulada se limita al importe de las cuotas pagadas por el Cliente en los 12 meses anteriores al hecho que la origine. No responde del lucro cesante, la pérdida de negocio, los daños indirectos, ni de las interrupciones imputables a terceros, a la conectividad del Cliente o a fuerza mayor.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">13. Fuerza mayor</div>
      <div class="clause-body">
        Ninguna parte responde por el incumplimiento de sus obligaciones —salvo las de pago ya devengadas— cuando se deba a causas de fuerza mayor o caso fortuito, es decir, hechos imprevisibles o inevitables ajenos a su control. La parte afectada lo comunicará cuanto antes y ambas colaborarán para minimizar los efectos.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">14. Cesión y subcontratación</div>
      <div class="clause-body">
        El Cliente no podrá ceder su posición en el contrato sin el consentimiento previo y por escrito de Platomico. Platomico podrá subcontratar total o parcialmente la prestación del servicio, respondiendo en todo caso frente al Cliente de su correcta ejecución y sujetándose, en materia de datos, a la cláusula 7.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">15. Notificaciones</div>
      <div class="clause-body">
        Las comunicaciones entre las partes se harán por escrito a las direcciones postales o electrónicas designadas, siendo válidas las remitidas por correo electrónico con confirmación de recepción. Todo cambio de datos de contacto deberá notificarse a la otra parte.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">16. Nulidad e integridad</div>
      <div class="clause-body">
        La nulidad de una cláusula no afecta a la validez del resto del contrato, que seguirá vigente, sustituyéndose la cláusula nula por otra válida de finalidad equivalente. El contrato y sus anexos constituyen el acuerdo íntegro entre las partes y sustituyen cualquier acuerdo anterior sobre la misma materia.
      </div>
    </div>

    <div class="clause">
      <div class="clause-num">17. Ley y jurisdicción</div>
      <div class="clause-body">
        El contrato se rige por la legislación española. Para cualquier controversia, las partes se someten a los Juzgados y Tribunales del domicilio de Platomico, salvo que una norma imperativa imponga otro fuero, en particular si el Cliente tuviera la condición legal de consumidor.
      </div>
    </div>

    ${notas ? `
    <div class="clause">
      <div class="clause-num">Condiciones especiales / Notas</div>
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
