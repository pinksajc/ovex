import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPresupuesto } from '@/lib/supabase/presupuestos'
import { OfertaActions } from './actions'
import type { PresupuestoStatus } from '@/types'

const STATUS_LABELS: Record<PresupuestoStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Expirado',
}

const STATUS_COLORS: Record<PresupuestoStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
}

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-zinc-50 last:border-0">
      <span className="text-xs text-zinc-400 shrink-0 w-40">{label}</span>
      <span className="text-xs font-medium text-zinc-800 text-right">{value}</span>
    </div>
  )
}

export default async function OfertaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const presupuesto = await getPresupuesto(id).catch(() => null)
  if (!presupuesto) notFound()

  const vatAmount = presupuesto.amountNet * (presupuesto.vatRate / 100)
  const canEdit = presupuesto.status === 'draft' || presupuesto.status === 'sent'

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Back */}
      <Link
        href="/facturas?tab=ofertas"
        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 mb-6 transition-colors"
      >
        ← Ofertas
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-zinc-900 font-mono tracking-tight">{presupuesto.number}</h1>
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${STATUS_COLORS[presupuesto.status]}`}>
              {STATUS_LABELS[presupuesto.status]}
            </span>
          </div>
          <p className="text-sm text-zinc-500">{presupuesto.clientName}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <Link
              href={`/ofertas/${presupuesto.id}/editar`}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Editar
            </Link>
          )}
          <a
            href={`/api/presupuestos/generate-pdf?id=${presupuesto.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 11h10" strokeLinecap="round" />
            </svg>
            Descargar oferta
          </a>
          <a
            href={`/api/ofertas/generate-pdf?id=${presupuesto.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 11h10" strokeLinecap="round" />
            </svg>
            Descargar Sales Deck
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left */}
        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Cliente</h2>
            <p className="text-sm font-semibold text-zinc-900">{presupuesto.clientName}</p>
            {presupuesto.clientCif && <p className="text-xs text-zinc-500 mt-0.5">NIF/CIF: {presupuesto.clientCif}</p>}
            {presupuesto.clientAddress && <p className="text-xs text-zinc-500 mt-0.5">{presupuesto.clientAddress}</p>}
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Concepto</h2>
            <p className="text-sm text-zinc-800">{presupuesto.concept}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Fechas</h2>
            <Row label="Válido hasta" value={formatDate(presupuesto.validUntil)} />
            <Row label="Creado" value={formatDate(presupuesto.createdAt)} />
          </div>

          {presupuesto.notes && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Notas</h2>
              <p className="text-xs text-zinc-700 whitespace-pre-wrap">{presupuesto.notes}</p>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Importes</h2>
            <div className="space-y-1">
              <Row label="Base imponible" value={<span className="font-mono">{formatEur(presupuesto.amountNet)}</span>} />
              <Row label={`IVA (${presupuesto.vatRate}%)`} value={<span className="font-mono">{formatEur(vatAmount)}</span>} />
              <div className="flex items-start justify-between pt-2.5 border-t border-zinc-200">
                <span className="text-xs font-semibold text-zinc-700">Total oferta</span>
                <span className="text-base font-mono font-semibold text-zinc-900">{formatEur(presupuesto.amountTotal)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Cambiar estado</h2>
            <OfertaActions presupuestoId={presupuesto.id} currentStatus={presupuesto.status} />
          </div>

          {presupuesto.dealId && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Deal vinculado</h2>
              <Link
                href={`/deals/${presupuesto.dealId}`}
                className="text-xs text-blue-700 hover:underline font-mono"
              >
                Ver deal →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
