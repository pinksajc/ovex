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

  const inputCls = 'w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition'
  const selectCls = 'w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/40 transition'

  return (
    <div className="p-8 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Usuarios</h1>
        <button
          onClick={() => { setModalOpen(true); setTab('invite') }}
          className="inline-flex items-center gap-1.5 bg-accent text-base text-[13px] font-medium px-4 h-9 rounded-[6px] hover:bg-accent-hover transition-colors"
        >
          + Nuevo usuario
        </button>
      </div>

      {/* ── Banner ── */}
      {bannerVisible && initialError && (
        <div className="mb-5 bg-danger/8 border border-danger/20 text-danger text-[13px] px-4 py-3 rounded-[6px]">
          {initialError}
        </div>
      )}
      {bannerVisible && initialSuccess === '1' && (
        <div className="mb-5 bg-success/8 border border-success/20 text-success text-[13px] px-4 py-3 rounded-[6px]">
          Invitación enviada. El usuario recibirá un email para configurar su contraseña.
        </div>
      )}
      {bannerVisible && initialSuccess === 'manual' && (
        <div className="mb-5 bg-success/8 border border-success/20 text-success text-[13px] px-4 py-3 rounded-[6px]">
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
          <div key={label} className="bg-surface border border-border-subtle rounded-lg px-5 py-4">
            <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-widest mb-1">{label}</p>
            <p className="text-[28px] font-semibold text-text-primary font-mono leading-none">{value}</p>
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
          className="w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
        />
      </div>

      {/* ── User list ── */}
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-widest">
            {search ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}` : `Usuarios (${members.length})`}
          </h2>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-text-tertiary">
            {search ? 'Sin resultados.' : 'No hay usuarios registrados.'}
          </p>
        ) : (
          <UserList members={filtered} currentUserId={currentUserId} />
        )}
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal() }}
        >
          <div className="bg-surface border border-border-subtle rounded-lg shadow-2xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-subtle">
              <h2 className="text-[13px] font-semibold text-text-primary">Nuevo usuario</h2>
              <button
                onClick={handleCloseModal}
                className="text-text-tertiary hover:text-text-secondary transition-colors text-xl leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border-subtle">
              {(['invite', 'manual'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs font-medium uppercase tracking-widest transition-colors cursor-pointer ${
                    tab === t
                      ? 'text-accent-text border-b-2 border-accent -mb-px'
                      : 'text-text-tertiary hover:text-text-secondary'
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
                  <p className="text-xs text-text-tertiary">
                    Supabase envía un enlace para que el usuario cree su propia contraseña.
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">Nombre</label>
                    <input type="text" name="name" placeholder="Ej: María García" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">
                      Email <span className="text-danger">*</span>
                    </label>
                    <input type="email" name="email" required placeholder="maria@empresa.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">Rol</label>
                    <select name="role" defaultValue="sales" className={selectCls}>
                      <option value="sales">Sales</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button type="submit" className="bg-accent text-base text-[13px] font-medium px-5 h-9 rounded-[6px] hover:bg-accent-hover transition-colors">
                      Enviar invitación →
                    </button>
                  </div>
                </form>
              ) : (
                <form key={`manual-${formKey}`} action={createUserManualAction} className="space-y-4">
                  <p className="text-xs text-text-tertiary">
                    Crea el usuario directamente sin enviar ningún email.
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">Nombre</label>
                    <input type="text" name="name" placeholder="Ej: María García" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">
                      Email <span className="text-danger">*</span>
                    </label>
                    <input type="email" name="email" required placeholder="maria@empresa.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">
                      Contraseña <span className="text-danger">*</span>
                    </label>
                    <input type="password" name="password" required minLength={6} placeholder="Mín. 6 caracteres" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">Rol</label>
                    <select name="role" defaultValue="sales" className={selectCls}>
                      <option value="sales">Sales</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button type="submit" className="bg-accent text-base text-[13px] font-medium px-5 h-9 rounded-[6px] hover:bg-accent-hover transition-colors">
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
