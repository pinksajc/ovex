import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDeal, getActiveConfig } from '@/lib/deals'
import { Simulator } from '@/components/configurador/simulator'

export default async function ConfiguradorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const deal = await getDeal(id)

  if (!deal) notFound()

  const activeConfig = getActiveConfig(deal)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <Link href="/deals" className="hover:text-zinc-700 transition-colors">
          Deals
        </Link>
        <span>/</span>
        <Link
          href={`/deals/${deal.id}`}
          className="hover:text-zinc-700 transition-colors"
        >
          {deal.company.name}
        </Link>
        <span>/</span>
        <span className="text-zinc-700 font-medium">Simulador</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Orvex Simulator
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {deal.company.name} · {deal.company.city}
            {activeConfig && (
              <span className="ml-2 text-zinc-400">
                v{activeConfig.version}
                {activeConfig.label && ` · ${activeConfig.label}`}
              </span>
            )}
          </p>
        </div>
        <button
          disabled
          title="Próximamente — requiere generar PDF"
          className="text-sm text-zinc-400 bg-zinc-100 px-4 py-2 rounded-lg cursor-not-allowed"
        >
          Generar propuesta
        </button>
      </div>

      {/* Simulator */}
      <Simulator deal={deal} initialConfig={activeConfig} />
    </div>
  )
}
