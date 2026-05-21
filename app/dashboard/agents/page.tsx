'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Crown, TrendingUp, Megaphone, DollarSign,
  FolderKanban, Headphones, PenLine, BarChart3,
  Zap, Activity, RefreshCw, Send, ChevronRight,
} from 'lucide-react'
import type { StatusResponse, AgentStatus } from '@/app/api/agents/status/route'
import type { AgentId } from '@/lib/agents'

// ─── Icon map (keyed by icon name from agent meta) ────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  Crown, TrendingUp, Megaphone, DollarSign,
  FolderKanban, Headphones, PenLine, BarChart3,
}

// Map agentId → icon name (matches AGENTS meta in lib/agents/index.ts)
const AGENT_ICON_NAMES: Record<string, string> = {
  ceo:       'Crown',
  sales:     'TrendingUp',
  marketing: 'Megaphone',
  finance:   'DollarSign',
  projects:  'FolderKanban',
  support:   'Headphones',
  content:   'PenLine',
  analytics: 'BarChart3',
}

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, onAsk }: { agent: AgentStatus; onAsk: (id: AgentId) => void }) {
  const Icon = ICONS[agent.icon] ?? Zap

  return (
    <div
      style={{ background: agent.bg, border: `1px solid ${agent.border}` }}
      className="rounded-xl p-5 flex flex-col gap-4 transition-all hover:scale-[1.01] cursor-default"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            style={{ background: agent.bg, border: `1.5px solid ${agent.border}` }}
            className="w-10 h-10 rounded-lg flex items-center justify-center"
          >
            <Icon style={{ color: agent.hex }} className="w-5 h-5" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">{agent.name}</p>
            <p className="text-white/50 text-xs">{agent.role}</p>
          </div>
        </div>
        <span
          style={{ background: agent.isActive ? `${agent.hex}22` : 'rgba(255,255,255,0.05)', color: agent.isActive ? agent.hex : 'rgba(255,255,255,0.3)', border: `1px solid ${agent.isActive ? `${agent.hex}44` : 'rgba(255,255,255,0.1)'}` }}
          className="text-xs px-2 py-0.5 rounded-full font-medium"
        >
          {agent.isActive ? 'Ativo' : 'Standby'}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div>
          <p style={{ color: agent.hex }} className="text-2xl font-bold leading-none">{agent.actionsToday}</p>
          <p className="text-white/40 text-xs mt-1">ações hoje</p>
        </div>
        <div className="flex-1">
          {agent.lastAction && (
            <>
              <p className="text-white/60 text-xs truncate">
                <span className="font-mono" style={{ color: agent.hex }}>{agent.lastAction}</span>
              </p>
              <p className="text-white/30 text-xs">{agent.lastAt ? relativeTime(agent.lastAt) : ''}</p>
            </>
          )}
          {!agent.lastAction && <p className="text-white/20 text-xs">Nenhuma ação registrada</p>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          style={{ width: `${Math.min(agent.actionsToday * 10, 100)}%`, background: agent.hex }}
          className="h-full rounded-full transition-all duration-700"
        />
      </div>

      {/* Ask button */}
      <button
        onClick={() => onAsk(agent.id as AgentId)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
        style={{ background: `${agent.hex}18`, color: agent.hex, border: `1px solid ${agent.hex}33` }}
      >
        <Send className="w-3.5 h-3.5" />
        Falar com {agent.name.split(' ')[0]}
        <ChevronRight className="w-3.5 h-3.5 ml-auto" />
      </button>
    </div>
  )
}

// ─── Activity Feed Item ───────────────────────────────────────────────────────

function FeedItem({ ev }: { ev: StatusResponse['recentEvents'][0] }) {
  const iconName = AGENT_ICON_NAMES[ev.agentId] ?? 'Zap'
  const Icon = ICONS[iconName] as React.ElementType | undefined

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div
        style={{ background: `${ev.hex}18`, border: `1px solid ${ev.hex}33` }}
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
      >
        {Icon ? <Icon style={{ color: ev.hex }} className="w-3.5 h-3.5" /> : <Zap style={{ color: ev.hex }} className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span style={{ color: ev.hex }} className="text-xs font-semibold">{ev.agentName}</span>
          <span className="text-white/30 text-xs font-mono">{ev.action}</span>
        </div>
        <p className="text-white/50 text-xs leading-relaxed line-clamp-2">{ev.summary}</p>
      </div>
      <span className="text-white/25 text-xs flex-shrink-0">{relativeTime(ev.at)}</span>
    </div>
  )
}

// ─── Command Bar (quick-send to orchestrator) ─────────────────────────────────

function CommandBar({ defaultAgent }: { defaultAgent: AgentId | null }) {
  const router = useRouter()
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState<string | null>(null)

  const send = async () => {
    if (!msg.trim() || loading) return
    setLoading(true)
    setReply(null)
    try {
      const res = await fetch('/api/agents/orchestrate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setReply(data.message ?? data.error ?? 'Erro desconhecido')
      if (data.navigateTo) {
        setTimeout(() => router.push(data.navigateTo), 1500)
      }
    } catch (err) {
      setReply(String(err))
    } finally {
      setLoading(false)
      setMsg('')
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Comando Rápido</p>
      <div className="flex gap-2">
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={defaultAgent ? `Falar com ${defaultAgent} agent...` : 'Fale com qualquer agente...'}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/50"
        />
        <button
          onClick={send}
          disabled={loading || !msg.trim()}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {reply && (
        <div className="bg-white/[0.04] border border-white/8 rounded-lg p-3">
          <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{reply}</p>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const router = useRouter()
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/status')
      if (res.ok) setData(await res.json())
    } catch {
      // swallow
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, 15000) // poll every 15s
    return () => clearInterval(t)
  }, [fetchStatus])

  const handleAsk = (id: AgentId) => {
    setSelectedAgent(id)
    // Scroll to command bar
    document.getElementById('cmd-bar')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agentes NEXUS</h1>
          <p className="text-white/40 text-sm mt-1">
            {data ? `${data.agents.filter(a => a.isActive).length} ativos · ${data.totalToday} ações hoje` : 'Carregando...'}
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 text-white/50 text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Summary bar */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Agentes Ativos', value: data.agents.filter(a => a.isActive).length, icon: Activity, color: '#7c3aed' },
            { label: 'Ações Hoje', value: data.totalToday, icon: Zap, color: '#059669' },
            { label: 'Cascatas',  value: 0, icon: ChevronRight, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex items-center gap-3">
              <div style={{ background: `${s.color}18` }} className="w-9 h-9 rounded-lg flex items-center justify-center">
                <s.icon style={{ color: s.color }} className="w-4 h-4" />
              </div>
              <div>
                <p style={{ color: s.color }} className="text-xl font-bold leading-none">{s.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Agent grid */}
        <div className="lg:col-span-2 space-y-4">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wider">Agentes Especializados</p>
          {loading && !data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] h-40 animate-pulse" />
              ))}
            </div>
          )}
          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} onAsk={handleAsk} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: feed + command */}
        <div className="space-y-4">
          {/* Command bar */}
          <div id="cmd-bar">
            <CommandBar defaultAgent={selectedAgent} />
          </div>

          {/* Activity feed */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-3">Feed de Atividade</p>
            {data?.recentEvents.length === 0 && (
              <p className="text-white/20 text-sm text-center py-6">Nenhuma atividade ainda</p>
            )}
            {data?.recentEvents.map((ev, i) => (
              <FeedItem key={i} ev={ev} />
            ))}
            {!data && loading && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />
                ))}
              </div>
            )}
          </div>

          {/* Go to Engine CTA */}
          <button
            onClick={() => router.push('/dashboard/nexus/engine')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-400 text-sm font-medium transition-colors"
          >
            <Zap className="w-4 h-4" />
            Abrir NEXUS Engine
          </button>
        </div>
      </div>
    </div>
  )
}
