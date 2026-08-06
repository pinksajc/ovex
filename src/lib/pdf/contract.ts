// =====================================================================
//  CONTRATO MACRO DE PRESTACIÓN DE SERVICIOS — Master Services Agreement
//  Documento consolidado y bilingüe (ES/EN) aprobado por Legal (v1.4).
//  Ref. PLT-SAAS-MACRO-001.
//
//  Estructura del PDF:
//   1. Portada · leyenda de servicios · partes (Reunidos)
//   2. Cuerpo común · cláusulas 1ª–23ª (bilingüe)
//   3. Cláusulas específicas por servicio (condicionales, según la Oferta)
//   4. Módulo REN · corresponsabilidad art. 26 (condicional)
//   5. Anexo I  · Oferta comercial (autorrellenada) + firmas
//   6. Anexo II · SLA
//   7. Anexo III· DPA (art. 28) + tratamiento por módulo + subencargados
//   8. Anexo IV · Inventario de equipos
//   9. Anexo V  · NDA + firmas
//
//  Del lado de Platomico las firmas aparecen como «✓ Firmado» (César Augusto
//  Castro Sáder, Administrador Único) — no requiere firma manuscrita.
//
//  Las cláusulas por servicio aparecen/desaparecen según los servicios
//  contratados, detectados desde las líneas de la Oferta y ajustables desde
//  el botón «Generar contrato».
// =====================================================================

import fs from 'fs'
import path from 'path'
import type { Presupuesto, InvoiceLineItem } from '@/types'
import { detectServices, type ServiceKey } from './contract-services'

export { detectServices }
export type { ServiceKey }

export interface ContractParams {
  duracionMeses: number
  permanenciaMeses: number
  formaPago: string
  fechaInicio: string  // YYYY-MM-DD
  notas?: string | null
  contactName?: string | null
  contactEmail?: string | null
  /** Explicit override of which service blocks to render. Omitted → auto-detect. */
  services?: Partial<Record<ServiceKey, boolean>>
  equipment?: Array<{
    n: number
    tipo: string
    marca: string
    color: string
    serie: string
    funcion: string
    origen: string
    cuotaMensual: string
    valorReposicion?: string
  }>
}

const SERVICE_COLOR: Record<ServiceKey, string> = {
  ros:       '#1e3a5f',
  posKiosk:  '#0891b2',
  whispr:    '#d97706',
  analitica: '#16a34a',
  equipos:   '#475569',
  ren:       '#7c3aed',
}

const SERVICE_LEGEND: Array<{ key: ServiceKey; label: string }> = [
  { key: 'ros',       label: 'ROS' },
  { key: 'posKiosk',  label: 'POS / Kiosk' },
  { key: 'ren',       label: 'REN (art. 26)' },
  { key: 'whispr',    label: 'Whispr' },
  { key: 'analitica', label: 'Analítica / IA' },
  { key: 'equipos',   label: 'Equipos' },
]

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

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n)
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Offer table rows (Anexo I) ───────────────────────────────────────────────

function isRecurring(unit: string | undefined): boolean {
  const u = (unit ?? '').toLowerCase()
  return u.includes('mes') || u.includes('pedido')
}

function renderOfferRows(items: InvoiceLineItem[]): string {
  const lines = items.filter((i) => i.type === 'line')
  if (lines.length === 0) {
    return `<tr><td colspan="5" style="text-align:center;color:#94a3b8;font-style:italic;padding:10px;">Sin conceptos — ver Oferta ${''}</td></tr>`
  }
  return lines.map((l) => {
    const period = isRecurring(l.unit) ? 'Mensual' : 'Único'
    return `<tr>
      <td>${esc(l.description)}</td>
      <td class="right mono">${fmtQty(l.quantity)}</td>
      <td class="right mono">${fmt(l.unitPrice)} €</td>
      <td class="right mono fw6">${fmt(l.amount)} €</td>
      <td>${period}</td>
    </tr>`
  }).join('')
}

// ── Bilingual clause data ────────────────────────────────────────────────────

interface Clause { n: string; tEs: string; tEn: string; bEs: string; bEn: string }

const COMMON_CLAUSES: Clause[] = [
  { n: '1ª', tEs: 'Objeto', tEn: 'Subject matter',
    bEs: 'El Proveedor pone a disposición del Cliente el acceso a los Servicios comercializados bajo la marca "Platomico", contratados conforme a la Oferta (Anexo I). Este contrato macro regula todos los Servicios; a cada Cliente se le aplican únicamente los módulos que haya contratado.',
    bEn: 'The Provider makes available to the Client access to the Services marketed under the "Platomico" brand, contracted under the Offer (Annex I). This master agreement governs all Services; each Client is bound only by the modules it has contracted.' },
  { n: '2ª', tEs: 'Forma de prestación y onboarding', tEn: 'Provision and onboarding',
    bEs: 'El Proveedor prestará los Servicios en la modalidad del plan contratado y realizará una sesión de onboarding que deje al Cliente en condiciones de operar.',
    bEn: 'The Provider shall deliver the Services under the contracted plan and carry out an onboarding session enabling the Client to operate.' },
  { n: '3ª', tEs: 'Condiciones económicas y Desarrollos a Medida', tEn: 'Commercial terms and Custom Developments',
    bEs: 'El precio es el fijado en la Oferta, que prevalece en materia económica. Los Desarrollos a Medida se cotizan aparte, con aceptación previa, pago 50%/50% y procedimiento de aceptación, subsanación y garantía de 30 días.',
    bEn: 'The price is set out in the Offer, which prevails on financial matters. Custom Developments are quoted separately, with prior acceptance, 50%/50% payment and an acceptance, remediation and 30-day warranty procedure.' },
  { n: '4ª', tEs: 'Precio y forma de pago', tEn: 'Price and payment',
    bEs: 'La forma de pago será la indicada en la Oferta. La devolución de un recibo por causa imputable al Cliente conllevará los gastos bancarios y, previo requerimiento no atendido en 5 días, facultará a suspender el acceso al Servicio hasta la regularización.',
    bEn: 'Payment shall be as stated in the Offer. A returned receipt attributable to the Client shall entail bank charges and, after a request not met within 5 days, shall entitle the Provider to suspend access until regularisation.' },
  { n: '5ª', tEs: 'Facturación e impago', tEn: 'Invoicing and non-payment',
    bEs: 'Platomico facturará mensualmente a mes vencido, con pago a 30 días; el impago devenga el interés de demora de la Ley 3/2004 y los costes de cobro. Además, faculta a Platomico, previo requerimiento no atendido en 5 días, a suspender el acceso del Cliente al Servicio hasta la regularización; los datos se conservan y la reactivación queda condicionada a estar al corriente de pago.',
    bEn: 'Platomico shall invoice monthly in arrears, payable within 30 days; late payment accrues default interest under Law 3/2004 and recovery costs. It also entitles Platomico, after a request not met within 5 days, to suspend the Client’s access until regularisation; data is retained and reactivation is conditional on being up to date with payment.' },
  { n: '6ª', tEs: 'Revisión de precios (IPC)', tEn: 'Price review (CPI)',
    bEs: 'Las cuotas recurrentes podrán actualizarse en cada renovación anual conforme al IPC del INE.',
    bEn: 'Recurring fees may be updated at each annual renewal in line with the INE CPI.' },
  { n: '7ª', tEs: 'Obligaciones del Proveedor', tEn: 'Provider obligations',
    bEs: 'Prestar el Servicio con diligencia profesional, dar soporte (Anexo II), mantener el software actualizado, cumplir su rol en protección de datos (Anexo III) y guardar confidencialidad.',
    bEn: 'To deliver the Service with professional diligence, provide support (Annex II), keep the software updated, comply with its data-protection role (Annex III) and maintain confidentiality.' },
  { n: '8ª', tEs: 'Obligaciones del Cliente', tEn: 'Client obligations',
    bEs: 'Abonar el precio, facilitar información veraz, usar el software conforme a la licencia, custodiar los equipos y colaborar en protección de datos, incluida la determinación de la base jurídica y la información a los interesados cuando el Cliente sea Responsable.',
    bEn: 'To pay the price, provide accurate information, use the software under the licence, safeguard the equipment and cooperate on data protection, including determining the legal basis and informing data subjects where the Client is the Controller.' },
  { n: '9ª', tEs: 'Soporte técnico', tEn: 'Technical support',
    bEs: 'El soporte y los niveles de servicio son los del plan contratado (Anexo II). Starter y Growth: best effort; Pro: garantizado.',
    bEn: 'Support and service levels are those of the contracted plan (Annex II). Starter and Growth: best-effort; Pro: guaranteed.' },
  { n: '10ª', tEs: 'Reversibilidad y portabilidad', tEn: 'Reversibility and portability',
    bEs: 'El Cliente podrá exportar su información en formato estándar durante la vigencia y hasta 30 días tras la finalización; la primera exportación es gratuita.',
    bEn: 'The Client may export its data in a standard format during the term and up to 30 days after termination; the first export is free.' },
  { n: '11ª', tEs: 'Protección de datos y DPO', tEn: 'Data protection and DPO',
    bEs: 'Según el módulo, Platomico actúa como Encargado (art. 28, Anexo III) o, en REN, como Corresponsable (art. 26). El contacto en materia de protección de datos es privacy@platomico.com. Platomico ha designado a D. Antonio Casanova como Delegado de Protección de Datos (DPD); su comunicación a la AEPD se encuentra en tramitación (documento PLT-DPO-002).',
    bEn: 'Depending on the module, Platomico acts as Processor (Art. 28, Annex III) or, in REN, as Joint Controller (Art. 26). The data-protection contact is privacy@platomico.com. Platomico has appointed Mr. Antonio Casanova as Data Protection Officer (DPO); its notification to the AEPD is in progress (document PLT-DPO-002).' },
  { n: '12ª', tEs: 'Confidencialidad', tEn: 'Confidentiality',
    bEs: 'Cada parte mantendrá la confidencialidad de la información de la otra a la que efectivamente acceda, durante la vigencia y los 2 años siguientes. El Cliente accede únicamente a los datos societarios y de contacto de Platomico y al propio Contrato; no accede al código fuente, algoritmos ni know-how, cuya protección se rige por la Cláusula 13ª. La información personal se rige por el Anexo III (DPA).',
    bEn: 'Each party shall keep confidential the other’s information it actually accesses, during the term and for 2 years thereafter. The Client only accesses Platomico’s corporate and contact data and the Agreement itself; it does not access the source code, algorithms or know-how, whose protection is governed by Clause 13. Personal information is governed by Annex III (DPA).' },
  { n: '13ª', tEs: 'Propiedad intelectual y licencia', tEn: 'IP and licence',
    bEs: 'El software es titularidad exclusiva de Platomico; licencia de uso no exclusiva, intransferible y limitada a la vigencia y a los terminales contratados.',
    bEn: 'The software is Platomico’s exclusive property; a non-exclusive, non-transferable licence limited to the term and contracted terminals.' },
  { n: '14ª', tEs: 'Uso de marca e imagen del Cliente', tEn: 'Use of Client brand and image',
    bEs: 'El Cliente autoriza, de forma no exclusiva y gratuita, el uso de su marca e imágenes de locales/equipos como referencia comercial; no ampara imágenes de personas identificables.',
    bEn: 'The Client authorises, non-exclusively and free of charge, use of its brand and images of premises/equipment as a commercial reference; it does not cover images of identifiable individuals.' },
  { n: '15ª', tEs: 'Limitación de responsabilidad', tEn: 'Limitation of liability',
    bEs: 'La responsabilidad del Proveedor se limita, salvo dolo o culpa grave, al importe satisfecho en los 12 meses anteriores; no responde de daños indirectos ni lucro cesante. La limitación opera entre las partes y no afecta a las responsabilidades frente a interesados o autoridades en materia de protección de datos.',
    bEn: 'The Provider’s liability is capped, save for wilful misconduct or gross negligence, at the amount paid in the preceding 12 months; no liability for indirect damages or loss of profit. The cap operates between the parties and does not affect liabilities towards data subjects or authorities under data-protection law.' },
  { n: '16ª', tEs: 'Fuerza mayor', tEn: 'Force majeure',
    bEs: 'Ninguna parte responde del incumplimiento por fuerza mayor (art. 1105 CC).',
    bEn: 'Neither party is liable for breach due to force majeure (Art. 1105 CC).' },
  { n: '17ª', tEs: 'Duración', tEn: 'Term',
    bEs: '__DURACION__ meses desde la firma, con renovación automática anual salvo preaviso fehaciente de 30 días.',
    bEn: '__DURACION__ months from signature, with automatic annual renewal unless 30 days’ reliable notice.' },
  { n: '18ª', tEs: 'Permanencia', tEn: 'Minimum term',
    bEs: 'Permanencia mínima de __PERMANENCIA__ meses. En baja anticipada el Cliente elige: (a) devolver los equipos de Platomico en 10 días; o (b) abonar las mensualidades restantes como cláusula penal (art. 1152 CC). A falta de elección, aplica (b). Sin penalización si hay incumplimiento grave del Proveedor no subsanado en 15 días (art. 1124 CC).',
    bEn: '__PERMANENCIA__-month minimum term. On early termination the Client chooses: (a) return Platomico’s equipment within 10 days; or (b) pay the remaining monthly fees as a penalty clause (Art. 1152 CC). Absent a choice, (b) applies. No penalty if the Provider materially breaches and fails to cure within 15 days (Art. 1124 CC).' },
  { n: '19ª', tEs: 'Cesión y subcontratación', tEn: 'Assignment and subcontracting',
    bEs: 'Ninguna parte cederá el contrato sin consentimiento previo por escrito, salvo operaciones societarias con notificación. El Proveedor podrá subcontratar servicios auxiliares, permaneciendo responsable.',
    bEn: 'Neither party shall assign the agreement without prior written consent, save for corporate transactions with notice. The Provider may subcontract ancillary services while remaining liable.' },
  { n: '20ª', tEs: 'Modificación y nulidad parcial', tEn: 'Amendment and severability',
    bEs: 'Toda modificación del presente Contrato deberá realizarse por escrito y ser firmada por los representantes debidamente apoderados de ambas partes; las comunicaciones por correo ordinario o la mera tolerancia no constituyen modificación tácita de lo pactado. La nulidad, anulabilidad o ineficacia de una cláusula no afectará a la validez del resto del Contrato, que continuará vigente e interpretándose conforme a la voluntad original de las partes.',
    bEn: 'Any amendment to this Agreement must be made in writing and signed by the duly authorised representatives of both parties; ordinary email or mere tolerance shall not constitute a tacit amendment. The nullity, voidability or ineffectiveness of a clause shall not affect the validity of the remainder of the Agreement, which shall remain in force and be construed in line with the parties’ original intent.' },
  { n: '21ª', tEs: 'Notificaciones', tEn: 'Notices',
    bEs: 'Proveedor: Platomico, S.L., C/ Antonio Machado 9, Rozas de Puerto Real, 28649 Madrid — contacto general admin@platomico.com; protección de datos privacy@platomico.com. Cliente: __CLIENTE__.',
    bEn: 'Provider: Platomico, S.L., C/ Antonio Machado 9, Rozas de Puerto Real, 28649 Madrid — general admin@platomico.com; data protection privacy@platomico.com. Client: __CLIENTE__.' },
  { n: '22ª', tEs: 'Idioma', tEn: 'Language',
    bEs: 'Versión bilingüe español/inglés; en caso de discrepancia prevalece la versión en inglés.',
    bEn: 'Bilingual Spanish/English version; in case of discrepancy the English version prevails.' },
  { n: '23ª', tEs: 'Ley aplicable y jurisdicción', tEn: 'Governing law and jurisdiction',
    bEs: 'Ley española; previa negociación amistosa de 15 días, las partes se someten a los Juzgados y Tribunales de Madrid.',
    bEn: 'Spanish law; after a 15-day good-faith negotiation, the parties submit to the Courts of Madrid.' },
]

const SERVICE_CLAUSES: Record<ServiceKey, Clause[]> = {
  ros: [
    { n: 'R1', tEs: 'Servicio ROS', tEn: 'ROS service',
      bEs: 'El módulo ROS comprende la gestión de pedidos y operaciones del establecimiento. El sistema de facturación cumple, dentro de los plazos legales, el RD 1007/2023 y, en su caso, la modalidad VERI*FACTU. Rol RGPD: Encargado (Anexo III).',
      bEn: 'The ROS module covers order and operations management. The invoicing system complies, within legal deadlines, with RD 1007/2023 and, where applicable, VERI*FACTU. GDPR role: Processor (Annex III).' },
  ],
  posKiosk: [
    { n: 'P1', tEs: 'POS / Kiosk', tEn: 'POS / Kiosk',
      bEs: 'Punto de venta y kiosco de autoservicio. Las pasarelas de pago (Stripe/Revolut) las contrata el Cliente y son responsables independientes: Platomico no trata datos de pago. Stripe opera en la UE. Si el establecimiento configura la captura de datos que puedan ser categoría especial (p. ej. alergias), el Cliente es responsable de la base del art. 9 y Platomico los trata con minimización. Rol RGPD: Encargado.',
      bEn: 'Point of sale and self-service kiosk. Payment gateways (Stripe/Revolut) are contracted by the Client and are independent controllers: Platomico processes no payment data. Stripe operates in the EU. If the establishment configures capture of data that may be special category (e.g. allergies), the Client is responsible for the Art. 9 basis and Platomico processes it under minimisation. GDPR role: Processor.' },
  ],
  whispr: [
    { n: 'W1', tEs: 'Servicio Whispr — Ley 2/2023', tEn: 'Whispr service — Law 2/2023',
      bEs: 'Whispr se presta "tal cual". Dado que el Cliente cumple plazos perentorios de la Ley 2/2023, Platomico se compromete a una disponibilidad mensual del 99,5% y a alertar de incidencias que los comprometan. Las categorías especiales que consten en una comunicación se suprimen de inmediato (art. 30.5 Ley 2/2023). Infraestructura en la UE (Supabase, Resend —EE.UU. (Plus Five Five, Inc.), con garantías del EU-US Data Privacy Framework y SCCs—, Railway). El canal está cifrado y garantiza el anonimato mediante un código de acceso, un identificador de caso y una clave de seguimiento; ni siquiera Platomico conoce la identidad del denunciante que reporta de forma anónima. Retención: 3 meses + 30 días. Brecha: 24h. Rol RGPD: Encargado.',
      bEn: 'Whispr is provided "as is". As the Client meets peremptory deadlines under Law 2/2023, Platomico commits to 99.5% monthly availability and alerts of incidents jeopardising them. Special categories appearing in a report are deleted immediately (Art. 30.5). EU infrastructure (Supabase, Resend —USA (Plus Five Five, Inc.), under the EU-US Data Privacy Framework and SCCs—, Railway). The channel is encrypted and guarantees anonymity via an access code, a case ID and a tracking key; not even Platomico knows the identity of a whistleblower reporting anonymously. Retention: 3 months + 30 days. Breach: 24h. GDPR role: Processor.' },
    { n: 'W2', tEs: 'Responsabilidad reforzada Whispr', tEn: 'Enhanced Whispr liability',
      bEs: 'La limitación general (Cl. 15ª) no se aplica al incumplimiento de las medidas de seguridad o confidencialidad de Whispr.',
      bEn: 'The general cap (Cl. 15) does not apply to breach of Whispr’s security or confidentiality measures.' },
  ],
  analitica: [
    { n: 'A1', tEs: 'Analítica de negocio / IA', tEn: 'Business analytics / AI',
      bEs: 'La Analítica almacena datos de negocio del Cliente y genera gráficos e índices con IA (Anthropic) para responder a sus consultas, previo filtrado de datos personales. Platomico no entrena modelos, no perfila ni toma decisiones automatizadas (art. 22) ni reutiliza los datos. Subencargados: Anthropic (EE.UU., SCCs) y OpenAI (sin PII). La transferencia a Anthropic se evalúa en la TIA (PLT-TIA-ANT-001). Rol RGPD: Encargado.',
      bEn: 'Analytics stores the Client’s business data and produces charts/indices with AI (Anthropic) to answer queries, after filtering personal data. Platomico does not train models, profile or take automated decisions (Art. 22), nor reuse the data. Sub-processors: Anthropic (US, SCCs) and OpenAI (no PII). GDPR role: Processor.' },
  ],
  equipos: [
    { n: 'E1', tEs: 'Equipos en comodato', tEn: 'Equipment on loan',
      bEs: 'Los equipos aportados por Platomico se ceden en uso (comodato, arts. 1740 y ss. CC) vinculado a la vigencia, con cuota de mantenimiento y devolución (Anexo IV).',
      bEn: 'Equipment provided by Platomico is loaned (commodatum, Arts. 1740 et seq. CC) tied to the term, with a maintenance fee and return (Annex IV).' },
  ],
  ren: [
    { n: 'N1', tEs: 'REN — plataforma de intermediación', tEn: 'REN — intermediation platform',
      bEs: 'Plataforma operativa de intermediación entre flotas de reparto (terceros) y restaurantes. Platomico trata datos de la flota/repartidores (identificativos, contacto, ubicación), del restaurante y sus consumidores (contacto, dirección de entrega) y del pedido (fechas, distancias, tiempos, comanda, foto de recogida/entrega, ID de Glovo/Uber/JustEat).',
      bEn: 'Live intermediation platform between delivery fleets (third parties) and restaurants. Platomico processes fleet/rider data (identification, contact, location), restaurant and end-customer data (contact, delivery address) and order data (dates, distances, times, order details, pickup/delivery photo, Glovo/Uber/JustEat ID).' },
    { n: 'N2', tEs: 'REN — corresponsabilidad (art. 26)', tEn: 'REN — joint controllership (Art. 26)',
      bEs: 'Platomico y el Cliente determinan conjuntamente las finalidades y medios esenciales del módulo REN y actúan como CORRESPONSABLES (art. 26 RGPD). Este bloque regula dicha corresponsabilidad y sustituye, para REN, al régimen de encargo del Anexo III.',
      bEn: 'Platomico and the Client jointly determine the purposes and essential means of the REN module and act as JOINT CONTROLLERS (Art. 26 GDPR). This block governs that joint controllership and replaces, for REN, the processor regime of Annex III.' },
    { n: 'N3', tEs: 'REN — reparto de responsabilidades', tEn: 'REN — allocation of responsibilities',
      bEs: 'Platomico gestiona la plataforma, la seguridad, la integración con Sinqro y las plataformas (Glovo/Uber/JustEat, responsables independientes) y la conservación técnica. El Cliente determina el uso operativo y la relación con sus consumidores. Cada parte garantiza una base jurídica válida.',
      bEn: 'Platomico manages the platform, security, integration with Sinqro and platforms (Glovo/Uber/JustEat, independent controllers) and technical retention. The Client determines operational use and the relationship with its customers. Each party ensures a valid legal basis.' },
    { n: 'N4', tEs: 'REN — punto de contacto y derechos', tEn: 'REN — contact point and rights',
      bEs: 'Platomico es el punto de contacto para los interesados (art. 26.1). Los interesados podrán ejercer sus derechos frente a cualquiera de las partes (art. 26.3); la parte que reciba una solicitud la atenderá y la trasladará a la otra en 5 días hábiles.',
      bEn: 'Platomico is the contact point for data subjects (Art. 26.1). Data subjects may exercise their rights against either party (Art. 26.3); the party receiving a request handles it and forwards it within 5 business days.' },
    { n: 'N5', tEs: 'REN — información y responsabilidad', tEn: 'REN — information and liability',
      bEs: 'Las partes pondrán a disposición de los interesados los aspectos esenciales del acuerdo (art. 26.2). Frente a los interesados, ambas responden solidariamente (art. 82 RGPD); en la relación interna, cada parte responde de su propio incumplimiento.',
      bEn: 'The parties make available to data subjects the essence of the arrangement (Art. 26.2). Towards data subjects, both are jointly and severally liable (Art. 82 GDPR); internally, each is liable for its own breach.' },
    { n: 'N6', tEs: 'REN — conservación y transferencias', tEn: 'REN — retention and transfers',
      bEs: 'Ubicación del rider: se trata únicamente mientras el pedido está en curso y solo si el rider ha dado su consentimiento y activado el GPS; no se conserva tras la entrega. Foto de recogida/entrega: 90 días. Datos del pedido con relevancia fiscal se conservan durante la relación contractual y 6 años bloqueados; las métricas de reparto (distancias, tiempos, identificadores) se conservan 2 años.',
      bEn: 'Rider location: processed only while the order is in progress and only if the rider has consented and activated GPS; not retained after delivery. Pickup/delivery photo: 90 days. Order data with tax relevance is retained during the contractual relationship and for 6 years (blocked); delivery metrics (distances, times, identifiers) are retained for 2 years.' },
    { n: 'N7', tEs: 'REN — evaluación de impacto (EIPD)', tEn: 'REN — impact assessment (DPIA)',
      bEs: 'Platomico ha realizado la evaluación de impacto relativa a la protección de datos de REN (art. 35 RGPD; documento PLT-EIPD-REN-001), dada la geolocalización de repartidores a gran escala. Sus medidas se aplican a este tratamiento y ambas partes colaborarán en su actualización antes de ampliaciones significativas del tratamiento.',
      bEn: 'Platomico has carried out the data protection impact assessment for REN (Art. 35 GDPR; document PLT-EIPD-REN-001), given the large-scale rider geolocation. Its measures apply to this processing and both parties shall cooperate in updating it before any significant expansion of the processing.' },
  ],
}

const DPA_CLAUSES: Clause[] = [
  { n: '1', tEs: 'Objeto y naturaleza', tEn: 'Subject and nature',
    bEs: 'El Encargado trata por cuenta del Responsable los datos necesarios para el Servicio, solo conforme a sus instrucciones documentadas. Se exceptúa REN (corresponsabilidad, art. 26; regulada en el cuerpo del Contrato).',
    bEn: 'The Processor processes on behalf of the Controller the data necessary for the Service, solely under documented instructions. REN is excluded (joint controllership, Art. 26; governed in the body of the Agreement).' },
  { n: '2', tEs: 'Duración', tEn: 'Duration',
    bEs: 'Vigente mientras dure el Contrato; subsisten supresión, devolución y confidencialidad.',
    bEn: 'In force for the term of the Agreement; deletion, return and confidentiality survive.' },
  { n: '3', tEs: 'Instrucciones documentadas', tEn: 'Documented instructions',
    bEs: 'Trata los datos solo según instrucciones del Responsable e informa si una instrucción infringe la normativa.',
    bEn: 'Processes only under the Controller’s instructions and informs if an instruction infringes the law.' },
  { n: '4', tEs: 'Confidencialidad del personal', tEn: 'Staff confidentiality',
    bEs: 'El personal autorizado está sujeto a deber de confidencialidad.',
    bEn: 'Authorised staff are bound by confidentiality.' },
  { n: '5', tEs: 'Seguridad (art. 32)', tEn: 'Security (Art. 32)',
    bEs: 'Cifrado en tránsito y reposo; control de accesos por roles; MFA/PKI; backups en la UE; alojamiento EEE; Whispr con AES-256-GCM y aislamiento por tenant.',
    bEn: 'Encryption in transit and at rest; role-based access; MFA/PKI; EU backups; EEA hosting; Whispr with AES-256-GCM and per-tenant isolation.' },
  { n: '6', tEs: 'Subencargados', tEn: 'Sub-processors',
    bEs: 'Autorización general (Anexo B); notificación de cambios con 15 días y derecho de oposición; mismas obligaciones al subencargado.',
    bEn: 'General authorisation (Annex B); 15-day change notice and right to object; same obligations imposed on sub-processors.' },
  { n: '7', tEs: 'Transferencias internacionales', tEn: 'International transfers',
    bEs: 'Fuera del EEE: decisión de adecuación, SCCs u otro instrumento del Cap. V; se acredita al Responsable.',
    bEn: 'Outside the EEA: adequacy decision, SCCs or another Chapter V instrument; evidenced to the Controller.' },
  { n: '8', tEs: 'Asistencia al Responsable', tEn: 'Assistance',
    bEs: 'Asiste en derechos de los interesados y en los arts. 32-36.',
    bEn: 'Assists with data-subject rights and Arts. 32-36.' },
  { n: '9', tEs: 'Notificación de brechas', tEn: 'Breach notification',
    bEs: 'Sin dilación indebida y máx. 48h (24h en Whispr) desde el conocimiento (art. 33).',
    bEn: 'Without undue delay and within 48h (24h for Whispr) of awareness (Art. 33).' },
  { n: '10', tEs: 'Supresión o devolución', tEn: 'Deletion or return',
    bEs: 'A elección del Responsable en 30 días; salvo conservación legalmente exigible (bloqueo).',
    bEn: 'At the Controller’s choice within 30 days; save legally required retention (blocking).' },
  { n: '11', tEs: 'Auditoría', tEn: 'Audit',
    bEs: 'Información para demostrar el cumplimiento y auditorías con antelación razonable.',
    bEn: 'Information to demonstrate compliance and audits with reasonable notice.' },
  { n: '12', tEs: 'Responsabilidad y ley aplicable', tEn: 'Liability and law',
    bEs: 'Art. 28 RGPD y LOPDGDD; la limitación de la Cl. 15ª opera solo entre partes, no frente a interesados ni autoridades.',
    bEn: 'Art. 28 GDPR and LOPDGDD; the Cl. 15 cap operates only between parties, not vis-à-vis data subjects or authorities.' },
]

const NDA_CLAUSES: Clause[] = [
  { n: '1ª', tEs: 'Objeto', tEn: 'Purpose',
    bEs: 'Regula, con carácter recíproco, la confidencialidad de la información intercambiada con motivo de la relación.',
    bEn: 'Governs, reciprocally, the confidentiality of information exchanged in connection with the relationship.' },
  { n: '2ª', tEs: 'Información confidencial', tEn: 'Confidential information',
    bEs: 'Toda información técnica, comercial, financiera, operativa o personal revelada por una parte a la otra, y la derivada de ella.',
    bEn: 'All technical, commercial, financial, operational or personal information disclosed by one party to the other, and derived information.' },
  { n: '3ª', tEs: 'Exclusiones', tEn: 'Exclusions',
    bEs: 'No es confidencial la información pública sin incumplimiento, ya conocida lícitamente, recibida de tercero sin deber de secreto, o de revelación legalmente obligada (con aviso).',
    bEn: 'Not confidential: public without breach, already lawfully known, received from a third party without duty of secrecy, or legally required to be disclosed (with notice).' },
  { n: '4ª', tEs: 'Obligaciones', tEn: 'Obligations',
    bEs: 'Uso exclusivo para la finalidad, protección diligente, acceso limitado a personas necesarias, sin comunicación a terceros sin autorización escrita.',
    bEn: 'Use solely for the purpose, diligent protection, access limited to necessary persons, no disclosure without written authorisation.' },
  { n: '5ª', tEs: 'Duración', tEn: 'Term',
    bEs: 'Subsiste durante la relación y los 2 años siguientes.',
    bEn: 'Survives during the relationship and for 2 years thereafter.' },
  { n: '6ª', tEs: 'Datos personales', tEn: 'Personal data',
    bEs: 'Si incluye datos personales, prevalece el Anexo III (DPA) y la normativa de protección de datos.',
    bEn: 'If it includes personal data, Annex III (DPA) and data-protection law prevail.' },
  { n: '7ª', tEs: 'Ley y jurisdicción', tEn: 'Law and jurisdiction',
    bEs: 'Ley española; Juzgados y Tribunales de Madrid; prevalece el inglés en discrepancia.',
    bEn: 'Spanish law; Courts of Madrid; English prevails in case of discrepancy.' },
]

// Per-module DPA processing table (Anexo A) — only contracted modules shown
const DPA_MODULE_ROWS: Array<{ key: ServiceKey; mod: string; es: string; en: string }> = [
  { key: 'ros', mod: 'ROS', es: 'Consumidores y personal del Cliente; identificativos, pedido/transacción, laborales básicos. Relación + 6 años; logs 2 años. Encargado.', en: 'End customers and Client staff; identification, order/transaction, basic employment. Relationship + 6 years; logs 2 years. Processor.' },
  { key: 'posKiosk', mod: 'POS / Kiosk', es: 'Consumidores; datos de transacción (no de pago). Pasarelas = responsables independientes. Encargado.', en: 'Customers; transaction data (not payment). Gateways = independent controllers. Processor.' },
  { key: 'whispr', mod: 'Whispr', es: 'Informantes y personas mencionadas; identificativos/profesionales; categorías especiales → supresión inmediata (art. 30.5 Ley 2/2023). 3 meses + 30 días. Brecha 24h. Encargado.', en: 'Whistleblowers and named persons; identification/professional; special categories → immediate deletion (Art. 30.5). 3 months + 30 days. Breach 24h. Processor.' },
  { key: 'analitica', mod: 'Analítica / IA', es: 'Datos de negocio; Anthropic (EE.UU., SCCs), OpenAI (sin PII); sin entrenamiento ni art. 22. Encargado.', en: 'Business data; Anthropic (US, SCCs), OpenAI (no PII); no training or Art. 22. Processor.' },
]

const SUBPROCESSORS: Array<[string, string, string, string]> = [
  ['AWS', 'Infraestructura', 'España/Irlanda', 'EEE'],
  ['MongoDB Atlas', 'Base de datos', 'Irlanda', 'EEE'],
  ['Vercel', 'Hosting', 'Irlanda', 'EEE'],
  ['Sinqro', 'Agregador delivery', 'España', 'EEE — solicitar DPA art. 28'],
  ['Supabase', 'Postgres Whispr', 'Irlanda', 'EEE — firmar DPA'],
  ['Resend', 'Email transaccional', 'EE.UU.', 'EE.UU. — EU-US DPF (Resend certificada) + SCCs'],
  ['Railway', 'Caché Whispr', 'UE', 'EEE — firmar DPA'],
  ['Anthropic', 'Analítica IA', 'EE.UU.', 'SCCs · TIA hecha (PLT-TIA-ANT-001)'],
  ['OpenAI', 'Embeddings', 'EE.UU.', 'SCCs · sin PII'],
  ['PostHog', 'Analítica web', 'Irlanda / UE', 'EEE — activar DPA en panel'],
  ['Expo', 'Notificaciones push (REN)', 'EE.UU.', 'SCCs — solicitar DPA Enterprise'],
  ['Haddock', 'Integración / agregador', 'UE', 'EEE — solicitar DPA art. 28'],
]

// ── Clause renderer ────────────────────────────────────────────────────────

function renderClause(c: Clause, color?: string): string {
  const border = color ? `border-left:3px solid ${color};padding-left:10px;` : ''
  return `
  <div class="clause" style="${border}">
    <div class="clause-num"${color ? ` style="color:${color}"` : ''}>${c.n}. ${esc(c.tEs)}</div>
    <div class="clause-body">
      <p>${esc(c.bEs)}</p>
      <p class="en">${esc(c.bEn)}</p>
    </div>
  </div>`
}

// ── Main generator ───────────────────────────────────────────────────────────

export async function generateContractPdf(
  presupuesto: Presupuesto,
  params: ContractParams,
): Promise<Buffer> {
  const logo = readLogoDataUri()
  const { duracionMeses, permanenciaMeses, formaPago, fechaInicio, notas, contactName, contactEmail, equipment } = params

  const today   = fmtDate(fechaInicio)
  const items   = presupuesto.lineItems ?? []
  const services = detectServices(items, params.services)

  const clienteLine = [
    esc(presupuesto.clientName),
    presupuesto.clientCif ? `NIF/CIF ${esc(presupuesto.clientCif)}` : '',
    presupuesto.clientAddress ? esc(presupuesto.clientAddress) : '',
    contactEmail ? esc(contactEmail) : '',
  ].filter(Boolean).join(' · ')

  // Substitute editable tokens into the common clauses
  const commonRendered = COMMON_CLAUSES.map((c) => ({
    ...c,
    bEs: c.bEs.replace(/__DURACION__/g, String(duracionMeses)).replace(/__PERMANENCIA__/g, String(permanenciaMeses)).replace(/__CLIENTE__/g, clienteLine),
    bEn: c.bEn.replace(/__DURACION__/g, String(duracionMeses)).replace(/__PERMANENCIA__/g, String(permanenciaMeses)).replace(/__CLIENTE__/g, clienteLine),
  }))

  const logoHtml = logo
    ? `<img class="logo" src="${logo}" alt="Platomico"/>`
    : `<span style="font-size:14px;font-weight:700;color:#1e3a5f;">Platomico</span>`

  const lbl = (t: string) => `
    <div class="pg-header">
      ${logoHtml}
      <span class="pg-header-label">Contrato Macro · ${esc(t)}</span>
    </div>`

  const PAGE = `width:210mm; padding:18mm 18mm 14mm; position:relative; font-family:Helvetica,Arial,sans-serif; font-size:9px; color:#1e293b; line-height:1.55;`

  // Active service clause blocks (in canonical order)
  const activeServiceOrder: ServiceKey[] = ['ros', 'posKiosk', 'whispr', 'analitica', 'equipos']
  const serviceBlocks = activeServiceOrder
    .filter((k) => services[k])
    .map((k) => SERVICE_CLAUSES[k].map((c) => renderClause(c, SERVICE_COLOR[k])).join(''))
    .join('')

  const renBlock = services.ren
    ? SERVICE_CLAUSES.ren.map((c) => renderClause(c, SERVICE_COLOR.ren)).join('')
    : ''

  const activeLegend = SERVICE_LEGEND.filter((l) => services[l.key])

  const equipmentRows = (equipment ?? []).length > 0
    ? (equipment ?? []).map((e) => `<tr>
        <td class="mono">${e.n}</td>
        <td>${esc(e.funcion || e.tipo)}</td>
        <td>${esc(e.marca) || '<span class="cell-placeholder">—</span>'}</td>
        <td>${esc(e.serie) || '<span class="cell-placeholder">—</span>'}</td>
        <td>${esc(e.origen)}</td>
        <td>${esc(e.cuotaMensual) || '<span class="cell-placeholder">—</span>'}</td>
        <td class="right mono">${esc(e.valorReposicion) || '<span class="cell-placeholder">—</span>'}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;font-style:italic;padding:8px;">Sin equipos registrados</td></tr>`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 9px; color: #1e293b; background:#fff; line-height:1.55; }
  .watermark { position: fixed; top:50%; left:50%; transform: translate(-50%,-50%) rotate(-45deg); font-size:64px; font-weight:900; color:rgba(0,0,0,0.035); letter-spacing:16px; text-transform:uppercase; pointer-events:none; user-select:none; white-space:nowrap; z-index:9999; }
  .logo { height:20px; object-fit:contain; }
  .pg-header { display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:2px solid #1e3a5f; margin-bottom:16px; }
  .pg-header-label { font-size:8px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#94a3b8; }
  .contract-title { text-align:center; font-size:15px; font-weight:700; color:#1e3a5f; letter-spacing:0.5px; text-transform:uppercase; margin:14px 0 3px; }
  .contract-subtitle { text-align:center; font-size:9px; color:#64748b; margin-bottom:4px; }
  .contract-en-sub { text-align:center; font-size:8.5px; color:#94a3b8; font-style:italic; margin-bottom:16px; }
  .section-label { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1.1px; color:#94a3b8; margin:16px 0 9px; padding-bottom:5px; border-bottom:1px solid #f1f5f9; }
  .note-box { background:#f0f4f8; border-radius:6px; padding:10px 13px; font-size:8.5px; color:#475569; line-height:1.6; margin-bottom:14px; }
  .legend { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 4px; }
  .legend-item { display:inline-flex; align-items:center; gap:5px; font-size:8px; font-weight:600; color:#334155; border:1px solid #e2e8f0; border-radius:20px; padding:2px 9px; }
  .legend-dot { width:8px; height:8px; border-radius:50%; }
  .party-block { background:#f8fafc; border-left:3px solid #1e3a5f; border-radius:0 6px 6px 0; padding:10px 13px; margin-bottom:10px; }
  .party-role { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin-bottom:4px; }
  .party-name { font-size:11px; font-weight:700; color:#1e3a5f; margin-bottom:3px; }
  .party-detail { font-size:9px; color:#475569; line-height:1.65; }
  .clause { margin-bottom:11px; break-inside:avoid; }
  .clause-num { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#1e3a5f; margin-bottom:3px; }
  .clause-body { font-size:9px; color:#334155; line-height:1.6; }
  .clause-body p { margin-bottom:4px; }
  .clause-body p:last-child { margin-bottom:0; }
  .clause-body p.en { color:#94a3b8; font-style:italic; font-size:8.3px; line-height:1.5; }
  .anx-title { font-size:13px; font-weight:700; color:#1e3a5f; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
  .anx-subtitle { font-size:9px; color:#64748b; margin-bottom:14px; }
  .anx-en { font-style:italic; color:#94a3b8; }
  table.tbl { width:100%; border-collapse:collapse; font-size:8.5px; margin:8px 0 14px; }
  table.tbl th { background:#1e3a5f; color:#fff; padding:6px 8px; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; text-align:left; }
  table.tbl th.right { text-align:right; }
  table.tbl td { padding:6px 8px; border-bottom:1px solid #f1f5f9; color:#334155; vertical-align:top; }
  table.tbl td.right { text-align:right; }
  table.tbl tr:last-child td { border-bottom:none; }
  .mono { font-family:'Courier New', monospace; }
  .right { text-align:right; }
  .fw6 { font-weight:600; }
  .cell-placeholder { color:#94a3b8; font-style:italic; }
  .notas-box { background:#fefce8; border:1px solid #fde68a; border-radius:6px; padding:9px 13px; margin:12px 0; font-size:9px; color:#78350f; line-height:1.6; }
  .notas-title { font-weight:700; margin-bottom:3px; font-size:8px; text-transform:uppercase; letter-spacing:0.7px; }
  /* Signatures */
  .sig-intro { font-size:9px; color:#475569; line-height:1.7; text-align:center; margin:16px 0 20px; }
  .sig-cols { width:100%; font-size:0; }
  .sig-col { display:inline-block; vertical-align:top; width:48%; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-right:4%; box-sizing:border-box; font-size:9px; }
  .sig-col:last-child { margin-right:0; }
  .sig-col-title { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin-bottom:11px; padding-bottom:6px; border-bottom:1px solid #f1f5f9; }
  .sig-name { font-size:10px; font-weight:700; color:#1e3a5f; margin-bottom:3px; }
  .sig-role { font-size:9px; color:#64748b; margin-bottom:2px; }
  .sig-nif  { font-size:9px; color:#94a3b8; margin-bottom:10px; }
  .sig-presigned { display:inline-flex; align-items:center; gap:5px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:20px; padding:3px 12px; font-size:10px; font-weight:700; color:#059669; }
  .sig-line-label { font-size:8px; color:#94a3b8; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.7px; }
  .sig-line { font-size:9px; color:#475569; margin-bottom:16px; padding-bottom:4px; border-bottom:1px solid #cbd5e1; min-height:14px; }
</style>
</head>
<body>

<div class="watermark">CONFIDENCIAL</div>

<!-- ═══ CONTRATO MACRO · portada + cuerpo + servicios (flujo continuo) ═══ -->
<div style="${PAGE}">
  ${lbl('Contrato y cláusulas')}

  <div class="contract-title">Contrato Macro de Prestación de Servicios</div>
  <div class="contract-subtitle">Master Services Agreement — documento consolidado (contrato + anexos) · Ref. PLT-SAAS-MACRO-001 · v1.7</div>
  <div class="contract-en-sub">En Madrid, a ${today} · Oferta vinculada nº ${esc(presupuesto.number)}</div>

  <div class="note-box">
    Documento único. A cada Cliente se le aplican solo los módulos contratados en su Oferta (Anexo I). Las cláusulas específicas de cada servicio van resaltadas por color.<br/>
    <span class="anx-en">Single document. Each Client is bound only by the modules contracted in its Offer (Annex I). Service-specific clauses are colour-highlighted.</span>
  </div>

  <div class="section-label">Servicios contratados · Contracted services</div>
  <div class="legend">
    ${activeLegend.length > 0
      ? activeLegend.map((l) => `<span class="legend-item"><span class="legend-dot" style="background:${SERVICE_COLOR[l.key]}"></span>${esc(l.label)}</span>`).join('')
      : '<span class="cell-placeholder">Ningún módulo detectado en la Oferta</span>'}
  </div>

  <div class="section-label">Reunidos · Between</div>

  <div class="party-block">
    <div class="party-role">De una parte — Proveedor / Provider</div>
    <div class="party-name">Platomico, S.L.</div>
    <div class="party-detail">
      CIF B-22741094 · C/ Antonio Machado 9, Rozas de Puerto Real, 28649 Madrid<br/>
      Representada por <strong>D. César Augusto Castro Sáder</strong>, Administrador Único<br/>
      Contacto: admin@platomico.com · Protección de datos: privacy@platomico.com<br/>
      (en adelante, el «PROVEEDOR» o «Platomico»)
    </div>
  </div>

  <div class="party-block">
    <div class="party-role">De otra parte — Cliente / Client</div>
    <div class="party-name">${esc(presupuesto.clientName)}</div>
    <div class="party-detail">
      ${presupuesto.clientCif ? `NIF/CIF: ${esc(presupuesto.clientCif)}<br/>` : ''}
      ${presupuesto.clientAddress ? `${esc(presupuesto.clientAddress)}<br/>` : ''}
      ${contactName ? `Representada por <strong>${esc(contactName)}</strong>, Administrador<br/>` : ''}
      ${contactEmail ? `Contacto: ${esc(contactEmail)}<br/>` : ''}
      (en adelante, el «CLIENTE»)
    </div>
  </div>

  <!-- Cuerpo común (mismo flujo) -->
  <div class="anx-title" style="margin-top:24px;">Cuerpo común · Common body</div>
  <div class="anx-subtitle">Cláusulas 1ª–23ª aplicables a todos los Servicios</div>
  ${commonRendered.map((c) => renderClause(c)).join('')}

  <!-- Cláusulas específicas por servicio (mismo flujo) -->
  ${serviceBlocks || renBlock ? `
  <div class="anx-title" style="margin-top:24px;">Cláusulas específicas por servicio</div>
  <div class="anx-subtitle">Service-specific clauses — solo los módulos contratados</div>
  ${serviceBlocks}
  ${renBlock ? `<div class="section-label" style="color:${SERVICE_COLOR.ren};">Módulo REN · Corresponsabilidad (art. 26)</div>${renBlock}` : ''}
  ` : ''}
</div>

<!-- ═══ ANEXO I · OFERTA + FIRMAS ═══ -->
<div style="break-before:page; ${PAGE}">
  ${lbl('Anexo I · Oferta comercial')}
  <div class="anx-title">Anexo I · Oferta comercial</div>
  <div class="anx-subtitle">Commercial Offer · nº ${esc(presupuesto.number)} — PLT-OFC-001</div>

  <table class="tbl">
    <thead><tr>
      <th>Concepto</th><th class="right">Cant.</th><th class="right">P. unit.</th><th class="right">P. total</th><th>Period.</th>
    </tr></thead>
    <tbody>${renderOfferRows(items)}</tbody>
  </table>
  <p style="font-size:8px;color:#94a3b8;margin-bottom:10px;">Importes sin IVA. / Amounts excl. VAT.</p>

  <div class="clause"><div class="clause-num">Prevalencia · Prevalence</div><div class="clause-body">
    <p>En caso de contradicción sobre precio, forma de pago o condiciones de facturación, prevalece esta Oferta sobre el Contrato. Para el resto de extremos se aplica el Contrato y sus Anexos. Forma de pago: <strong>${esc(formaPago)}</strong>.</p>
    <p class="en">In case of conflict over price, payment method or invoicing conditions, this Offer prevails over the Agreement. For all other matters, the Agreement and its Annexes apply.</p>
  </div></div>

  ${notas && notas.trim() ? `<div class="notas-box"><div class="notas-title">Notas / Notes</div>${esc(notas)}</div>` : ''}

  <div class="section-label">Firmas · Signatures</div>
  <div class="sig-intro">
    Y en prueba de conformidad, las partes suscriben el presente documento en Madrid, a ${today}.<br/>
    <span class="anx-en">In witness whereof, the parties sign this document in Madrid, on ${today}.</span>
  </div>
  <div class="sig-cols">
    <div class="sig-col">
      <div class="sig-col-title">Por el Proveedor · Platomico, S.L.</div>
      <div class="sig-name">César Augusto Castro Sáder</div>
      <div class="sig-role">Administrador Único</div>
      <div class="sig-nif">CIF B-22741094</div>
      <div class="sig-presigned">✓ Firmado</div>
    </div>
    <div class="sig-col">
      <div class="sig-col-title">Por el Cliente · ${esc(presupuesto.clientName)}</div>
      <div class="sig-name">${esc(presupuesto.clientName)}</div>
      ${presupuesto.clientCif ? `<div class="sig-role">NIF/CIF: ${esc(presupuesto.clientCif)}</div>` : ''}
      <div style="margin-top:14px;">
        <div class="sig-line-label">Representante</div>
        <div class="sig-line">${contactName ? esc(contactName) : '&nbsp;'}</div>
        <div class="sig-line-label">Cargo · DNI</div>
        <div class="sig-line">&nbsp;</div>
        <div class="sig-line-label">Firma · Fecha</div>
        <div class="sig-line">&nbsp;</div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ ANEXO II · SLA ═══ -->
<div style="break-before:page; ${PAGE}">
  ${lbl('Anexo II · SLA')}
  <div class="anx-title">Anexo II · Acuerdo de Nivel de Servicio (SLA)</div>
  <div class="anx-subtitle">Service Level Agreement — PLT-SLA-001</div>
  <p style="font-size:8.5px;color:#475569;line-height:1.6;margin-bottom:6px;">Horas hábiles: L–V 9:00–18:00 (hora peninsular), excluidos festivos. Tiempo de respuesta: hasta la primera respuesta sustantiva. Tiempo de resolución: hasta el restablecimiento o workaround.</p>
  <p style="font-size:8px;color:#94a3b8;font-style:italic;line-height:1.5;margin-bottom:12px;">Business hours: Mon–Fri 9:00–18:00 (mainland Spain), excluding holidays. Response: to first substantive response. Resolution: to restoration or workaround.</p>

  <table class="tbl">
    <thead><tr><th>Severidad</th><th>Descripción</th><th>Respuesta</th><th>Resolución</th></tr></thead>
    <tbody>
      <tr><td><strong>Crítica</strong></td><td>Servicio caído o funcionalidad esencial no disponible</td><td>4 h hábiles</td><td>8 h hábiles</td></tr>
      <tr><td><strong>Alta</strong></td><td>Funcionalidad relevante degradada</td><td>8 h hábiles</td><td>24 h hábiles</td></tr>
      <tr><td><strong>Media</strong></td><td>Incidencia con workaround</td><td>24 h hábiles</td><td>72 h hábiles</td></tr>
      <tr><td><strong>Baja</strong></td><td>Consultas o mejoras</td><td>48 h hábiles</td><td>A planificar</td></tr>
    </tbody>
  </table>

  <table class="tbl">
    <thead><tr><th>Plan</th><th>Hardware</th><th>Canales</th><th>Horario</th></tr></thead>
    <tbody>
      <tr><td><strong>Starter</strong></td><td>Register (POS)</td><td>Centro de ayuda + email</td><td>L–V 9:00–18:00</td></tr>
      <tr><td><strong>Growth</strong></td><td>Register o Kiosk</td><td>Centro de ayuda + email</td><td>L–V 9:00–23:00</td></tr>
      <tr><td><strong>Pro</strong></td><td>Register o Kiosk</td><td>Teléfono + WhatsApp + CSM</td><td>24/7</td></tr>
    </tbody>
  </table>
  <p style="font-size:8px;color:#64748b;line-height:1.5;">Starter/Growth: tiempos best effort. Pro: nivel garantizado (su incumplimiento reiterado habilita la excepción de la Cl. 18ª). Exclusiones: fuerza mayor, fallos de terceros, uso indebido, mantenimiento notificado y equipos del Cliente.</p>
</div>

<!-- ═══ ANEXO III · DPA ═══ -->
<div style="break-before:page; ${PAGE}">
  ${lbl('Anexo III · DPA (art. 28)')}
  <div class="anx-title">Anexo III · Acuerdo de Encargado del Tratamiento (DPA)</div>
  <div class="anx-subtitle">Data Processing Agreement — Art. 28 GDPR — PLT-DPA-C-001</div>
  ${DPA_CLAUSES.map((c) => renderClause(c)).join('')}

  <div style="break-before:page;">
    ${lbl('Anexo III · DPA (tratamiento y subencargados)')}
    <div class="section-label" style="break-after:avoid;">Anexo A · Tratamiento por módulo · Processing per module</div>
    <table class="tbl" style="break-inside:avoid;">
      <thead><tr><th>Módulo</th><th>Tratamiento</th></tr></thead>
      <tbody>
        ${DPA_MODULE_ROWS.filter((r) => services[r.key]).map((r) => `<tr><td><strong>${esc(r.mod)}</strong></td><td>${esc(r.es)}<br/><span class="anx-en">${esc(r.en)}</span></td></tr>`).join('') || '<tr><td colspan="2" class="cell-placeholder" style="text-align:center;">Sin módulos de encargo (ver REN en el cuerpo del Contrato)</td></tr>'}
      </tbody>
    </table>

    <div class="section-label" style="break-after:avoid;">Anexo B · Subencargados y transferencias · Sub-processors</div>
    <table class="tbl" style="break-inside:avoid;">
      <thead><tr><th>Subencargado</th><th>Uso</th><th>Región</th><th>Mecanismo</th></tr></thead>
      <tbody>
        ${SUBPROCESSORS.map(([n, u, r, m]) => `<tr><td><strong>${esc(n)}</strong></td><td>${esc(u)}</td><td>${esc(r)}</td><td>${esc(m)}</td></tr>`).join('')}
      </tbody>
    </table>
    <p style="font-size:8px;color:#64748b;line-height:1.5;">EEE = Espacio Económico Europeo. Las pasarelas de pago las contrata el Cliente (responsables independientes). Glovo/Uber/JustEat (REN) son responsables independientes. Ver PLT-VEN-001.</p>
  </div>
</div>

<!-- ═══ ANEXO IV · INVENTARIO ═══ -->
<div style="break-before:page; ${PAGE}">
  ${lbl('Anexo IV · Inventario de equipos')}
  <div class="anx-title">Anexo IV · Inventario de Equipos</div>
  <div class="anx-subtitle">Equipment Inventory — PLT-INV-001</div>
  <p style="font-size:8.5px;color:#475569;line-height:1.6;margin-bottom:10px;">Los equipos aportados por Platomico se ceden en comodato (arts. 1740 y ss. CC), vinculado a la vigencia; el Cliente los custodia con diligencia y los devuelve en 10 días desde la finalización, respondiendo del valor de reposición por pérdida o deterioro que exceda el desgaste ordinario. Los aportados por el Cliente permanecen de su propiedad.</p>

  <div class="clause" style="border-left:3px solid ${SERVICE_COLOR.equipos};padding-left:10px;">
    <div class="clause-num" style="color:${SERVICE_COLOR.equipos}">E2. Responsabilidad y custodia del equipo en comodato</div>
    <div class="clause-body">
      <p>Desde la entrega y hasta su devolución efectiva, el Cliente es el único custodio y responsable de los equipos cedidos en comodato (POS, Kiosk, KDS y periféricos) y asume el riesgo de su pérdida, sustracción, destrucción o deterioro que exceda el desgaste ordinario derivado del uso pactado. A tal efecto, los equipos se entregan tasados por el valor de reposición indicado en el inventario de este Anexo IV, por lo que, conforme al artículo 1745 del Código Civil, el Cliente responde de su pérdida o deterioro aunque sobrevengan por caso fortuito o fuerza mayor, así como en los supuestos del artículo 1744 CC (destino a un uso distinto del pactado o retención más allá del plazo de devolución). Esta asignación de riesgo constituye pacto expreso a los efectos del artículo 1745 CC y prevalece, respecto de los equipos, sobre la exención general de fuerza mayor de la Cláusula 16ª. El Cliente mantendrá los equipos asegurados por su valor de reposición durante toda la vigencia y acreditará dicho aseguramiento a requerimiento del Proveedor. El Cliente no responderá cuando la pérdida o el daño deriven de un defecto propio del equipo o sean directamente imputables al Proveedor. En caso de pérdida, daño no reparable o falta de devolución en plazo, el Cliente abonará el valor de reposición vigente del equipo afectado. La cuota de mantenimiento retribuye exclusivamente el servicio de mantenimiento y no la cesión de uso, que permanece gratuita a título de comodato; la asignación de riesgo y el deber de aseguramiento se aplican cualquiera que sea la calificación jurídica de la cesión.</p>
      <p class="en">From delivery until effective return, the Client is the sole custodian of and responsible for the equipment loaned under commodatum (POS, Kiosk, KDS and peripherals) and bears the risk of its loss, theft, destruction or damage beyond ordinary wear from the agreed use. To this end, the equipment is delivered appraised at the replacement value stated in the inventory of this Annex IV, so that, under Article 1745 of the Spanish Civil Code, the Client is liable for its loss or damage even where arising from an act of God or force majeure, as well as in the cases of Article 1744 CC (use other than agreed or retention beyond the return period). This risk allocation is an express agreement for the purposes of Article 1745 CC and prevails, as regards the equipment, over the general force-majeure exemption in Clause 16. The Client shall keep the equipment insured for its replacement value throughout the term and shall evidence such insurance upon the Provider request. The Client shall not be liable where the loss or damage results from an inherent defect of the equipment or is directly attributable to the Provider. In the event of loss, irreparable damage or failure to return on time, the Client shall pay the then-current replacement value of the affected equipment. The maintenance fee remunerates solely the maintenance service and not the transfer of use, which remains gratuitous by way of commodatum; the risk allocation and the insurance duty apply regardless of the legal characterisation of the transfer.</p>
    </div>
  </div>

  <table class="tbl">
    <thead><tr><th>Nº</th><th>Tipología</th><th>Marca/modelo</th><th>Nº serie</th><th>Origen</th><th>Modalidad</th><th class="right">Valor reposición (€)</th></tr></thead>
    <tbody>${equipmentRows}</tbody>
  </table>
</div>

<!-- ═══ ANEXO V · NDA + FIRMAS ═══ -->
<div style="break-before:page; ${PAGE}">
  ${lbl('Anexo V · NDA')}
  <div class="anx-title">Anexo V · Acuerdo de Confidencialidad (NDA)</div>
  <div class="anx-subtitle">Non-Disclosure Agreement — PLT-NDA-001</div>
  ${NDA_CLAUSES.map((c) => renderClause(c)).join('')}

  <div class="section-label">Firmas · Signatures</div>
  <div class="sig-cols">
    <div class="sig-col">
      <div class="sig-col-title">Por el Proveedor · Platomico, S.L.</div>
      <div class="sig-name">César Augusto Castro Sáder</div>
      <div class="sig-role">Administrador Único · CIF B-22741094</div>
      <div class="sig-presigned">✓ Firmado</div>
    </div>
    <div class="sig-col">
      <div class="sig-col-title">Por el Cliente · ${esc(presupuesto.clientName)}</div>
      <div class="sig-name">${esc(presupuesto.clientName)}</div>
      ${presupuesto.clientCif ? `<div class="sig-role">NIF/CIF: ${esc(presupuesto.clientCif)}</div>` : ''}
      <div style="margin-top:14px;">
        <div class="sig-line-label">Representante · DNI</div>
        <div class="sig-line">${contactName ? esc(contactName) : '&nbsp;'}</div>
        <div class="sig-line-label">Firma · Fecha</div>
        <div class="sig-line">&nbsp;</div>
      </div>
    </div>
  </div>
</div>

</body>
</html>`

  // Render to PDF via the shared puppeteer helper (applies A4 + footer)
  const { renderHtmlToPdf } = await import('./generate')
  return renderHtmlToPdf(html)
}
