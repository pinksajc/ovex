import Link from 'next/link'
import { getPresupuestos } from '@/lib/supabase/presupuestos'
import { OfertasList } from '@/components/ofertas/ofertas-list'
import type { Presupuesto } from '@/types'

export default async function OfertasPage() {
  let ofertas: Presupuesto[] = []
  let fetchError = false

  try {
    ofertas = await getPresupuestos()
  } catch {
    fetchError = true
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Ofertas</h1>
          <p className="text-text-tertiary text-[13px] mt-0.5">
            {ofertas.length} oferta{ofertas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/ofertas/nuevo"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-accent text-base hover:bg-accent-hover px-3 h-9 rounded-[6px] transition-colors duration-150"
        >
          + Nueva oferta
        </Link>
      </div>

      <OfertasList ofertas={ofertas} fetchError={fetchError} />
    </div>
  )
}
