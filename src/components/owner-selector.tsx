'use client'

import { useState, useTransition } from 'react'
import { updateOwnerAction } from '@/app/actions/update-owner'

interface Member {
  id: string
  name: string | null
  email: string
}

interface OwnerSelectorProps {
  dealId: string
  currentOwnerId: string | null
  members: Member[]
}

export function OwnerSelector({ dealId, currentOwnerId, members }: OwnerSelectorProps) {
  const [ownerId, setOwnerId] = useState(currentOwnerId ?? '')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setOwnerId(val)
    setError(null)
    startTransition(async () => {
      const result = await updateOwnerAction(dealId, val || null)
      if (!result.ok) setError(result.error)
    })
  }

  const current = members.find((m) => m.id === ownerId)
  const displayName = current ? (current.name ?? current.email) : 'Sin asignar'

  return (
    <div className="flex items-center gap-2 group relative">
      <span className="text-sm text-zinc-400">
        Owner:{' '}
        <span className={isPending ? 'opacity-50' : 'text-zinc-700 font-medium'}>
          {isPending ? '…' : displayName}
        </span>
      </span>
      <select
        value={ownerId}
        onChange={handleChange}
        disabled={isPending}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        title="Cambiar owner"
      >
        <option value="">Sin asignar</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name ?? m.email}
          </option>
        ))}
      </select>
      <svg
        className="w-3 h-3 text-zinc-400 shrink-0 pointer-events-none"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {error && (
        <span className="absolute top-full left-0 mt-1 text-[11px] text-red-500 bg-white border border-red-100 rounded px-2 py-1 z-10 whitespace-nowrap">
          {error}
        </span>
      )}
    </div>
  )
}
