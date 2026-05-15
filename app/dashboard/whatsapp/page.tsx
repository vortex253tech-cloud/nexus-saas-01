'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Bot, Zap, Activity, TrendingUp,
  Users, Phone, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, Wifi, WifiOff, Clock, DollarSign,
  BarChart3, ArrowUp, ArrowDown, Circle, Send,
  ChevronRight, MessageCircle, Sparkles, Shield,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ── Types ─────────────────────────────────────────────────────

interface Conversation {
  id:              string
  phone:           string
  contact_name:    string | null
  status:          'active' | 'closed' | 'blocked'
  last_message_at: string | null
  message_count:   number
  ai_enabled:      boolean
  created_at:      string
}

interface Message {
  id:           string
  direction:    'incoming' | 'outgoing'
  content:      string
  from_me:      boolean
  ai_generated: boolean
  status:       string
  created_at:   string
}

interface Analytics {
  date:              string
  messages_in:       number
  messages_out:      number
  new_conversations: number
  tokens_used:       number
  errors:            number
  avg_response_ms:   number | null
}

interface WaStatus {
  connected:  boolean
  phone:      string | null
  error:      string | null
  webhookUrl: string | null
  instanceId: string | null
}

// ── Helpers ───────────────────────────────────────────────────

function formatPhone(phone: string): string {
  if (phone.length === 13) {
    return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`
  }
  return phone
}

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return '—'
  const diff = Date.now() - new Date(isoDate).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 1)   return 'agora'
  if (m < 60)  return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function totalMetric(analytics: Analytics[], key: keyof Analytics): number {
  return analytics.reduce((sum, row) => sum + ((row[key] as number) || 0), 0)
}

function avgMetric(analytics: Analytics[], key: keyof Analytics): number {
  const vals = analytics.map(r => r[key] as number | null).filter(v => v != null) as number[]
  if (!vals.length) return 0
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

// ── Stat Card ─────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, sub, color = 'blue', loading,
}: {
  label:   string
  value:   string | number
  icon:    React.ElementType
  sub?:    string
  color?:  'blue' | 'green' | 'purple' | 'amber' | 'red'
  loading?: boolean
}) {
  const colors = {
    blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    amber:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red:    'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400 font-medium">{label}</span>
        <div className={cn('p-2 rounded-lg border', colors[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-zinc-800 rounded animate-pulse" />
      ) : (
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
          {sub && <span className="text-xs text-zinc-500 mb-1">{sub}</span>}
        </div>
      )}
    </motion.div>
  )
}

// ── Status Badge ──────────────────────────────────────────────

function StatusBadge({ connected, loading }: { connected: boolean; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center gap-2 text-zinc-500 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Verificando...</span>
    </div>
  )

  return (
    <div className={cn(
      'flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border',
      connected
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        : 'bg-red-500/10 text-red-400 border-red-500/30'
    )}>
      {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      {connected ? 'Conectado' : 'Desconectado'}
    </div>
  )
}

// ── Message Bubble ────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outgoing'
  return (
    <div className={cn('flex gap-2', isOut ? 'flex-row-reverse' : 'flex-row')}>
      {!isOut && (
        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-1">
          <Phone className="w-4 h-4 text-zinc-400" />
        </div>
      )}
      {isOut && (
        <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-4 h-4 text-blue-400" />
        </div>
      )}
      <div className={cn('max-w-[75%] space-y-1', isOut ? 'items-end' : 'items-start', 'flex flex-col')}>
        <div className={cn(
          'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
          isOut
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-tl-sm'
        )}>
          {msg.content}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          {isOut && msg.ai_generated && (
            <span className="flex items-center gap-1 text-blue-500/70">
              <Sparkles className="w-3 h-3" />
              IA
            </span>
          )}
          <span>{formatTime(msg.created_at)}</span>
          {isOut && (
            <CheckCircle2 className={cn('w-3 h-3', msg.status === 'read' ? 'text-blue-400' : 'text-zinc-600')} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export default function WhatsAppPage() {
  const [conversations, setConversations]         = useState<Conversation[]>([])
  const [messages, setMessages]                   = useState<Message[]>([])
  const [analytics, setAnalytics]                 = useState<Analytics[]>([])
  const [status, setStatus]                       = useState<WaStatus | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)

  const [loadingConvs, setLoadingConvs]           = useState(true)
  const [loadingMsgs, setLoadingMsgs]             = useState(false)
  const [loadingAnalytics, setLoadingAnalytics]   = useState(true)
  const [loadingStatus, setLoadingStatus]         = useState(true)
  const [refreshing, setRefreshing]               = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Fetchers ─────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const res = await fetch('/api/whatsapp/status')
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ connected: false, phone: null, error: 'Erro ao conectar', webhookUrl: null, instanceId: null })
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true)
    try {
      const res = await fetch('/api/whatsapp/conversations')
      const { conversations: data } = await res.json()
      setConversations(data ?? [])
    } catch { /* ignore */ } finally {
      setLoadingConvs(false)
    }
  }, [])

  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoadingMsgs(true)
    try {
      const res = await fetch(`/api/whatsapp/messages?conversationId=${conversationId}`)
      const { messages: data } = await res.json()
      setMessages(data ?? [])
    } catch { /* ignore */ } finally {
      setLoadingMsgs(false)
    }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true)
    try {
      const res = await fetch('/api/whatsapp/analytics?days=7')
      const { analytics: data } = await res.json()
      setAnalytics(data ?? [])
    } catch { /* ignore */ } finally {
      setLoadingAnalytics(false)
    }
  }, [])

  // ── Init + polling ────────────────────────────────────────────

  useEffect(() => {
    fetchStatus()
    fetchConversations()
    fetchAnalytics()

    // Poll conversations every 30s
    const interval = setInterval(() => {
      fetchConversations()
      fetchStatus()
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchConversations, fetchAnalytics])

  // Poll messages every 10s when a convo is open
  useEffect(() => {
    if (!selectedConversation) return
    const interval = setInterval(() => {
      fetchMessages(selectedConversation.id)
    }, 10_000)
    return () => clearInterval(interval)
  }, [selectedConversation, fetchMessages])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv)
    fetchMessages(conv.id)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchConversations(), fetchAnalytics(), fetchStatus()])
    setRefreshing(false)
  }

  // ── Computed metrics ──────────────────────────────────────────

  const totalIn       = totalMetric(analytics, 'messages_in')
  const totalOut      = totalMetric(analytics, 'messages_out')
  const totalNew      = totalMetric(analytics, 'new_conversations')
  const totalTokens   = totalMetric(analytics, 'tokens_used')
  const avgLatency    = avgMetric(analytics, 'avg_response_ms')
  const estimatedCost = ((totalTokens / 1_000_000) * 0.25).toFixed(4)

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-6 p-6 bg-zinc-950 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">WhatsApp AI</h1>
            <p className="text-sm text-zinc-500">Atendimento automatizado com IA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge connected={status?.connected ?? false} loading={loadingStatus} />
          {status?.phone && (
            <span className="text-sm text-zinc-400 hidden sm:block">
              {formatPhone(status.phone)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white transition-all"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Mensagens recebidas"
          value={loadingAnalytics ? '—' : totalIn.toLocaleString()}
          icon={ArrowDown}
          sub="7 dias"
          color="blue"
          loading={loadingAnalytics}
        />
        <StatCard
          label="Respostas enviadas"
          value={loadingAnalytics ? '—' : totalOut.toLocaleString()}
          icon={ArrowUp}
          sub="7 dias"
          color="green"
          loading={loadingAnalytics}
        />
        <StatCard
          label="Novas conversas"
          value={loadingAnalytics ? '—' : totalNew.toLocaleString()}
          icon={Users}
          sub="7 dias"
          color="purple"
          loading={loadingAnalytics}
        />
        <StatCard
          label="Latência média"
          value={loadingAnalytics ? '—' : avgLatency > 0 ? `${(avgLatency / 1000).toFixed(1)}s` : '—'}
          icon={Clock}
          sub="resposta IA"
          color="amber"
          loading={loadingAnalytics}
        />
        <StatCard
          label="Tokens usados"
          value={loadingAnalytics ? '—' : totalTokens.toLocaleString()}
          icon={Zap}
          sub="Haiku"
          color="purple"
          loading={loadingAnalytics}
        />
        <StatCard
          label="Custo estimado"
          value={loadingAnalytics ? '—' : `$${estimatedCost}`}
          icon={DollarSign}
          sub="USD"
          color="green"
          loading={loadingAnalytics}
        />
      </div>

      {/* Webhook URL hint */}
      {status?.webhookUrl && (
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <Shield className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <span className="text-xs text-zinc-500">Webhook URL:</span>
          <code className="text-xs text-zinc-300 font-mono flex-1 truncate">{status.webhookUrl}</code>
          <button
            onClick={() => navigator.clipboard.writeText(status.webhookUrl!)}
            className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0"
          >
            Copiar
          </button>
        </div>
      )}

      {/* Main split view */}
      <div className="flex-1 flex gap-4 min-h-0" style={{ minHeight: '520px' }}>

        {/* Conversations list */}
        <div className="w-80 flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-semibold text-white">Conversas</span>
            </div>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
              {conversations.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-zinc-800 animate-pulse" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                <MessageSquare className="w-8 h-8 text-zinc-700" />
                <p className="text-sm text-zinc-600">Nenhuma conversa ainda</p>
                <p className="text-xs text-zinc-700">Configure o webhook no Z-API para começar</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      'w-full px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/50 transition-colors text-left border-b border-zinc-800/50 last:border-0',
                      selectedConversation?.id === conv.id && 'bg-zinc-800'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                      conv.ai_enabled ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400' : 'bg-zinc-700 text-zinc-400'
                    )}>
                      {conv.contact_name
                        ? conv.contact_name.slice(0, 2).toUpperCase()
                        : conv.phone.slice(-2)
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium text-white truncate">
                          {conv.contact_name ?? formatPhone(conv.phone)}
                        </span>
                        <span className="text-xs text-zinc-600 flex-shrink-0">
                          {timeAgo(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {conv.ai_enabled && (
                          <Bot className="w-3 h-3 text-blue-400" />
                        )}
                        <span className="text-xs text-zinc-500">
                          {conv.message_count} mensagens
                        </span>
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full ml-auto',
                          conv.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-600'
                        )} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat view */}
        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Chat header */}
              <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-400">
                    {selectedConversation.contact_name
                      ? selectedConversation.contact_name.slice(0, 2).toUpperCase()
                      : selectedConversation.phone.slice(-2)
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {selectedConversation.contact_name ?? formatPhone(selectedConversation.phone)}
                    </p>
                    <p className="text-xs text-zinc-500">{formatPhone(selectedConversation.phone)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedConversation.ai_enabled && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      IA ativa
                    </div>
                  )}
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    selectedConversation.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-600'
                  )} />
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-zinc-600">Nenhuma mensagem</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area (read-only note) */}
              <div className="px-5 py-3 border-t border-zinc-800">
                <div className="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-2.5">
                  <Bot className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-zinc-500 flex-1">
                    Respostas automáticas ativas via IA
                  </span>
                  <Sparkles className="w-4 h-4 text-blue-400/50" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-zinc-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-400">Selecione uma conversa</p>
                <p className="text-xs text-zinc-600 mt-1">O histórico aparecerá aqui</p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: activity feed */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-4">

          {/* Analytics mini-chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-semibold text-white">Últimos 7 dias</span>
              </div>
            </div>

            {loadingAnalytics ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-6 rounded bg-zinc-800 animate-pulse" />
                ))}
              </div>
            ) : analytics.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-xs text-zinc-600">Sem dados ainda</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {analytics.slice(-7).map((row) => {
                  const maxVal = Math.max(...analytics.map(r => r.messages_in + r.messages_out), 1)
                  const total  = row.messages_in + row.messages_out
                  const pct    = (total / maxVal) * 100

                  return (
                    <div key={row.date} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600 w-12 flex-shrink-0">
                        {new Date(row.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-600/70 rounded transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-6 text-right flex-shrink-0">
                        {total}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Metrics breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-semibold text-white">Resumo</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <MetricRow
                label="Taxa de resposta"
                value={totalIn > 0 ? `${Math.round((totalOut / totalIn) * 100)}%` : '—'}
                color="emerald"
              />
              <MetricRow
                label="Conversas ativas"
                value={conversations.filter(c => c.status === 'active').length}
                color="blue"
              />
              <MetricRow
                label="Erros (7d)"
                value={totalMetric(analytics, 'errors')}
                color={totalMetric(analytics, 'errors') > 0 ? 'red' : 'zinc'}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Metric Row ─────────────────────────────────────────────────

function MetricRow({
  label, value, color = 'zinc',
}: {
  label:  string
  value:  string | number
  color?: 'emerald' | 'blue' | 'red' | 'zinc'
}) {
  const dot = {
    emerald: 'bg-emerald-500',
    blue:    'bg-blue-500',
    red:     'bg-red-500',
    zinc:    'bg-zinc-600',
  }
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={cn('w-1.5 h-1.5 rounded-full', dot[color])} />
        <span className="text-xs text-zinc-400">{label}</span>
      </div>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  )
}
