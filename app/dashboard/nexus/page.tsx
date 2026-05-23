'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, Zap, TrendingUp, MessageSquare, Users, DollarSign,
  Activity, Bot, Shield, CheckCircle2, AlertTriangle,
  ArrowRight, ChevronRight, Sparkles, Brain, Play,
  BarChart3, Target, Wifi, RefreshCw, Bell,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentData {
  id: string; label: string; description: string; icon: string
  color: string; status: string; task: string; metrics: string
}

interface ActivityItem {
  id: string; type: string; label: string
  detail: string; time: string; icon: string; color: string
}

interface Insight {
  type: string; title: string; desc: string; impact: string; action: string
}

interface OSData {
  health: number
  metrics: {
    conversations: number; unread: number; ai_active: number; hot_leads: number
    today_messages: number; active_autos: number; total_triggers: number
    active_projects: number; mrr: number
  }
  agents: AgentData[]
  activity: ActivityItem[]
  insights: Insight[]
}

// ── Color map ─────────────────────────────────────────────────────────────────

const COLOR: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30', glow: '#8b5cf6' },
  blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',   glow: '#3b82f6' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',glow: '#10b981' },
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',  glow: '#f59e0b' },
  cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',   glow: '#06b6d4' },
  slate:   { text: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/30',  glow: '#94a3b8' },
  pink:    { text: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30',   glow: '#ec4899' },
  indigo:  { text: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30', glow: '#6366f1' },
  rose:    { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',   glow: '#f43f5e' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Boot Sequence ─────────────────────────────────────────────────────────────

const BOOT_STEPS = [
  'Inicializando núcleo operacional...',
  'Conectando agentes IA...',
  'Carregando dados da empresa...',
  'Ativando monitoramento realtime...',
  'Sincronizando módulos...',
  'Sistema operacional online ✓',
]

function BootSequence({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (step < BOOT_STEPS.length - 1) {
      const t = setTimeout(() => setStep(s => s + 1), 380)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => { setDone(true); setTimeout(onDone, 400) }, 600)
      return () => clearTimeout(t)
    }
  }, [step, onDone])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050508]"
      animate={done ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Outer ring */}
      <div className="relative flex flex-col items-center gap-8">
        <div className="relative w-32 h-32">
          <motion.div
            className="absolute inset-0 rounded-full border border-violet-500/30"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border border-violet-500/50"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-3xl font-bold tracking-tight text-white">
              NX
            </div>
          </div>
          {/* Glow */}
          <div className="absolute inset-0 rounded-full bg-violet-500/10 blur-2xl" />
        </div>

        <div className="flex flex-col gap-2 w-72">
          {BOOT_STEPS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: i <= step ? 1 : 0.15, x: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'text-xs font-mono flex items-center gap-2',
                i < step ? 'text-violet-400' : i === step ? 'text-white' : 'text-white/20',
              )}
            >
              {i < step ? (
                <CheckCircle2 className="w-3 h-3 text-violet-400 shrink-0" />
              ) : i === step ? (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-white shrink-0"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.7 }}
                />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-white/10 shrink-0" />
              )}
              {s}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Health Ring ───────────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const r = 44
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <motion.circle
          cx="50" cy="50" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-bold text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">saúde</span>
      </div>
    </div>
  )
}

// ── Pulse Dot ─────────────────────────────────────────────────────────────────

function PulseDot({ color = 'emerald' }: { color?: string }) {
  const c = color === 'emerald' ? 'bg-emerald-400' : color === 'amber' ? 'bg-amber-400' : 'bg-red-400'
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', c)} />
      <span className={cn('relative inline-flex rounded-full h-2 w-2', c)} />
    </span>
  )
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  const c = COLOR[color] ?? COLOR.violet
  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-center gap-3 bg-white/[0.02]',
      c.border,
    )}>
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', c.bg)}>
        <Icon className={cn('w-4 h-4', c.text)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-white leading-tight">{value}</p>
        {sub && <p className={cn('text-[10px]', c.text)}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Agent Card ────────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentData }) {
  const c = COLOR[agent.color] ?? COLOR.violet
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-3.5 bg-white/[0.02] group relative overflow-hidden',
        c.border,
      )}
    >
      {/* Glow shimmer */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${c.glow}18 0%, transparent 60%)` }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{agent.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{agent.label}</p>
            <p className="text-[10px] text-white/40">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <PulseDot color="emerald" />
          <span className="text-[10px] text-emerald-400 font-medium">Ativo</span>
        </div>
      </div>
      <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-between">
        <p className="text-[10px] text-white/50 truncate pr-2">{agent.task}</p>
        <span className={cn('text-[10px] font-medium shrink-0', c.text)}>{agent.metrics}</span>
      </div>
    </motion.div>
  )
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-white/20 gap-2">
        <Activity className="w-6 h-6" />
        <p className="text-xs">Aguardando atividades...</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <AnimatePresence initial={false}>
        {items.map((item, i) => {
          const c = COLOR[item.color] ?? COLOR.slate
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-white/[0.015]',
                c.border,
              )}
            >
              <span className="text-sm shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn('text-[11px] font-medium', c.text)}>{item.label}</p>
                  <span className="text-[10px] text-white/25">{timeAgo(item.time)}</span>
                </div>
                {item.detail && (
                  <p className="text-[10px] text-white/40 truncate">{item.detail}</p>
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// ── Insight Card ──────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
  const isOpp = insight.type === 'opportunity'
  const isWarn = insight.type === 'warning'
  const c = isOpp ? COLOR.emerald : isWarn ? COLOR.amber : COLOR.blue
  const icon = isOpp ? '🎯' : isWarn ? '⚠️' : 'ℹ️'

  const linkMap: Record<string, string> = {
    'Ver leads':     '/dashboard/leads',
    'Responder agora':'/dashboard/whatsapp',
    'Ver automações':'/dashboard/automations',
    'Ativar IA':     '/dashboard/whatsapp',
  }

  return (
    <div className={cn('rounded-xl border p-3.5 bg-white/[0.02]', c.border)}>
      <div className="flex items-start gap-2.5">
        <span className="text-base mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{insight.title}</p>
          <p className="text-[11px] text-white/40 mt-0.5">{insight.desc}</p>
          <div className="flex items-center justify-between mt-2">
            <span className={cn('text-[11px] font-medium', c.text)}>{insight.impact}</span>
            <Link
              href={linkMap[insight.action] ?? '/dashboard'}
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 hover:opacity-80 transition-opacity',
                c.bg, c.border, c.text,
              )}
            >
              {insight.action} <ArrowRight className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Growth Funnel ─────────────────────────────────────────────────────────────

function GrowthFunnel({ metrics }: { metrics: OSData['metrics'] }) {
  const stages = [
    { label: 'Atração',   icon: '📡', value: `${fmt(metrics.today_messages)} msgs`,  color: 'cyan'    },
    { label: 'Conversão', icon: '🎯', value: `${fmt(metrics.hot_leads)} leads`,       color: 'violet'  },
    { label: 'Venda',     icon: '💰', value: metrics.mrr > 0 ? fmtBRL(metrics.mrr) : '—', color: 'emerald' },
    { label: 'Retenção',  icon: '🔄', value: `${fmt(metrics.conversations)} conv.`,  color: 'blue'    },
    { label: 'Expansão',  icon: '🚀', value: `${fmt(metrics.active_autos)} autos`,    color: 'amber'   },
  ]

  return (
    <div className="flex items-center gap-1">
      {stages.map((s, i) => {
        const c = COLOR[s.color] ?? COLOR.violet
        return (
          <div key={s.label} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={cn(
              'flex-1 rounded-lg border p-2.5 text-center bg-white/[0.02]',
              c.border,
            )}>
              <p className="text-base">{s.icon}</p>
              <p className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">{s.label}</p>
              <p className={cn('text-xs font-bold mt-0.5 truncate', c.text)}>{s.value}</p>
            </div>
            {i < stages.length - 1 && (
              <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Module Grid ───────────────────────────────────────────────────────────────

const MODULES = [
  { label: 'WhatsApp AI',  href: '/dashboard/whatsapp',  icon: MessageSquare, color: 'emerald' },
  { label: 'Pipeline',      href: '/dashboard/leads',     icon: Target,        color: 'violet'  },
  { label: 'Financeiro',    href: '/dashboard/financeiro',icon: DollarSign,    color: 'amber'   },
  { label: 'Projetos',      href: '/dashboard/projects',  icon: BarChart3,     color: 'blue'    },
  { label: 'Automações',    href: '/dashboard/automations',icon: Zap,          color: 'cyan'    },
  { label: 'Growth',        href: '/dashboard/growth-map',icon: TrendingUp,    color: 'pink'    },
  { label: 'Agentes IA',    href: '/dashboard/agents',    icon: Bot,           color: 'indigo'  },
  { label: 'Assistente',    href: '/dashboard/assistant', icon: Cpu,           color: 'rose'    },
]

function ModuleGrid() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MODULES.map(m => {
        const c = COLOR[m.color] ?? COLOR.violet
        return (
          <Link
            key={m.label}
            href={m.href}
            className={cn(
              'rounded-xl border p-3 flex flex-col items-center gap-1.5 bg-white/[0.02]',
              'hover:bg-white/[0.05] transition-all duration-200 group',
              c.border,
            )}
          >
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', c.bg)}>
              <m.icon className={cn('w-4 h-4', c.text)} />
            </div>
            <p className="text-[10px] text-white/50 group-hover:text-white/70 transition-colors text-center leading-tight">
              {m.label}
            </p>
            <div className="flex items-center gap-1">
              <PulseDot color="emerald" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NexusOSPage() {
  const [booted, setBooted]       = useState(false)
  const [showBoot, setShowBoot]   = useState(false)
  const [data, setData]           = useState<OSData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Show boot sequence only on first visit this session
  useEffect(() => {
    const seen = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nexus_booted')
    if (!seen) {
      setShowBoot(true)
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('nexus_booted', '1')
    } else {
      setBooted(true)
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/nexus/os', { cache: 'no-store' })
      if (!res.ok) return
      const d = await res.json() as OSData
      setData(d)
      setLastUpdate(new Date())
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!booted) return
    fetchData()
    intervalRef.current = setInterval(fetchData, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [booted, fetchData])

  const handleBootDone = useCallback(() => {
    setShowBoot(false)
    setBooted(true)
  }, [])

  // ── Status bar info ─────────────────────────────────────────────────────────
  const health = data?.health ?? 0
  const metrics = data?.metrics
  const healthColor = health >= 80 ? 'text-emerald-400' : health >= 60 ? 'text-amber-400' : 'text-red-400'
  const healthLabel = health >= 80 ? 'Operando no pico' : health >= 60 ? 'Operando' : 'Atenção necessária'

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
        {showBoot && <BootSequence onDone={handleBootDone} />}
      </AnimatePresence>

      <motion.div
        className="min-h-screen bg-[#050508] text-white p-4 lg:p-6 space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: booted ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/40 to-slate-900/40 p-5 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-violet-500/10 blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between gap-4 relative">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="relative w-12 h-12 shrink-0">
                <motion.div
                  className="absolute inset-0 rounded-full border border-violet-500/50"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                />
                <div className="absolute inset-1 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-violet-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">NEXUS OS</h1>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <PulseDot color="emerald" />
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Online</span>
                  </div>
                </div>
                <p className="text-xs text-white/40 mt-0.5">Sistema Operacional Empresarial Autônomo</p>
              </div>
            </div>

            {/* Right: health + refresh */}
            <div className="flex items-center gap-4">
              {data && <HealthRing score={health} />}
              <div className="text-right hidden sm:block">
                {data ? (
                  <>
                    <p className={cn('text-sm font-semibold', healthColor)}>{healthLabel}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {data.agents.length} agentes · {metrics?.active_autos ?? 0} automações
                    </p>
                    <p className="text-[10px] text-white/20 mt-1">
                      Atualizado {lastUpdate ? timeAgo(lastUpdate.toISOString()) : '—'}
                    </p>
                  </>
                ) : loading ? (
                  <p className="text-xs text-white/30">Carregando...</p>
                ) : null}
              </div>
              <button
                onClick={fetchData}
                className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white/40" />
              </button>
            </div>
          </div>

          {/* KPI bar */}
          {metrics && (
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { l: 'Conversas', v: fmt(metrics.conversations), icon: '💬', c: 'blue'    },
                { l: 'Não lidas', v: fmt(metrics.unread),        icon: '🔔', c: metrics.unread > 0 ? 'amber' : 'emerald' },
                { l: 'IA Ativa',  v: fmt(metrics.ai_active),     icon: '🤖', c: 'violet'  },
                { l: 'Hot Leads', v: fmt(metrics.hot_leads),     icon: '🎯', c: 'emerald' },
                { l: 'Msgs Hoje', v: fmt(metrics.today_messages),icon: '📨', c: 'cyan'    },
                { l: 'Automações',v: fmt(metrics.active_autos),  icon: '⚡', c: 'pink'    },
              ].map(k => (
                <div key={k.l} className="text-center">
                  <p className="text-base">{k.icon}</p>
                  <p className="text-lg font-bold text-white leading-none">{k.v}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">{k.l}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Main grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left column: Agents */}
          <div className="lg:col-span-2 space-y-4">

            {/* Agent grid */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.015] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-violet-400" />
                  <h2 className="text-sm font-semibold text-white">Agentes IA Operando</h2>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                  <PulseDot color="emerald" />
                  {data?.agents.length ?? 9} ativos · 24/7
                </div>
              </div>

              {data ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {data.agents.map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <AgentCard agent={a} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/5 p-3.5 bg-white/[0.01] animate-pulse h-20" />
                  ))}
                </div>
              )}
            </div>

            {/* Growth Funnel */}
            {metrics && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.015] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Mapa de Crescimento</h2>
                  <span className="text-[10px] text-white/30 ml-auto">Operando em tempo real</span>
                </div>
                <GrowthFunnel metrics={metrics} />
              </div>
            )}

            {/* Modules */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.015] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Módulos Conectados</h2>
                <span className="text-[10px] text-emerald-400 ml-auto font-medium">Todos online</span>
              </div>
              <ModuleGrid />
            </div>
          </div>

          {/* Right column: Activity + Insights */}
          <div className="space-y-4">

            {/* Insights */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.015] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Insights Inteligentes</h2>
              </div>
              {data?.insights && data.insights.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {data.insights.map((ins, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <InsightCard insight={ins} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-white/20 text-xs">
                  {loading ? 'Analisando...' : 'Sistema monitorando...'}
                </div>
              )}
            </div>

            {/* Live activity */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.015] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" />
                  <h2 className="text-sm font-semibold text-white">Atividade ao Vivo</h2>
                </div>
                <div className="flex items-center gap-1">
                  <PulseDot color="emerald" />
                  <span className="text-[10px] text-white/30">realtime</span>
                </div>
              </div>
              {data ? (
                <ActivityFeed items={data.activity} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-white/5 p-2 h-10 animate-pulse bg-white/[0.01]" />
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white">Comando Rápido</h2>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Assistente IA',  href: '/dashboard/assistant',   color: 'violet' },
                  { label: 'WhatsApp',       href: '/dashboard/whatsapp',    color: 'emerald'},
                  { label: 'Leads',          href: '/dashboard/leads',       color: 'cyan'   },
                  { label: 'Financeiro',     href: '/dashboard/financeiro',  color: 'amber'  },
                ].map(b => {
                  const c = COLOR[b.color] ?? COLOR.violet
                  return (
                    <Link
                      key={b.label}
                      href={b.href}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-[11px] font-medium flex items-center gap-1.5',
                        'hover:opacity-80 transition-opacity',
                        c.bg, c.border, c.text,
                      )}
                    >
                      <Play className="w-2.5 h-2.5" />
                      {b.label}
                    </Link>
                  )
                })}
              </div>
              <Link
                href="/dashboard/assistant"
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[11px] font-semibold text-violet-400 hover:bg-violet-500/20 transition-colors"
              >
                <Cpu className="w-3 h-3" />
                Abrir NEXUS Voice
                <ArrowRight className="w-3 h-3 ml-auto" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Footer status ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-[10px] text-white/20 px-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <PulseDot color="emerald" />
              <span>Sistema operacional</span>
            </div>
            <span>·</span>
            <span>{data?.agents.length ?? 0} agentes ativos</span>
            <span>·</span>
            <span>{metrics?.active_autos ?? 0} automações rodando</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>NEXUS OS v2.0</span>
          </div>
        </div>
      </motion.div>
    </>
  )
}
