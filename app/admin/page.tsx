'use client'

// app/admin/page.tsx — Super Admin Panel
// Access: only emails listed in SUPER_ADMIN_EMAILS env var.

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users, CreditCard, BarChart3, Loader2, Search,
  ChevronLeft, ChevronRight, Shield, Check, X,
  AlertTriangle, Building2, Zap, RefreshCw, Edit2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { PLAN_DISPLAY, PLAN_PRICING, type Plan } from '@/lib/nexus-plan'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminUser {
  id:               string
  email:            string
  name:             string | null
  plan:             Plan
  company_id:       string | null
  company_name:     string | null
  ai_messages_used: number
  created_at:       string
  subscription: {
    status:              string
    plan:                Plan
    stripe_customer_id:  string | null
    trial_ends_at:       string | null
    current_period_end:  string | null
    created_at:          string
  } | null
}

interface AdminData {
  users:  AdminUser[]
  total:  number
  page:   number
  pages:  number
}

const PLANS: Plan[] = ['free', 'starter', 'pro', 'scale', 'enterprise']

const STATUS_COLOR: Record<string, string> = {
  active:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  trialing:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  past_due:  'text-orange-400 bg-orange-500/10 border-orange-500/20',
  canceled:  'text-red-400 bg-red-500/10 border-red-500/20',
  free:      'text-zinc-500 bg-zinc-800 border-zinc-700',
}

const PLAN_COLOR: Record<Plan, string> = {
  free:       'text-zinc-400 bg-zinc-800/60 border-zinc-700',
  starter:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  pro:        'text-violet-400 bg-violet-500/10 border-violet-500/20',
  scale:      'text-amber-400 bg-amber-500/10 border-amber-500/20',
  enterprise: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

function fmt(s: string) { return new Date(s).toLocaleDateString('pt-BR') }
function fmtRel(s: string | null) {
  if (!s) return '—'
  const d = Math.ceil((new Date(s).getTime() - Date.now()) / 86400000)
  return d > 0 ? `em ${d}d` : `há ${-d}d`
}

// ── Edit Plan Modal ────────────────────────────────────────────────────────────

function EditPlanModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser
  onClose: () => void
  onSaved: (userId: string, plan: Plan) => void
}) {
  const [plan,    setPlan]    = useState<Plan>(user.plan)
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const res  = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: user.id, plan, note }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro'); return }
      onSaved(user.id, plan)
      onClose()
    } catch {
      setErr('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-bold text-white">Alterar plano</p>
            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[200px]">{user.email}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {PLANS.map(p => (
            <button
              key={p}
              onClick={() => setPlan(p)}
              className={cn(
                'px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left',
                plan === p
                  ? PLAN_COLOR[p]
                  : 'text-zinc-600 border-zinc-800 hover:border-zinc-700 hover:text-zinc-400',
              )}
            >
              <div className="flex items-center justify-between">
                <span>{PLAN_DISPLAY[p]}</span>
                {plan === p && <Check className="w-3 h-3" />}
              </div>
              <p className="text-[10px] opacity-70 mt-0.5 font-normal">{PLAN_PRICING[p].display}</p>
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Nota (interna)</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ex: cortesia, parceria, teste..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50"
          />
        </div>

        {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm text-zinc-400 border border-zinc-800 rounded-xl py-2.5 hover:bg-zinc-800/50 transition">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || plan === user.plan}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl py-2.5 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [data,       setData]       = useState<AdminData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [page,       setPage]       = useState(1)
  const [search,     setSearch]     = useState('')
  const [editUser,   setEditUser]   = useState<AdminUser | null>(null)
  const [filterPlan, setFilterPlan] = useState<Plan | 'all'>('all')

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/admin/users?page=${p}&q=${encodeURIComponent(q)}`)
      if (res.status === 403) { setError('Acesso negado — apenas super admins'); return }
      if (!res.ok) { setError('Erro ao carregar dados'); return }
      const d = await res.json()
      setData(d)
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(page, search), search ? 400 : 0)
    return () => clearTimeout(t)
  }, [page, search, load])

  const handlePlanSaved = (userId: string, plan: Plan) => {
    setData(prev => prev ? {
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, plan } : u)
    } : prev)
  }

  // ── Stats ──────────────────────────────────────────────────────

  const stats = data?.users ? (() => {
    const users    = data.users
    const planDist = PLANS.reduce((acc, p) => { acc[p] = users.filter(u => u.plan === p).length; return acc }, {} as Record<Plan, number>)
    const active   = users.filter(u => u.subscription?.status === 'active').length
    const trialing = users.filter(u => u.subscription?.status === 'trialing').length
    const pastDue  = users.filter(u => u.subscription?.status === 'past_due').length
    const totalMsgs= users.reduce((a, u) => a + u.ai_messages_used, 0)
    return { planDist, active, trialing, pastDue, totalMsgs }
  })() : null

  const visibleUsers = (data?.users ?? []).filter(u =>
    filterPlan === 'all' ? true : u.plan === filterPlan
  )

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800/60 px-8 py-5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Super Admin · NEXUS</h1>
              <p className="text-xs text-zinc-500">Painel administrativo — acesso restrito</p>
            </div>
          </div>
          <button
            onClick={() => load(page, search)}
            disabled={loading}
            className="flex items-center gap-2 text-xs text-zinc-400 border border-zinc-800 rounded-xl px-4 py-2 hover:border-zinc-700 transition disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-950/60 border border-red-800/60 rounded-2xl p-4">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total usuários', value: data!.total, icon: Users, color: 'text-violet-400' },
              { label: 'Ativos',         value: stats.active, icon: Check, color: 'text-emerald-400' },
              { label: 'Em trial',       value: stats.trialing, icon: Zap, color: 'text-blue-400' },
              { label: 'Past due',       value: stats.pastDue, icon: AlertTriangle, color: 'text-orange-400' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className={cn('mb-2', s.color)}><s.icon className="w-5 h-5" /></div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Plan distribution */}
        {stats && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-violet-400" />
              <p className="text-sm font-semibold text-white">Distribuição de Planos</p>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {PLANS.map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPlan(filterPlan === p ? 'all' : p)}
                  className={cn(
                    'rounded-xl border p-3 text-center transition cursor-pointer',
                    filterPlan === p ? PLAN_COLOR[p] : 'border-zinc-800 hover:border-zinc-700',
                  )}
                >
                  <p className="text-xl font-bold text-white">{stats.planDist[p]}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{PLAN_DISPLAY[p]}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search + table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              <p className="text-sm font-semibold text-white">Usuários</p>
              {data && <span className="text-xs text-zinc-500">({data.total} total)</span>}
              {filterPlan !== 'all' && (
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', PLAN_COLOR[filterPlan])}>
                  {PLAN_DISPLAY[filterPlan]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 w-64">
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar email ou nome..."
                className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {['Usuário', 'Empresa', 'Plano', 'Assinatura', 'Trial/Venc.', 'Msgs IA', 'Cadastro', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((user, i) => {
                      const sub     = user.subscription
                      const status  = sub?.status ?? 'free'
                      const endDate = sub?.trial_ends_at ?? sub?.current_period_end ?? null
                      return (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-zinc-200 truncate max-w-[180px]">{user.name ?? '—'}</p>
                            <p className="text-zinc-500 truncate max-w-[180px]">{user.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            {user.company_name ? (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3 h-3 text-zinc-600" />
                                <span className="text-zinc-400 truncate max-w-[120px]">{user.company_name}</span>
                              </div>
                            ) : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold', PLAN_COLOR[user.plan])}>
                              {PLAN_DISPLAY[user.plan]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {sub ? (
                              <span className={cn('inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold', STATUS_COLOR[status] ?? STATUS_COLOR.free)}>
                                {status}
                              </span>
                            ) : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {endDate ? fmtRel(endDate) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('font-semibold', user.ai_messages_used > 1000 ? 'text-orange-400' : 'text-zinc-400')}>
                              {user.ai_messages_used.toLocaleString('pt-BR')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-500">{fmt(user.created_at)}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setEditUser(user)}
                              className="flex items-center gap-1 text-[10px] text-violet-400 border border-violet-500/30 rounded-lg px-2 py-1 hover:bg-violet-500/10 transition"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              Plano
                            </button>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500">
                    Página {data.page} de {data.pages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-7 h-7 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 transition"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                      disabled={page === data.pages}
                      className="w-7 h-7 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 transition"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit plan modal */}
      {editUser && (
        <EditPlanModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={handlePlanSaved}
        />
      )}
    </div>
  )
}
