'use client'

import { useState, useEffect } from 'react'
import { createUserAction, createUserManualAction } from '@/app/actions/create-user'
import { UserList } from './user-list'
import type { WorkspaceMember } from '@/lib/auth'

interface Props {
  members: WorkspaceMember[]
  currentUserId: string
  initialSuccess?: string
  initialError?: string
}

export function AdminUsersClient({ members, currentUserId, initialSuccess, initialError }: Props) {
  const [bannerVisible, setBannerVisible] = useState(!!(initialSuccess || initialError))
  const [modalOpen, setModalOpen] = useState(false)
  const [tab, setTab] = useState<'invite' | 'manual'>('invite')
  const [formKey, setFormKey] = useState(0)
  const [search, setSearch] = useState('')

  // Auto-dismiss banner after 3 s
  useEffect(() => {
    if (!bannerVisible) return
    const t = setTimeout(() => setBannerVisible(false), 3000)
    return () => clearTimeout(t)
  }, [bannerVisible])

  function handleCloseModal() {
    setModalOpen(false)
    setFormKey((k) => k + 1) // resets all form inputs
    setBannerVisible(false)
  }

  const filtered = search
    ? members.filter((m) => {
        const q = search.toLowerCase()
        return (m.name ?? '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      })
    : members

  const totalAdmins = members.filter((m) => m.role === 'admin').length
  const totalSales  = members.filter((m) => m.role === 'sales').length

  const inputCls = 'w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition'
  const selectCls = inputCls + ' bg-white'

  return (
    <div className="p-8 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Usuarios</h1>
        <button
          onClick={() => { setModalOpen(true); setTab('invite') }}
          className="inline-flex items-center gap-1.5 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          + Nuevo usuario
        </button>
      </div>

      {/* ── Banner ── */}
      {bannerVisible && initialError && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {initialError}
        </div>
      )}
      {bannerVisible && initialSuccess === '1' && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg">
          Invitación enviada. El usuario recibirá un email para configurar su contraseña.
        </div>
      )}
      {bannerVisible && initialSuccess === 'manual' && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg">
          Usuario creado correctamente.
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total usuarios', value: members.length },
          { label: 'Admins',         value: totalAdmins },
          { label: 'Sales',          value: totalSales },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-semibold text-zinc-900 font-mono">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition bg-white"
        />
      </div>

      {/* ── User list ── */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            {search ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}` : `Usuarios (${members.length})`}
          </h2>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-400">
            {search ? 'Sin resultados.' : 'No hay usuarios registrados.'}
          </p>
        ) : (
          <UserList members={filtered} currentUserId={currentUserId} />
        )}
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal() }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
              <h2 className="text-base font-semibold text-zinc-900">Nuevo usuario</h2>
              <button
                onClick={handleCloseModal}
                className="text-zinc-400 hover:text-zinc-700 transition-colors text-xl leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-100">
              {(['invite', 'manual'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors cursor-pointer ${
                    tab === t
                      ? 'text-zinc-900 border-b-2 border-zinc-900 -mb-px'
                      : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {t === 'invite' ? 'Invitar por email' : 'Crear con contraseña'}
                </button>
              ))}
            </div>

            {/* Forms */}
            <div className="px-6 py-5">
              {tab === 'invite' ? (
                <form key={`invite-${formKey}`} action={createUserAction} className="space-y-4">
                  <p className="text-xs text-zinc-400">
                    Supabase envía un enlace para que el usuario cree su propia contraseña.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nombre</label>
                    <input type="text" name="name" placeholder="Ej: María García" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input type="email" name="email" required placeholder="maria@empresa.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Rol</label>
                    <select name="role" defaultValue="sales" className={selectCls}>
                      <option value="sales">Sales</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button type="submit" className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors">
                      Enviar invitación →
                    </button>
                  </div>
                </form>
              ) : (
                <form key={`manual-${formKey}`} action={createUserManualAction} className="space-y-4">
                  <p className="text-xs text-zinc-400">
                    Crea el usuario directamente sin enviar ningún email.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nombre</label>
                    <input type="text" name="name" placeholder="Ej: María García" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input type="email" name="email" required placeholder="maria@empresa.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                      Contraseña <span className="text-red-500">*</span>
                    </label>
                    <input type="password" name="password" required minLength={6} placeholder="Mín. 6 caracteres" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Rol</label>
                    <select name="role" defaultValue="sales" className={selectCls}>
                      <option value="sales">Sales</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button type="submit" className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors">
                      Crear usuario →
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
