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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Ofertas</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {ofertas.length} oferta{ofertas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/ofertas/nuevo"
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          + Nueva oferta
        </Link>
      </div>

      <OfertasList ofertas={ofertas} fetchError={fetchError} />
    </div>
  )
}
