import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDeal, getActiveConfig } from '@/lib/deals'
import { Simulator } from '@/components/configurador/simulator'
import { VersionList } from '@/components/configurador/version-list'

export default async function ConfiguradorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const { config: configQueryParam } = await searchParams

  const deal = await getDeal(id)
  if (!deal) notFound()

  const activeConfig = getActiveConfig(deal)

  // If ?config=xxx is present, load that specific version
  const configId = typeof configQueryParam === 'string' ? configQueryParam : undefined
  const displayConfig = configId
    ? (deal.configurations.find((c) => c.id === configId) ?? activeConfig)
    : activeConfig

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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Orvex Simulator
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {deal.company.name}
            {deal.company.city && ` · ${deal.company.city}`}
            {displayConfig && (
              <span className="ml-2 text-zinc-400">
                · cargada v{displayConfig.version}
                {displayConfig.id === deal.activeConfigId && (
                  <span className="ml-1 text-emerald-500">✓</span>
                )}
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

      {/* Version list (hidden when only 1 or 0 versions) */}
      {deal.configurations.length > 0 && (
        <VersionList deal={deal} loadedConfigId={displayConfig?.id} />
      )}

      {/* Simulator */}
      <Simulator deal={deal} initialConfig={displayConfig} />
    </div>
  )
}
