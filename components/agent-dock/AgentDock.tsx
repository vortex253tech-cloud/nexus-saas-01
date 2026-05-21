'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Crown, TrendingUp, Megaphone, DollarSign, FolderKanban,
  Headphones, PenLine, BarChart3, Zap,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { AgentStatus, StatusResponse } from '@/app/api/agents/status/route'

// ─── Agent icon registry ──────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  Crown, TrendingUp, Megaphone, DollarSign,
  FolderKanban, Headphones, PenLine, BarChart3,
}

const ICON_BY_ID: Record<string, string> = {
  ceo: 'Crown', sales: 'TrendingUp', marketing: 'Megaphone',
  finance: 'DollarSign', projects: 'FolderKanban', support: 'Headphones',
  content: 'PenLine', analytics: 'BarChart3',
}

// ─── Status descriptions ──────────────────────────────────────────────────────

const STATUS_COPY: Record<string, string[]> = {
  ceo:       ['analisando métricas', 'identificando gargalos', 'avaliando pipeline'],
  sales:     ['qualificando leads', 'monitorando conversão', 'scoring CRM'],
  marketing: ['analisando campanhas', 'otimizando CPA', 'revisando funil'],
  finance:   ['monitorando receita', 'calculando margens', 'projetando cashflow'],
  projects:  ['reorganizando tarefas', 'detectando atrasos', 'priorizando sprints'],
  support:   ['monitorando tickets', 'analisando conversas', 'identificando urgências'],
  content:   ['gerando copies', 'otimizando posts', 'criando hooks'],
  analytics: ['calculando tendências', 'cruzando dados', 'gerando insights'],
}

function getStatusCopy(agentId: string): string {
  const options = STATUS_COPY[agentId] ?? ['em standby']
  return options[Math.floor(Date.now() / 8000) % options.length]
}

// ─── Compact agent dot (for toolbar dock) ────────────────────────────────────

export function AgentDotCompact({ agent }: { agent: AgentStatus }) {
  const iconName = ICON_BY_ID[agent.id] ?? 'Zap'
  const Icon = ICONS[iconName] ?? Zap

  return (
    <div className="group relative">
      <div
        className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
          agent.isActive && 'shadow-lg',
        )}
        style={{ background: agent.bg, border: `1.5px solid ${agent.border}`, boxShadow: agent.isActive ? `0 0 12px ${agent.hex}33` : 'none' }}
      >
        <Icon className="w-4 h-4" style={{ color: agent.hex }} />
        {agent.isActive && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#0a0a0f]"
            style={{ background: agent.hex }}
          />
        )}
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
        <div className="bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-center whitespace-nowrap shadow-xl">
          <p className="text-[11px] font-semibold text-white">{agent.name}</p>
          <p className="text-[10px] text-white/40">{agent.isActive ? getStatusCopy(agent.id) : 'standby'}</p>
        </div>
        <div className="w-2 h-2 bg-zinc-900 border-r border-b border-white/10 rotate-45 -mt-1" />
      </div>
    </div>
  )
}

// ─── Full agent row (for lists) ───────────────────────────────────────────────

export function AgentRow({ agent }: { agent: AgentStatus }) {
  const iconName = ICON_BY_ID[agent.id] ?? 'Zap'
  const Icon = ICONS[iconName] ?? Zap
  const statusText = agent.isActive ? getStatusCopy(agent.id) : 'em standby'

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.03] transition-colors">
      <div
        className="relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: agent.bg, boxShadow: agent.isActive ? `0 0 10px ${agent.hex}30` : 'none' }}
      >
        <Icon className="w-4 h-4" style={{ color: agent.hex }} />
        {agent.isActive && (
          <motion.span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-1.5 ring-[#0a0a0f]"
            style={{ background: '#10b981' }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-white/80 leading-tight">{agent.name}</p>
        <p className="text-[11px] text-white/30 truncate">{statusText}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {agent.actionsToday > 0 && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ color: agent.hex, background: `${agent.hex}18` }}
          >
            {agent.actionsToday}
          </span>
        )}
        <div
          className={cn('w-1.5 h-1.5 rounded-full', agent.isActive ? 'bg-emerald-400' : 'bg-white/20')}
          style={agent.isActive ? { boxShadow: '0 0 6px #10b981' } : {}}
        />
      </div>
    </div>
  )
}

// ─── Full dock panel ──────────────────────────────────────────────────────────

interface AgentDockProps {
  className?: string
  compact?: boolean
}

export function AgentDock({ className, compact = false }: AgentDockProps) {
  const [data, setData] = useState<StatusResponse | null>(null)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/status')
      if (res.ok) setData(await res.json())
    } catch { /* swallow */ }
  }, [])

  useEffect(() => {
    fetch_()
    const t = setInterval(fetch_, 20000)
    return () => clearInterval(t)
  }, [fetch_])

  if (!data) return null

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        {data.agents.map(a => (
          <AgentDotCompact key={a.id} agent={a} />
        ))}
      </div>
    )
  }

  const active = data.agents.filter(a => a.isActive)
  const standby = data.agents.filter(a => !a.isActive)

  return (
    <div className={cn('rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[...Array(Math.min(active.length, 4))].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full bg-emerald-400"
                style={{ height: 8 + Math.random() * 12 }}
                animate={{ height: [8, 20, 8] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Agentes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 font-semibold">
            {active.length} online
          </span>
        </div>
      </div>

      {/* Active agents */}
      {active.length > 0 && (
        <div className="px-2 pt-2">
          {active.map(a => <AgentRow key={a.id} agent={a} />)}
        </div>
      )}

      {/* Standby agents */}
      {standby.length > 0 && (
        <div className="px-2 pb-2 opacity-40">
          {standby.map(a => <AgentRow key={a.id} agent={a} />)}
        </div>
      )}
    </div>
  )
}
