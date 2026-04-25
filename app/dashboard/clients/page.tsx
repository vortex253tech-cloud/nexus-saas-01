'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Plus, Download, TrendingUp, Crown, Loader2,
  RefreshCw, Trash2, X, AlertCircle, Lock, CheckCircle2,
  ChevronDown, ChevronUp, MessageSquare, DollarSign,
  Clock, AlertTriangle, Mail, Zap,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── Types ────────────────────────────────────────────────────

type PaymentStatus = 'pending' | 'paid' | 'overdue'

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  total_revenue: number
  due_date: string | null
  status: PaymentStatus
  effective_status: PaymentStatus
  origem: string | null
  notes: string | null
  rank: number
  revenue_pct: number
  is_top20: boolean
  created_at: string
}

interface ClientsMeta {
  total: number
  totalRevenue: number
  top20Count: number
  top20Revenue: number
  top20Pct: number
}

interface CollectionMetrics {
  overdueCount: number
  overdueValue: number
  recoveredValue: number
  recoveryRate: number
  chargedCount: number
  emailChargedCount: number
}

interface TrialInfo {
  isTrialActive: boolean
  effectivePlan: string
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function statusLabel(s: PaymentStatus) {
  if (s === 'paid')    return { text: 'Pago',        color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-500/30' }
  if (s === 'overdue') return { text: 'Vencido',     color: 'text-red-400',     bg: 'bg-red-400/10 border-red-500/30' }
  return                      { text: 'Pendente',    color: 'text-zinc-400',    bg: 'bg-zinc-800 border-zinc-700' }
}

function clientRisk(client: Client): 'high' | 'medium' | 'low' {
  let score = 0
  const daysOverdue = client.due_date
    ? Math.max(0, Math.floor((Date.now() - new Date(client.due_date).getTime()) / 86_400_000))
    : 0
  if (client.effective_status === 'overdue') score += 40
  else if (client.effective_status === 'pending') score += 15
  if (daysOverdue >= 30) score += 30
  else if (daysOverdue >= 14) score += 20
  else if (daysOverdue >= 7) score += 10
  else if (daysOverdue >= 1) score += 5
  if (client.total_revenue >= 50_000) score += 20
  else if (client.total_revenue >= 10_000) score += 10
  const daysSinceCreation = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 86_400_000)
  if (daysSinceCreation < 30 && client.effective_status !== 'paid') score += 5
  return score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'
}

function riskBadgeStyle(risk: 'high' | 'medium' | 'low') {
  if (risk === 'high')   return { label: '⚠ Alto risco',  color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/30' }
  if (risk === 'medium') return { label: '~ Médio risco', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' }
  return null
}

// ─── Plan Gate ─────────────────────────────────────────────────

function PlanGate({ children, allowed, feature = 'Disponível no plano Pro' }: {
  children: React.ReactNode
  allowed: boolean
  feature?: string
}) {
  if (allowed) return <>{children}</>
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 backdrop-blur-[2px] rounded-xl">
        <div className="flex items-center gap-2 rounded-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm text-zinc-300">
          <Lock size={14} className="text-violet-400" />
          <span>{feature}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Add Client Modal ──────────────────────────────────────────

function AddClientModal({ companyId, onAdded, onClose }: {
  companyId: string
  onAdded: () => void
  onClose: () => void
}) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [revenue, setRevenue] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [origem, setOrigem]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id:    companyId,
          name:          name.trim(),
          email:         email.trim() || null,
          phone:         phone.trim() || null,
          total_revenue: parseFloat(revenue) || 0,
          due_date:      dueDate || null,
          origem:        origem.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? 'Erro ao salvar')
        return
      }
      onAdded(); onClose()
    } catch { setError('Erro de rede') } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Adicionar Cliente</h2>
          <button onClick={onClose} className="rounded-full p-1 text-zinc-500 hover:text-white hover:bg-zinc-800">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Nome *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Nome do cliente ou empresa"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                placeholder="email@empresa.com"
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Telefone (WhatsApp)</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+55 11 9xxxx-xxxx"
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Valor devido (R$)</label>
              <input value={revenue} onChange={e => setRevenue(e.target.value)}
                type="number" min="0" step="0.01" placeholder="0.00"
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Vencimento</label>
              <input value={dueDate} onChange={e => setDueDate(e.target.value)}
                type="date"
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Origem do cliente</label>
            <select value={origem} onChange={e => setOrigem(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
              <option value="">Selecionar...</option>
              <option value="Indicação">Indicação</option>
              <option value="Google Ads">Google Ads</option>
              <option value="Instagram">Instagram</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Site">Site</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Prospecção">Prospecção ativa</option>
              <option value="Parceiro">Parceiro</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={12} />{error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function ClientsPage() {
  const [companyId, setCompanyId]       = useState<string | null>(null)
  const [clients, setClients]           = useState<Client[]>([])
  const [meta, setMeta]                 = useState<ClientsMeta | null>(null)
  const [metrics, setMetrics]           = useState<CollectionMetrics | null>(null)
  const [loading, setLoading]           = useState(true)
  const [showAdd, setShowAdd]           = useState(false)
  const [exporting, setExporting]       = useState(false)
  const [chargingAllEmail, setChargingAllEmail] = useState(false)
  const [chargingEmail, setChargingEmail]     = useState<Set<string>>(new Set())
  const [markingPaid, setMarkingPaid]   = useState<Set<string>>(new Set())
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [toast, setToast]               = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [trial, setTrial]               = useState<TrialInfo>({ isTrialActive: false, effectivePlan: 'free' })
  const [recovering, setRecovering]     = useState(false)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Init
  useEffect(() => {
    void resolveCompanyId().then(cid => { if (cid) setCompanyId(cid) })
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then((d: unknown) => {
        if (!d || typeof d !== 'object') return
        const data = d as { isTrialActive?: boolean; user?: { effectivePlan?: string } }
        setTrial({
          isTrialActive: data.isTrialActive ?? false,
          effectivePlan: data.user?.effectivePlan ?? 'free',
        })
      })
      .catch(() => { /* ok */ })
  }, [])

  const canExport = trial.isTrialActive || trial.effectivePlan === 'pro' || trial.effectivePlan === 'enterprise'

  const fetchMetrics = useCallback(async (cid: string) => {
    const res = await fetch(`/api/collections/metrics?company_id=${cid}`)
    if (res.ok) {
      const m = await res.json() as CollectionMetrics
      setMetrics(m)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/clients?company_id=${companyId}`)
      if (res.ok) {
        const json = await res.json() as { data?: Client[]; meta?: ClientsMeta }
        setClients(json.data ?? [])
        setMeta(json.meta ?? null)
      }
      await fetchMetrics(companyId)
    } catch { /* ok */ } finally { setLoading(false) }
  }, [companyId, fetchMetrics])

  useEffect(() => {
    if (companyId) void fetchClients()
  }, [companyId, fetchClients])

  // ─── Actions ────────────────────────────────────────────────

  async function handleDelete(id: string) {
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setClients(prev => prev.filter(c => c.id !== id))
  }

  async function handleMarkPaid(client: Client) {
    setMarkingPaid(prev => new Set(prev).add(client.id))
    try {
      await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })
      showToast(`${client.name} marcado como pago!`)
      await fetchClients()
    } catch { showToast('Erro ao marcar como pago', 'err') }
    finally { setMarkingPaid(prev => { const s = new Set(prev); s.delete(client.id); return s }) }
  }

  async function handleChargeEmail(client: Client) {
    if (!client.email) {
      showToast('Cliente sem email cadastrado', 'err')
      return
    }
    setChargingEmail(prev => new Set(prev).add(client.id))
    try {
      const res = await fetch('/api/collections/charge-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: client.id }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (json.success) {
        showToast(`Email enviado para ${client.name}!`)
        await fetchClients()
      } else {
        showToast(json.error ?? `Falha ao enviar email para ${client.name}`, 'err')
      }
    } catch { showToast('Erro de rede', 'err') }
    finally { setChargingEmail(prev => { const s = new Set(prev); s.delete(client.id); return s }) }
  }

  async function handleRecover() {
    setRecovering(true)
    try {
      const res  = await fetch('/api/recover', { method: 'POST' })
      const json = await res.json() as { summary?: string; engine?: { actionsGenerated: number } }
      showToast(json.summary ?? `${json.engine?.actionsGenerated ?? 0} ações geradas`)
      await fetchClients()
    } catch { showToast('Erro ao recuperar', 'err') }
    finally { setRecovering(false) }
  }

  async function handleChargeAllEmail() {
    setChargingAllEmail(true)
    try {
      const res  = await fetch('/api/collections/run-email', { method: 'POST' })
      const json = await res.json() as { charged?: number; failed?: number }
      showToast(
        `${json.charged ?? 0} email${(json.charged ?? 0) !== 1 ? 's' : ''} enviado${(json.charged ?? 0) !== 1 ? 's' : ''}, ` +
        `${json.failed ?? 0} falha${(json.failed ?? 0) !== 1 ? 's' : ''}`,
      )
      await fetchClients()
    } catch { showToast('Erro ao enviar emails', 'err') }
    finally { setChargingAllEmail(false) }
  }

  async function handleExport() {
    if (!companyId || !canExport) return
    setExporting(true)
    try {
      const res = await fetch(`/api/reports/clients?company_id=${companyId}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ok */ } finally { setExporting(false) }
  }

  const overdueClients = clients.filter(c => c.effective_status === 'overdue')

  if (!companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-zinc-500 text-sm">Sessão não encontrada.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={cn(
              'fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl',
              toast.type === 'ok'
                ? 'border-emerald-500/40 bg-emerald-950 text-emerald-300'
                : 'border-red-500/40 bg-red-950 text-red-300'
            )}
          >
            {toast.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Users size={22} className="text-violet-400" />
            <h1 className="text-2xl font-bold text-white">Clientes</h1>
          </div>
          <p className="text-zinc-500 text-sm">Gerencie clientes, rastreie vencimentos e envie cobranças via WhatsApp e Email.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => void handleRecover()}
            disabled={recovering}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-bold text-white hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 transition-all shadow-lg shadow-violet-900/40"
          >
            {recovering ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {recovering ? 'Recuperando...' : '💰 Recuperar agora'}
          </button>
          {overdueClients.some(c => c.email) && (
            <button
              onClick={() => void handleChargeAllEmail()}
              disabled={chargingAllEmail}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {chargingAllEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {chargingAllEmail ? 'Enviando...' : `Email todos (${overdueClients.filter(c => c.email).length})`}
            </button>
          )}
          <button onClick={() => void fetchClients()}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:text-white transition-colors">
            <RefreshCw size={12} /> Atualizar
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </div>

      {/* Pareto summary cards */}
      {meta && (
        <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total de Clientes',  value: meta.total,                    color: 'text-white' },
            { label: 'Faturamento Total',  value: fmtBRL(meta.totalRevenue),      color: 'text-violet-400' },
            { label: `Top ${meta.top20Count} Clientes`, value: fmtBRL(meta.top20Revenue), color: 'text-emerald-400' },
            { label: 'Concentração 80/20', value: `${meta.top20Pct}% da receita`, color: 'text-amber-400' },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
              <p className={cn('text-lg font-bold', card.color)}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recovery metrics */}
      {metrics && (
        <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500">Inadimplentes</p>
              <p className="text-lg font-bold text-red-400">{metrics.overdueCount} clientes</p>
              <p className="text-xs text-zinc-600 mt-0.5">{fmtBRL(metrics.overdueValue)} em aberto</p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
            <MessageSquare size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500">Cobrados (WhatsApp)</p>
              <p className="text-lg font-bold text-amber-400">{metrics.chargedCount - metrics.emailChargedCount}</p>
              <p className="text-xs text-zinc-600 mt-0.5">mensagens enviadas</p>
            </div>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 flex items-start gap-3">
            <Mail size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500">Cobrados por Email</p>
              <p className="text-lg font-bold text-blue-400">{metrics.emailChargedCount}</p>
              <p className="text-xs text-zinc-600 mt-0.5">emails enviados</p>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-start gap-3">
            <DollarSign size={18} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500">Recuperado</p>
              <p className="text-lg font-bold text-emerald-400">{fmtBRL(metrics.recoveredValue)}</p>
              <p className="text-xs text-zinc-600 mt-0.5">taxa: {metrics.recoveryRate}%</p>
            </div>
          </div>
        </div>
      )}

      {/* 80/20 Analysis */}
      {meta && meta.total > 0 && (
        <motion.div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-amber-500/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <TrendingUp size={18} className="text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Análise Pareto 80/20</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Top {meta.top20Count} ({Math.round((meta.top20Count / meta.total) * 100)}% da base) = {fmtBRL(meta.top20Revenue)} ({meta.top20Pct}% da receita)
                </p>
              </div>
            </div>
            {showAnalysis ? <ChevronUp size={16} className="text-amber-400" /> : <ChevronDown size={16} className="text-amber-400" />}
          </button>
          {showAnalysis && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-5 pb-4">
              <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  <strong className="text-amber-300">Princípio de Pareto:</strong> seus {meta.top20Count} clientes mais valiosos representam {meta.top20Pct}% do faturamento.
                  Foque retenção e upsell neste grupo.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                    <Crown size={10} /> Top 20%
                  </span>
                  <span className="text-xs text-zinc-500">→ Agendar reunião trimestral</span>
                  <span className="text-xs text-zinc-500">→ Programa de fidelidade</span>
                  <span className="text-xs text-zinc-500">→ Ofertas exclusivas</span>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Export */}
      <div className="mb-4 flex justify-end">
        <PlanGate allowed={canExport} feature="Exportar CSV — Disponível no plano Pro">
          <button
            onClick={() => void handleExport()}
            disabled={exporting || !canExport}
            className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-colors"
          >
            <Download size={14} />
            {exporting ? 'Gerando...' : 'Exportar CSV'}
          </button>
        </PlanGate>
      </div>

      {/* Client list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
          <Users size={40} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500 text-sm">Nenhum cliente cadastrado ainda.</p>
          <button onClick={() => setShowAdd(true)}
            className="mt-4 flex items-center gap-2 mx-auto rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
            <Plus size={14} /> Adicionar primeiro cliente
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[36px_1fr_88px_110px_70px_160px_36px] gap-2 items-center px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <span>#</span>
            <span>Cliente</span>
            <span className="text-center">Vencto</span>
            <span className="text-center">Status</span>
            <span className="text-right">Valor</span>
            <span className="text-center">Ações</span>
            <span />
          </div>

          <AnimatePresence>
            {clients.map((client, i) => {
              const st            = statusLabel(client.effective_status)
              const isMarkingPaid = markingPaid.has(client.id)
              const waLink        = client.phone
                ? `https://wa.me/${client.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Olá ${client.name}, tudo bem?\n\nIdentificamos um pagamento pendente de ${fmtBRL(client.total_revenue)}${client.due_date ? ` com vencimento em ${fmtDate(client.due_date)}` : ''}.\n\nPode verificar para mim?`)}`
                : ''

              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    'grid grid-cols-[36px_1fr_88px_110px_70px_160px_36px] gap-2 items-center px-4 py-3.5',
                    'border-b border-zinc-800/60 last:border-0',
                    client.effective_status === 'overdue'
                      ? 'bg-red-500/3 hover:bg-red-500/6'
                      : client.is_top20
                        ? 'bg-amber-500/3 hover:bg-amber-500/6'
                        : 'bg-zinc-900/30 hover:bg-zinc-800/40',
                    'transition-colors',
                  )}
                >
                  {/* Rank */}
                  <span className={cn(
                    'text-sm font-bold',
                    client.rank === 1 ? 'text-amber-400' :
                    client.rank === 2 ? 'text-zinc-300' :
                    client.rank === 3 ? 'text-orange-400' : 'text-zinc-600',
                  )}>
                    {client.rank}
                  </span>

                  {/* Name */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white truncate">{client.name}</p>
                      {client.is_top20 && (
                        <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          <Crown size={8} /> Top
                        </span>
                      )}
                      {(() => {
                        const rb = riskBadgeStyle(clientRisk(client))
                        if (!rb) return null
                        return (
                          <span className={cn('shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold', rb.color, rb.bg)}>
                            {rb.label}
                          </span>
                        )
                      })()}
                    </div>
                    {client.origem && (
                      <p className="text-[10px] text-zinc-600 mt-0.5 truncate">via {client.origem}</p>
                    )}
                  </div>

                  {/* Due date */}
                  <div className="text-center">
                    {client.due_date ? (
                      <span className={cn(
                        'flex items-center justify-center gap-1 text-[11px]',
                        client.effective_status === 'overdue' ? 'text-red-400' : 'text-zinc-500'
                      )}>
                        <Clock size={9} />
                        {fmtDate(client.due_date)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-700">—</span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="flex justify-center">
                    <span className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold',
                      st.color, st.bg,
                    )}>
                      {st.text}
                    </span>
                  </div>

                  {/* Revenue */}
                  <span className="text-sm font-semibold text-white text-right">
                    {fmtBRL(client.total_revenue)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center justify-center gap-1">
                    {client.effective_status === 'overdue' && (
                      <>
                        <a
                          href={waLink || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={client.phone ? 'Abrir WhatsApp' : 'Sem telefone cadastrado'}
                          className={cn(
                            'flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors whitespace-nowrap',
                            !client.phone && 'opacity-30 pointer-events-none',
                          )}
                        >
                          <MessageSquare size={9} />
                          WA
                        </a>
                        <button
                          onClick={() => void handleChargeEmail(client)}
                          disabled={chargingEmail.has(client.id) || !client.email}
                          title={client.email ? 'Cobrar via Email' : 'Cliente sem email cadastrado'}
                          className="flex items-center gap-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[10px] font-semibold text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 transition-colors whitespace-nowrap"
                        >
                          {chargingEmail.has(client.id) ? <Loader2 size={9} className="animate-spin" /> : <Mail size={9} />}
                          Email
                        </button>
                        <button
                          onClick={() => void handleMarkPaid(client)}
                          disabled={isMarkingPaid}
                          title="Marcar como pago"
                          className="flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {isMarkingPaid ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle2 size={9} />}
                          Pago
                        </button>
                      </>
                    )}
                    {client.effective_status === 'paid' && (
                      <span className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-emerald-500">
                        <CheckCircle2 size={9} /> Quitado
                      </span>
                    )}
                    {client.effective_status === 'pending' && client.due_date && (
                      <span className="text-[10px] text-zinc-600">Aguardando</span>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => void handleDelete(client.id)}
                    className="flex items-center justify-center rounded-lg p-1.5 text-zinc-700 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Next actions checklist */}
      {clients.length > 0 && meta && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={16} className="text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Próximas ações recomendadas</h3>
          </div>
          <div className="space-y-2">
            {[
              { label: `Top ${meta.top20Count} clientes identificados`, done: true },
              { label: 'Cadastrar data de vencimento nos clientes',         done: clients.some(c => c.due_date !== null) },
              { label: 'Cobrar clientes inadimplentes via WhatsApp',        done: (metrics?.chargedCount ?? 0) - (metrics?.emailChargedCount ?? 0) > 0 },
              { label: 'Cobrar clientes inadimplentes via Email',           done: (metrics?.emailChargedCount ?? 0) > 0 },
              { label: 'Exportar relatório para o time comercial',          done: false },
              { label: 'Criar proposta de upsell para top 20%',            done: false },
            ].map((item, idx) => (
              <div key={idx} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5', item.done ? 'opacity-60' : 'opacity-100')}>
                <div className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0',
                  item.done ? 'border-emerald-500 bg-emerald-500/20' : 'border-zinc-600')}>
                  {item.done && <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                </div>
                <span className={cn('text-sm', item.done ? 'line-through text-zinc-600' : 'text-zinc-300')}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && companyId && (
        <AddClientModal companyId={companyId} onAdded={fetchClients} onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}
