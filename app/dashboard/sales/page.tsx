'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, Plus, RefreshCw, Loader2, X, Send,
  Flame, Thermometer, Snowflake, CheckCircle2, XCircle,
  DollarSign, Users, MessageSquare, AlertCircle, CreditCard,
  ChevronRight, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier     = 'HOT' | 'WARM' | 'COLD'
type Status   = 'new' | 'qualified' | 'proposal' | 'won' | 'lost' | 'nurture'
type Source   = 'whatsapp' | 'instagram' | 'site' | 'manual' | 'other'
type MsgRole  = 'lead' | 'ai' | 'human'

interface Lead {
  id:         string
  name:       string
  phone:      string | null
  email:      string | null
  source:     Source
  status:     Status
  score:      number
  notes:      string | null
  created_at: string
}

interface Stats {
  total:           number
  today:           number
  new:             number
  qualified:       number
  proposal:        number
  won:             number
  lost:            number
  hot:             number
  warm:            number
  cold:            number
  conversion_rate: number
}

interface ChatMessage {
  id?:        string
  role:       MsgRole
  content:    string
  created_at?: string
}

interface Offer {
  title:     string
  value:     string
  value_raw: number
  reason:    string
  cta:       string
  urgency?:  string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<Tier, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  HOT:  { label: 'Quente', icon: <Flame size={12} />,       color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-500/30'    },
  WARM: { label: 'Morno',  icon: <Thermometer size={12} />, color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-500/30'  },
  COLD: { label: 'Frio',   icon: <Snowflake size={12} />,   color: 'text-sky-400',    bg: 'bg-sky-400/10',    border: 'border-sky-500/30'    },
}

const STATUS_LABELS: Record<Status, { label: string; color: string }> = {
  new:       { label: 'Novo',      color: 'text-zinc-400' },
  qualified: { label: 'Qualif.',   color: 'text-blue-400' },
  proposal:  { label: 'Proposta',  color: 'text-violet-400' },
  won:       { label: 'Ganhou',    color: 'text-emerald-400' },
  lost:      { label: 'Perdeu',    color: 'text-red-400' },
  nurture:   { label: 'Nutrir',    color: 'text-amber-400' },
}

const SOURCE_LABELS: Record<Source, string> = {
  whatsapp:  'WhatsApp',
  instagram: 'Instagram',
  site:      'Site',
  manual:    'Manual',
  other:     'Outro',
}

function getTier(score: number): Tier {
  if (score >= 70) return 'HOT'
  if (score >= 40) return 'WARM'
  return 'COLD'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ─── Add Lead Modal ───────────────────────────────────────────────────────────

function AddLeadModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void
  onCreated: (lead: Lead) => void
}) {
  const [name,   setName]   = useState('')
  const [phone,  setPhone]  = useState('')
  const [email,  setEmail]  = useState('')
  const [source, setSource] = useState<Source>('manual')
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/sales/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, source, notes }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao criar lead'); return }
      onCreated(json.data)
      onClose()
    } catch {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Novo Lead</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Telefone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 11 9..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Origem</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contexto, objeções, interesse..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 py-2.5 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? 'Criando...' : 'Criar Lead'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [messages,   setMessages]   = useState<ChatMessage[]>([])
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [offer,      setOffer]      = useState<Offer | null>(null)
  const [tier,       setTier]       = useState<Tier>(getTier(lead.score))
  const [convId,     setConvId]     = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [payLoading, setPayLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/sales/chat?lead_id=${lead.id}`)
        if (res.ok) {
          const json = await res.json()
          setMessages(json.messages ?? [])
          setTier(json.tier ?? getTier(lead.score))
          setConvId(json.conversation_id ?? null)
        }
      } catch { /* ok */ }
      setLoading(false)
    }
    init()
  }, [lead.id, lead.score])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    setSending(true)

    const userMsg: ChatMessage = { role: 'lead', content: msg }
    setMessages((prev) => [...prev, userMsg])

    try {
      const res = await fetch('/api/sales/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, message: msg }),
      })
      const json = await res.json()
      if (res.ok) {
        const aiMsg: ChatMessage = { role: 'ai', content: json.reply }
        setMessages((prev) => [...prev, aiMsg])
        setTier(json.tier ?? tier)
        setConvId(json.conversation_id ?? convId)
        if (json.offer) setOffer(json.offer)
      }
    } catch { /* ok */ }
    setSending(false)
  }

  async function sendPaymentLink() {
    if (!offer || payLoading) return
    setPayLoading(true)
    try {
      const res = await fetch('/api/sales/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id:     lead.id,
          title:       offer.title,
          value_raw:   String(offer.value_raw),
          description: offer.reason,
        }),
      })
      const json = await res.json()
      if (res.ok && json.url) {
        const payMsg: ChatMessage = {
          role:    'ai',
          content: `✅ Link de pagamento gerado! Enviando para ${lead.name}: ${json.url}`,
        }
        setMessages((prev) => [...prev, payMsg])
        setOffer(null)
      }
    } catch { /* ok */ }
    setPayLoading(false)
  }

  const t = TIER_CONFIG[tier]

  return (
    <motion.div
      className="fixed right-0 top-0 h-full w-full max-w-sm z-40 flex flex-col border-l border-zinc-800 bg-zinc-950"
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{lead.name}</span>
            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border', t.color, t.bg, t.border)}>
              {t.icon} {t.label}
            </span>
          </div>
          <p className="text-xs text-zinc-500">{SOURCE_LABELS[lead.source]} · Score {lead.score}/100</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-violet-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles size={24} className="text-violet-400 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">Inicie a conversa com {lead.name}</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn('flex', m.role === 'lead' ? 'justify-end' : 'justify-start')}
            >
              <div className={cn(
                'max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                m.role === 'lead'
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : 'bg-zinc-800 text-zinc-100 rounded-bl-sm',
              )}>
                {m.role === 'ai' && (
                  <p className="text-[10px] text-violet-400 font-medium mb-0.5">NEXUS IA</p>
                )}
                {m.content}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Offer Card */}
      <AnimatePresence>
        {offer && (
          <motion.div
            className="mx-4 mb-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-xs font-semibold text-violet-300">{offer.title}</p>
                <p className="text-lg font-bold text-white">{offer.value}</p>
                {offer.urgency && <p className="text-[10px] text-amber-400 mt-0.5">{offer.urgency}</p>}
              </div>
              <button onClick={() => setOffer(null)} className="text-zinc-500 hover:text-white">
                <X size={12} />
              </button>
            </div>
            <button
              onClick={sendPaymentLink}
              disabled={payLoading}
              className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 py-2 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
            >
              {payLoading ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
              {payLoading ? 'Gerando...' : offer.cta}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Digite a mensagem do lead..."
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 p-2.5 text-white transition-colors"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const [leads,       setLeads]       = useState<Lead[]>([])
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<Status | 'all'>('all')
  const [showAdd,     setShowAdd]     = useState(false)
  const [activeChat,  setActiveChat]  = useState<Lead | null>(null)
  const [toast,       setToast]       = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const fetchLeads = useCallback(async (status?: Status | 'all') => {
    setLoading(true)
    try {
      const qs = status && status !== 'all' ? `?status=${status}` : ''
      const res = await fetch(`/api/sales/leads${qs}`)
      const json = await res.json()
      if (res.ok) {
        setLeads(json.data ?? [])
        setStats(json.stats ?? null)
      }
    } catch { /* ok */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads(filter !== 'all' ? filter : undefined) }, [fetchLeads, filter])

  const kpiCards = stats ? [
    { label: 'Total de Leads',    value: stats.total,                     icon: <Users size={14} />,        color: 'text-white' },
    { label: 'Hoje',              value: stats.today,                     icon: <Plus size={14} />,         color: 'text-violet-400' },
    { label: 'Quentes 🔥',        value: stats.hot,                       icon: <Flame size={14} />,        color: 'text-red-400',     glow: 'rgba(248,113,113,0.5)' },
    { label: 'Conversão',         value: `${stats.conversion_rate}%`,     icon: <TrendingUp size={14} />,   color: 'text-emerald-400', glow: 'rgba(52,211,153,0.5)' },
    { label: 'Propostas',         value: stats.proposal,                  icon: <MessageSquare size={14} />,color: 'text-violet-400' },
    { label: 'Ganhos ✅',         value: stats.won,                       icon: <CheckCircle2 size={14} />, color: 'text-emerald-400' },
    { label: 'Perdidos',          value: stats.lost,                      icon: <XCircle size={14} />,      color: 'text-red-400' },
    { label: 'Faturamento est.',  value: `${stats.won} × ticket`,         icon: <DollarSign size={14} />,   color: 'text-zinc-400' },
  ] : []

  const PIPELINE_FILTERS: Array<{ value: Status | 'all'; label: string }> = [
    { value: 'all',       label: 'Todos' },
    { value: 'new',       label: 'Novos' },
    { value: 'qualified', label: 'Qualif.' },
    { value: 'proposal',  label: 'Proposta' },
    { value: 'won',       label: 'Ganhos' },
    { value: 'lost',      label: 'Perdidos' },
    { value: 'nurture',   label: 'Nutrir' },
  ]

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed top-4 right-4 z-50 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300 shadow-lg"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp size={22} className="text-violet-400" />
            <h1 className="text-2xl font-bold text-white">Vendas IA</h1>
          </div>
          <p className="text-zinc-500 text-sm">Pipeline automatizado com IA — HOT → Proposta → Pagamento</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLeads(filter !== 'all' ? filter : undefined)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw size={13} /> Atualizar
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            <Plus size={13} /> Novo Lead
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {kpiCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 nexus-card"
            >
              <div className="flex items-center gap-1 text-zinc-500 mb-1">
                {card.icon}
                <p className="text-[10px] leading-tight">{card.label}</p>
              </div>
              <p
                className={cn('text-lg font-bold tabular-nums', card.color)}
                style={card.glow ? { textShadow: `0 0 12px ${card.glow}` } : {}}
              >
                {card.value}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pipeline Filter */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {PIPELINE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f.value
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white',
            )}
          >
            {f.label}
            {stats && f.value !== 'all' && (
              <span className="ml-1 opacity-60">
                {stats[f.value as keyof Stats] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leads Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_80px_80px_72px_72px_40px] gap-2 items-center px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>Lead</span>
          <span className="text-center">Origem</span>
          <span className="text-center">Status</span>
          <span className="text-center">Score</span>
          <span className="text-center">Tier</span>
          <span />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-violet-400" />
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center">
            <TrendingUp size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm font-medium">Nenhum lead encontrado</p>
            <p className="text-zinc-600 text-xs mt-1">Crie seu primeiro lead para começar</p>
          </div>
        ) : (
          <AnimatePresence>
            {leads.map((lead, i) => {
              const tier = getTier(lead.score)
              const t    = TIER_CONFIG[tier]
              const s    = STATUS_LABELS[lead.status]

              return (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ delay: i * 0.02 }}
                  className={cn(
                    'grid grid-cols-[1fr_80px_80px_72px_72px_40px] gap-2 items-center px-4 py-3',
                    'border-b border-zinc-800/60 last:border-0 transition-colors',
                    tier === 'HOT'
                      ? 'bg-red-500/3 hover:bg-red-500/6'
                      : 'bg-zinc-900/20 hover:bg-zinc-800/30',
                  )}
                >
                  {/* Lead info */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{lead.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {lead.email ?? lead.phone ?? 'Sem contato'} · {fmtDate(lead.created_at)}
                    </p>
                  </div>

                  {/* Source */}
                  <p className="text-xs text-zinc-400 text-center">{SOURCE_LABELS[lead.source]}</p>

                  {/* Status */}
                  <p className={cn('text-xs text-center font-medium', s.color)}>{s.label}</p>

                  {/* Score bar */}
                  <div className="flex flex-col items-center gap-0.5">
                    <p className="text-xs font-bold text-white">{lead.score}</p>
                    <div className="w-full h-1 rounded-full bg-zinc-800">
                      <div
                        className={cn('h-1 rounded-full transition-all', tier === 'HOT' ? 'bg-red-400' : tier === 'WARM' ? 'bg-amber-400' : 'bg-sky-400')}
                        style={{ width: `${lead.score}%` }}
                      />
                    </div>
                  </div>

                  {/* Tier badge */}
                  <div className="flex justify-center">
                    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border', t.color, t.bg, t.border)}>
                      {t.icon} {t.label}
                    </span>
                  </div>

                  {/* Chat button */}
                  <button
                    onClick={() => setActiveChat(lead)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-violet-600 hover:border-violet-500 text-zinc-400 hover:text-white transition-all"
                    title="Conversar com IA"
                  >
                    <ChevronRight size={13} />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAdd && (
          <AddLeadModal
            onClose={() => setShowAdd(false)}
            onCreated={(lead) => {
              setLeads((prev) => [lead, ...prev])
              showToast(`Lead "${lead.name}" criado com sucesso!`)
            }}
          />
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {activeChat && (
          <ChatPanel lead={activeChat} onClose={() => setActiveChat(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
