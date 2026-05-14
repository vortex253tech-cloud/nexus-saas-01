'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users, TrendingUp, Gift, Search, ArrowUp, ArrowDown,
  Copy, Mail, RefreshCw, CheckCircle, Clock, ChevronUp, ChevronDown,
} from 'lucide-react'

interface WaitlistEntry {
  id: string
  name: string
  email: string
  company: string
  team_size: string | null
  position: number
  referral_code: string
  referred_by: string | null
  referrals_count: number
  source: string | null
  created_at: string
}

interface Stats {
  total: number
  withReferrals: number
  topReferrer: { name: string; referrals_count: number } | null
}

type SortField = 'position' | 'referrals_count' | 'created_at' | 'name'

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''

export default function AdminWaitlistPage() {
  const [data, setData] = useState<WaitlistEntry[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortField>('position')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [secret, setSecret] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [authError, setAuthError] = useState(false)

  const fetchData = useCallback(async (adminSecret: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort, order })
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/waitlist?${params}`, {
        headers: { 'x-admin-secret': adminSecret },
      })

      if (res.status === 401) {
        setAuthenticated(false)
        setAuthError(true)
        return
      }

      const json = await res.json()
      setData(json.data ?? [])
      setStats(json.stats ?? null)
    } finally {
      setLoading(false)
    }
  }, [sort, order, search])

  useEffect(() => {
    if (authenticated) fetchData(secret)
  }, [authenticated, fetchData, secret])

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(false)
    setAuthenticated(true)
    fetchData(secret)
  }

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(field)
      setOrder('asc')
    }
  }

  const sendAccess = async (email: string) => {
    setSending(email)
    try {
      const res = await fetch('/api/waitlist/send-sequence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? 'nexus_cron_2025'}`,
        },
        body: JSON.stringify({ step: 5, email }),
      })
      const json = await res.json()
      if (json.sent > 0) setSent(p => [...p, email])
    } finally {
      setSending(null)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(`https://nexusaas.com.br/v1?ref=${code}`)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort !== field) return <ChevronUp className="w-3 h-3 opacity-20" />
    return order === 'asc'
      ? <ChevronUp className="w-3 h-3 text-violet-400" />
      : <ChevronDown className="w-3 h-3 text-violet-400" />
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#04040a] flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-violet-400" />
            </div>
            <h1 className="text-xl font-semibold text-white">Admin — Waitlist</h1>
            <p className="text-sm text-white/40 mt-1">NEXUS</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-3">
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Admin secret"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 text-sm"
              autoFocus
            />
            {authError && (
              <p className="text-xs text-red-400 text-center">Secret incorreto</p>
            )}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#04040a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Users className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Waitlist Admin</h1>
            <p className="text-xs text-white/40">NEXUS</p>
          </div>
        </div>
        <button
          onClick={() => fetchData(secret)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          Atualizar
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-xs text-white/40 uppercase tracking-wide">Total inscritos</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.total}</p>
            </div>

            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Gift className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-xs text-white/40 uppercase tracking-wide">Com referrals</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.withReferrals}</p>
              <p className="text-xs text-white/30 mt-1">
                {stats.total > 0 ? Math.round((stats.withReferrals / stats.total) * 100) : 0}% do total
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs text-white/40 uppercase tracking-wide">Top referrer</span>
              </div>
              {stats.topReferrer ? (
                <>
                  <p className="text-lg font-bold text-white truncate">{stats.topReferrer.name}</p>
                  <p className="text-xs text-white/30 mt-1">{stats.topReferrer.referrals_count} indicações</p>
                </>
              ) : (
                <p className="text-white/30 text-sm">Nenhum ainda</p>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou empresa..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 text-sm transition-colors"
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {[
                    { label: '#', field: 'position' as SortField },
                    { label: 'Nome / Empresa', field: 'name' as SortField },
                    { label: 'Email', field: null },
                    { label: 'Referrals', field: 'referrals_count' as SortField },
                    { label: 'Código', field: null },
                    { label: 'Origem', field: null },
                    { label: 'Data', field: 'created_at' as SortField },
                    { label: 'Acesso', field: null },
                  ].map(col => (
                    <th
                      key={col.label}
                      className={`px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider ${col.field ? 'cursor-pointer hover:text-white/60 select-none' : ''}`}
                      onClick={() => col.field && handleSort(col.field)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.field && <SortIcon field={col.field} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-3 bg-white/5 rounded-full w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-white/30 text-sm">
                      Nenhum inscrito encontrado
                    </td>
                  </tr>
                ) : (
                  data.map(entry => (
                    <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors group">
                      {/* Posição */}
                      <td className="px-4 py-4">
                        <span className="text-white/40 font-mono text-xs">#{entry.position}</span>
                      </td>

                      {/* Nome + Empresa */}
                      <td className="px-4 py-4">
                        <p className="font-medium text-white text-sm">{entry.name}</p>
                        <p className="text-xs text-white/40 mt-0.5">{entry.company}</p>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-4">
                        <span className="text-white/60 text-xs font-mono">{entry.email}</span>
                      </td>

                      {/* Referrals */}
                      <td className="px-4 py-4">
                        {entry.referrals_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
                            <TrendingUp className="w-3 h-3" />
                            {entry.referrals_count}
                          </span>
                        ) : (
                          <span className="text-white/20 text-xs">—</span>
                        )}
                      </td>

                      {/* Código */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => copyCode(entry.referral_code)}
                          className="flex items-center gap-1.5 font-mono text-xs text-white/50 hover:text-violet-400 transition-colors"
                        >
                          {entry.referral_code}
                          {copied === entry.referral_code
                            ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                            : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          }
                        </button>
                      </td>

                      {/* Origem */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${
                          entry.source === 'referral'
                            ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                            : 'bg-white/5 text-white/30'
                        }`}>
                          {entry.source === 'referral' ? 'Indicação' : entry.source ?? 'Orgânico'}
                        </span>
                      </td>

                      {/* Data */}
                      <td className="px-4 py-4">
                        <span className="text-xs text-white/30">
                          {new Date(entry.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: 'short', year: '2-digit'
                          })}
                        </span>
                      </td>

                      {/* Ação */}
                      <td className="px-4 py-4">
                        {sent.includes(entry.email) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Enviado
                          </span>
                        ) : (
                          <button
                            onClick={() => sendAccess(entry.email)}
                            disabled={sending === entry.email}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/20 hover:border-violet-500/40 text-violet-400 text-xs font-medium transition-all disabled:opacity-50"
                          >
                            {sending === entry.email ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Mail className="w-3 h-3" />
                            )}
                            {sending === entry.email ? 'Enviando...' : 'Liberar acesso'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && data.length > 0 && (
            <div className="px-4 py-3 border-t border-white/[0.04] bg-white/[0.01]">
              <p className="text-xs text-white/30">
                {data.length} {data.length === 1 ? 'inscrito' : 'inscritos'} {search ? 'encontrados' : 'no total'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
