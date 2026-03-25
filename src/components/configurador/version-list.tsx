'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import { activateVersionAction } from '@/app/actions/activate-version'
import type { Deal, DealConfiguration } from '@/types'

interface VersionListProps {
  deal: Deal
  /** ID de la config que el simulador tiene cargada actualmente */
  loadedConfigId: string | undefined
}

export function VersionList({ deal, loadedConfigId }: VersionListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const configs = [...deal.configurations].sort((a, b) => b.version - a.version)

  if (configs.length === 0) return null

  function handleActivate(config: DealConfiguration) {
    setActivatingId(config.id)
    startTransition(async () => {
      const result = await activateVersionAction(deal.id, config.id)
      if (result.ok) {
        // Navigate to base URL (drops ?config query param) and refresh
        router.push(`/deals/${deal.id}/configurador`)
        router.refresh()
      }
      setActivatingId(null)
    })
  }

  return (
    <div className="mb-6 bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Versiones
        </p>
        <span className="text-xs text-zinc-400">{configs.length} guardadas</span>
      </div>

      <div className="divide-y divide-zinc-100">
        {configs.map((config) => {
          const isActive = config.id === deal.activeConfigId
          const isLoaded = config.id === loadedConfigId
          const isActivating = activatingId === config.id && isPending

          return (
            <div
              key={config.id}
              className={`flex items-center gap-4 px-5 py-3 ${
                isLoaded ? 'bg-zinc-50' : 'bg-white'
              }`}
            >
              {/* Version badge */}
              <div className="shrink-0 flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  v{config.version}
                </span>
                {isActive && (
                  <span className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">
                    activa
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-mono font-semibold text-zinc-800">
                    {formatCurrency(config.economics.totalMonthlyRevenue)}/mes
                  </span>
                  <span className="text-xs text-zinc-400">
                    {config.locations} local{config.locations > 1 ? 'es' : ''} ·{' '}
                    {config.dailyOrdersPerLocation} pedidos/día ·{' '}
                    {config.plan}
                  </span>
                  {config.economics.paybackMonths !== null && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      config.economics.paybackMonths <= 12
                        ? 'bg-emerald-50 text-emerald-600'
                        : config.economics.paybackMonths <= 24
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      payback {config.economics.paybackMonths}m
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {new Date(config.createdAt).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  {config.label && ` · ${config.label}`}
                </p>
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-2">
                {/* Load into simulator */}
                {!isLoaded && (
                  <Link
                    href={`/deals/${deal.id}/configurador?config=${config.id}`}
                    className="text-xs text-zinc-500 hover:text-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 hover:border-zinc-400 transition-colors"
                  >
                    Cargar
                  </Link>
                )}

                {/* Activate */}
                {!isActive && (
                  <button
                    onClick={() => handleActivate(config)}
                    disabled={isPending}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      isActivating
                        ? 'border-zinc-200 text-zinc-400 cursor-not-allowed'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'
                    } disabled:opacity-50`}
                  >
                    {isActivating ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="7" />
                        </svg>
                        Activando...
                      </span>
                    ) : (
                      'Activar'
                    )}
                  </button>
                )}

                {isLoaded && isActive && (
                  <span className="text-[10px] text-zinc-400 italic">cargada</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
