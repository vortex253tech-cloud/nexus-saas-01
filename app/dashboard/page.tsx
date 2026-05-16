'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Zap, TrendingUp, Users, DollarSign, CheckCircle,
  Bell, Search, ChevronRight, ArrowUpRight, RefreshCw,
  MessageCircle, AlertTriangle, Target, Wand2, Sparkles,
  MessageSquare, BarChart3, Play, Wifi, Activity,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── Types ──────────────────────────────────────────────────────

interface OverviewData {
  ai: { active: boolean; nome: string; tom: string; objetivo: string; nicho: string | null }
  today: { mensagens: number; leads_novos: number }
  pipeline: {
    total: number; hot: number; closed: number
    stages: Array<{ id: string; nome: string; cor: string; posicao: number; tipo: string; count: number; slug: string }>
    leads:  Array<{ id: string; name: string; stage: string; temperatura: string; score: number; empresa: string | null; phone: string | null }>
  }
  events: Array<{ tipo: string; canal: string; conteudo: string; created_at: string }>
}

interface SessionInfo {
  nomeEmpresa: string
  nome: string
  effectivePlan: string
}

// ─── Helpers ─────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

// ─── Sparkline ──────────────────────────────────────────────────

function Sparkline({ values, color, glow }: { values: number[]; color: string; glow: string }) {
  if (values.length < 2) return null
  const w = 120
  const h = 40
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return `${x},${y}`
  })
  const d = `M ${pts.join(' L ')}`
  // Area fill
  const area = `M ${pts[0]} L ${pts.join(' L ')} L ${w},${h} L 0,${h} Z`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={glow} stopOpacity="0.3" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${color})`} />
      <path d={d} stroke={glow} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last dot */}
      <circle cx={w} cy={pts[pts.length - 1].split(',')[1]} r="3" fill={glow} style={{ filter: `drop-shadow(0 0 4px ${glow})` }} />
    </svg>
  )
}

// ─── Animated Counter ────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const start = prev.current
    const steps = 40
    let s = 0
    const t = setInterval(() => {
      s++
      setDisplayed(Math.round(start + ((value - start) * s) / steps))
      if (s >= steps) { setDisplayed(value); prev.current = value; clearInterval(t) }
    }, 20)
    return () => clearInterval(t)
  }, [value])
  return <span>{prefix}{displayed.toLocaleString('pt-BR')}{suffix}</span>
}

// ─── KPI Card ───────────────────────────────────────────────────

function KPICard({
  label, value, unit, trend, trendLabel, sparkValues, color, glow, icon,
}: {
  label: string; value: number; unit?: string; trend: number; trendLabel: string
  sparkValues: number[]; color: string; glow: string; icon: React.ReactNode
}) {
  const up = trend >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative bg-zinc-900/80 border border-zinc-800/60 rounded-2xl px-5 pt-4 pb-3 overflow-hidden group hover:border-zinc-700/60 transition-colors"
    >
      {/* Ambient glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
        style={{ background: glow }} />

      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', color)}>
            {icon}
          </div>
          <div className={cn(
            'flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5',
            up ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400',
          )}>
            <ArrowUpRight className={cn('w-3 h-3', !up && 'rotate-180')} />
            {Math.abs(trend)}%
          </div>
        </div>

        <p className="text-2xl font-bold text-white leading-none mb-0.5">
          {unit === 'BRL'
            ? <><span className="text-sm font-semibold text-zinc-500 mr-0.5">R$</span><AnimatedNumber value={value} /></>
            : unit === '%'
              ? <AnimatedNumber value={value} suffix="%" />
              : <AnimatedNumber value={value} />
          }
        </p>
        <p className="text-xs text-zinc-500 mb-3">{label}</p>

        <div className="flex items-end justify-between">
          <p className="text-[10px] text-zinc-600">{trendLabel}</p>
          <Sparkline values={sparkValues} color={color} glow={glow.replace('rgba', '').replace(/[()]/g, '').split(',').slice(0,3).join(',') || glow} />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Mini Area Chart ─────────────────────────────────────────────

function AreaChart({ datasets }: {
  datasets: Array<{ label: string; values: number[]; color: string; glow: string }>
}) {
  const W = 600
  const H = 160
  const labels = ['12 Mai', '13 Mai', '14 Mai', '15 Mai', '16 Mai', '17 Mai', '18 Mai']
  const allVals = datasets.flatMap(d => d.values)
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)
  const range = max - min || 1
  const pad = { top: 12, right: 12, bottom: 28, left: 36 }
  const iw = W - pad.left - pad.right
  const ih = H - pad.top - pad.bottom

  function toPath(vals: number[], area?: boolean) {
    const pts = vals.map((v, i) => {
      const x = pad.left + (i / (vals.length - 1)) * iw
      const y = pad.top + ih - ((v - min) / range) * ih
      return [x, y] as [number, number]
    })
    if (area) {
      return `M ${pts[0][0]},${pts[0][1]} ${pts.slice(1).map(([x, y]) => `L ${x},${y}`).join(' ')} L ${pad.left + iw},${pad.top + ih} L ${pad.left},${pad.top + ih} Z`
    }
    return `M ${pts[0][0]},${pts[0][1]} ${pts.slice(1).map(([x, y]) => `L ${x},${y}`).join(' ')}`
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: pad.top + ih - f * ih,
    label: Math.round(min + f * range).toLocaleString('pt-BR'),
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      <defs>
        {datasets.map(d => (
          <linearGradient key={d.label} id={`area-${d.label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={d.glow} stopOpacity="0.18" />
            <stop offset="100%" stopColor={d.glow} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {/* Grid */}
      {gridLines.map(g => (
        <g key={g.y}>
          <line x1={pad.left} y1={g.y} x2={pad.left + iw} y2={g.y} stroke="#27272a" strokeWidth="1" strokeDasharray="4 4" />
          <text x={pad.left - 6} y={g.y + 4} textAnchor="end" fontSize="9" fill="#52525b">{g.label}</text>
        </g>
      ))}
      {/* X labels */}
      {labels.map((l, i) => (
        <text key={l} x={pad.left + (i / (labels.length - 1)) * iw} y={H - 6} textAnchor="middle" fontSize="9" fill="#52525b">{l}</text>
      ))}
      {/* Areas */}
      {datasets.map(d => (
        <path key={`area-${d.label}`} d={toPath(d.values, true)} fill={`url(#area-${d.label})`} />
      ))}
      {/* Lines */}
      {datasets.map(d => (
        <path key={`line-${d.label}`} d={toPath(d.values)} stroke={d.glow} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${d.glow})` }} />
      ))}
      {/* End dots */}
      {datasets.map(d => {
        const last = d.values[d.values.length - 1]
        const x = pad.left + iw
        const y = pad.top + ih - ((last - min) / range) * ih
        return (
          <circle key={`dot-${d.label}`} cx={x} cy={y} r="4" fill={d.glow} style={{ filter: `drop-shadow(0 0 6px ${d.glow})` }} />
        )
      })}
    </svg>
  )
}

// ─── Activity Item ────────────────────────────────────────────────

const eventIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  whatsapp: { icon: <MessageCircle className="w-3.5 h-3.5" />, color: 'bg-emerald-500/15 text-emerald-400' },
  cobranca: { icon: <DollarSign className="w-3.5 h-3.5" />,   color: 'bg-violet-500/15 text-violet-400' },
  lead:     { icon: <Users className="w-3.5 h-3.5" />,        color: 'bg-blue-500/15 text-blue-400' },
  campanha: { icon: <Wand2 className="w-3.5 h-3.5" />,        color: 'bg-fuchsia-500/15 text-fuchsia-400' },
  alerta:   { icon: <AlertTriangle className="w-3.5 h-3.5" />,color: 'bg-amber-500/15 text-amber-400' },
  relatorio:{ icon: <BarChart3 className="w-3.5 h-3.5" />,    color: 'bg-cyan-500/15 text-cyan-400' },
  default:  { icon: <Zap className="w-3.5 h-3.5" />,          color: 'bg-zinc-800 text-zinc-400' },
}

function eventIcon(tipo: string) {
  const key = Object.keys(eventIcons).find(k => tipo?.toLowerCase().includes(k)) ?? 'default'
  return eventIcons[key]
}

// ─── Live Pulse ───────────────────────────────────────────────────

function LivePulse({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  )
}

// ─── Pipeline Stage Column ────────────────────────────────────────

function StageColumn({ stage, leads }: {
  stage: OverviewData['pipeline']['stages'][number]
  leads: OverviewData['pipeline']['leads']
}) {
  const stageLeads = leads.filter(l =>
    l.stage === stage.slug ||
    l.stage === stage.nome ||
    l.stage === stage.nome.toLowerCase()
  )

  const colorMap: Record<string, string> = {
    'novo':        '#7c3aed',
    'contatado':   '#3b82f6',
    'qualificado': '#8b5cf6',
    'proposta':    '#f59e0b',
    'negociando':  '#f97316',
    'fechado':     '#10b981',
    'perdido':     '#ef4444',
  }
  const accentColor = colorMap[stage.slug] ?? colorMap[stage.nome.toLowerCase().split(' ')[0]] ?? '#7c3aed'

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400 truncate">{stage.nome}</p>
        <span className="text-sm font-bold text-white ml-2 shrink-0">{stage.count}</span>
      </div>
      <div
        className="h-0.5 rounded-full mb-3"
        style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}60` }}
      />
      <div className="space-y-2">
        {stageLeads.slice(0, 2).map(lead => (
          <div key={lead.id} className="bg-zinc-800/60 rounded-xl px-3 py-2.5 border border-zinc-700/30 hover:border-zinc-600/50 transition-colors cursor-pointer">
            <p className="text-xs text-zinc-200 font-medium truncate">{lead.name}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{lead.empresa ?? '—'}</p>
          </div>
        ))}
        {stage.count > 2 && (
          <p className="text-[10px] text-zinc-600 px-1">+ {stage.count - 2} leads</p>
        )}
        {stage.count === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-800 h-10 flex items-center justify-center">
            <span className="text-[10px] text-zinc-700">vazio</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Suggested Action ─────────────────────────────────────────────

function SuggestedAction({ label, priority, href }: { label: string; priority: 'alta' | 'media'; href: string }) {
  const colors = {
    alta:  { dot: 'bg-red-400',    text: 'text-red-400',    label: 'Alta prioridade' },
    media: { dot: 'bg-amber-400',  text: 'text-amber-400',  label: 'Média prioridade' },
  }
  const c = colors[priority]
  return (
    <Link href={href}
      className="flex items-center gap-3 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 -mx-3 px-3 rounded-xl transition-colors group">
      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', c.dot === 'bg-red-400' ? 'bg-red-500/15' : 'bg-amber-500/15')}>
        <span className={cn('w-2 h-2 rounded-full', c.dot)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 truncate">{label}</p>
        <p className={cn('text-[10px]', c.text)}>{c.label}</p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
    </Link>
  )
}

// ─── Main Page ────────────────────────────────────────────────────

interface MetricsData {
  days:     string[]
  leads:    number[]
  messages: number[]
  deals:    number[]
  totals:   { leads: number; messages: number; deals: number; closed: number }
}

export default function DashboardPage() {
  const [companyId,  setCompanyId]  = useState<string | null>(null)
  const [session,    setSession]    = useState<SessionInfo>({ nomeEmpresa: 'Minha Empresa', nome: '', effectivePlan: 'free' })
  const [overview,   setOverview]   = useState<OverviewData | null>(null)
  const [metrics,    setMetrics]    = useState<MetricsData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [liveIndex,  setLiveIndex]  = useState(0)

  const LIVE_STATES = [
    'Analisando oportunidades…',
    'Monitorando conversas…',
    'Calculando score de leads…',
    'Verificando pipeline…',
    'Gerando insights…',
  ]

  // Cycle through live states
  useEffect(() => {
    const t = setInterval(() => setLiveIndex(i => (i + 1) % LIVE_STATES.length), 3000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { resolveCompanyId().then(setCompanyId) }, [])

  const load = useCallback(async (cid: string) => {
    setLoading(true)
    const [ov, sess, met] = await Promise.all([
      fetch(`/api/nexus/overview?company_id=${cid}`).then(r => r.json()).catch(() => null),
      fetch('/api/auth/session').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/nexus/metrics?company_id=${cid}`).then(r => r.json()).catch(() => null),
    ])
    if (ov) setOverview(ov)
    if (met) setMetrics(met)
    if (sess) {
      setSession({
        nomeEmpresa:   sess.company?.name ?? 'Empresa',
        nome:          sess.user?.name ?? sess.company?.name ?? 'você',
        effectivePlan: sess.user?.effectivePlan ?? 'free',
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (companyId) load(companyId) }, [companyId, load])

  // Real 7-day time-series from metrics API (fallback to flat zeros)
  const sparkLeads  = metrics?.leads    ?? [0, 0, 0, 0, 0, 0, 0]
  const sparkMsgs   = metrics?.messages ?? [0, 0, 0, 0, 0, 0, 0]
  const sparkDeals  = metrics?.deals    ?? [0, 0, 0, 0, 0, 0, 0]
  const closedCount = metrics?.totals.closed ?? overview?.pipeline.closed ?? 0
  const totalLeads  = metrics?.totals.leads  ?? overview?.pipeline.total  ?? 0

  // Conversion rate sparkline: compare first half vs second half of week
  const convRate    = totalLeads > 0 ? Math.round((closedCount / totalLeads) * 100) : 0
  const sparkConv   = sparkLeads.map((l, i) => sparkDeals[i] > 0 && l > 0 ? Math.round((sparkDeals[i] / l) * 100) : convRate)

  // 7-day period-over-period trend (compare last 7 vs prior 7)
  function weekTrend(arr: number[]): number {
    const half = Math.floor(arr.length / 2)
    const prev = arr.slice(0, half).reduce((a, b) => a + b, 0)
    const curr = arr.slice(half).reduce((a, b) => a + b, 0)
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const kpis = [
    {
      label:       'Mensagens enviadas',
      value:       metrics?.totals.messages ?? overview?.today.mensagens ?? 0,
      unit:        undefined,
      trend:       weekTrend(sparkMsgs),
      trendLabel:  'últimos 7 dias',
      sparkValues: sparkMsgs,
      color:       'bg-violet-500/15',
      glow:        '#7c3aed',
      icon:        <MessageCircle className="w-4 h-4 text-violet-400" />,
    },
    {
      label:       'Novos Leads',
      value:       totalLeads,
      unit:        undefined,
      trend:       weekTrend(sparkLeads),
      trendLabel:  'últimos 7 dias',
      sparkValues: sparkLeads,
      color:       'bg-blue-500/15',
      glow:        '#3b82f6',
      icon:        <Users className="w-4 h-4 text-blue-400" />,
    },
    {
      label:       'Negociações Ativas',
      value:       metrics?.totals.deals ?? overview?.pipeline.hot ?? 0,
      unit:        undefined,
      trend:       weekTrend(sparkDeals),
      trendLabel:  'últimos 7 dias',
      sparkValues: sparkDeals,
      color:       'bg-fuchsia-500/15',
      glow:        '#d946ef',
      icon:        <TrendingUp className="w-4 h-4 text-fuchsia-400" />,
    },
    {
      label:       'Taxa de Conversão',
      value:       convRate,
      unit:        '%' as const,
      trend:       weekTrend(sparkConv),
      trendLabel:  'leads → fechados',
      sparkValues: sparkConv,
      color:       'bg-emerald-500/15',
      glow:        '#10b981',
      icon:        <CheckCircle className="w-4 h-4 text-emerald-400" />,
    },
  ]

  const suggestedActions = [
    { label: 'Entrar em contato com 5 leads quentes',  priority: 'alta' as const, href: '/dashboard/leads' },
    { label: 'Enviar proposta para 2 negociações',     priority: 'media' as const, href: '/dashboard/leads' },
    { label: 'Acompanhar inadimplentes',               priority: 'alta' as const, href: '/dashboard/financeiro' },
    { label: 'Revisar campanha de recuperação',        priority: 'media' as const, href: '/dashboard/nexus?tab=automacoes' },
  ]

  const firstName = session.nome.split(' ')[0] || session.nomeEmpresa.split(' ')[0]

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* ── Ambient background glows ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl" />
        <div className="absolute top-32 right-1/4 w-64 h-64 bg-blue-600/4 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-fuchsia-600/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6 py-6 space-y-6">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            {/* System status badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-xs text-zinc-400">Sistema operacional ativo</span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              {greeting()},{' '}
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">{firstName}!</span>
              {' '}👋
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">Aqui está o que está acontecendo com sua empresa hoje.</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button className="w-8 h-8 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-all">
              <Search className="w-4 h-4" />
            </button>
            <button className="relative w-8 h-8 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-all">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-violet-500 rounded-full border-2 border-zinc-950" />
            </button>
            <div className="h-6 w-px bg-zinc-800" />
            <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center text-white text-xs font-bold">
                {firstName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-white leading-none">{session.nomeEmpresa}</p>
                <p className="text-[10px] text-zinc-500 capitalize">{session.effectivePlan === 'free' ? 'Grátis' : `Plano ${session.effectivePlan}`}</p>
              </div>
            </div>
            <Link href="/dashboard/nexus"
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all"
              style={{ boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}>
              <Sparkles className="w-3.5 h-3.5" />
              Nova ação com IA
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-zinc-900/60 border border-zinc-800/40 rounded-2xl h-36 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((kpi, i) => (
              <KPICard key={i} {...kpi} />
            ))}
          </div>
        )}

        {/* ── Main grid: chart + activity + bot ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Performance chart */}
          <div className="lg:col-span-7 bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">Desempenho da empresa</p>
              </div>
              <div className="flex items-center gap-4">
                {[
                  { label: 'Receita',     color: '#7c3aed' },
                  { label: 'Leads',       color: '#3b82f6' },
                  { label: 'Negociações', color: '#d946ef' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                    <span className="text-[11px] text-zinc-400">{l.label}</span>
                  </div>
                ))}
                <div className="ml-2 text-[11px] text-zinc-500 bg-zinc-800 border border-zinc-700/40 rounded-lg px-2.5 py-1">
                  Últimos 7 dias
                </div>
              </div>
            </div>
            <AreaChart datasets={[
              { label: 'Mensagens',    values: sparkMsgs,                      color: 'violet',  glow: '#7c3aed' },
              { label: 'Leads',        values: sparkLeads,                     color: 'blue',    glow: '#3b82f6' },
              { label: 'Negociações',  values: sparkDeals,                     color: 'fuchsia', glow: '#d946ef' },
            ]} />
          </div>

          {/* Activity feed + bot */}
          <div className="lg:col-span-5 space-y-4">

            {/* NEXUS IA card */}
            <div className="relative bg-gradient-to-br from-violet-900/30 via-zinc-900/80 to-zinc-900/80 border border-violet-500/20 rounded-2xl p-4 overflow-hidden"
              style={{ boxShadow: '0 0 40px rgba(124,58,237,0.1)' }}>
              <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl" />
              <div className="relative flex items-start gap-3 mb-3">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-violet-400" />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-zinc-950 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">NEXUS IA</p>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5">● Online</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={liveIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs text-zinc-300 mb-3 leading-relaxed"
                  >
                    Estou analisando seus dados e identifiquei <strong className="text-violet-300">3 oportunidades</strong> para aumentar seus resultados hoje.
                  </motion.p>
                </AnimatePresence>
                <div className="space-y-2">
                  <Link href="/dashboard/nexus?tab=insights"
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all"
                    style={{ boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}>
                    <Target className="w-3.5 h-3.5" />
                    Ver oportunidades
                  </Link>
                  <Link href="/dashboard/nexus"
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all border border-zinc-700/40">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Conversar com IA
                  </Link>
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
                <p className="text-sm font-semibold text-white">Atividades da IA</p>
                <Link href="/dashboard/nexus?tab=painel" className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
                  Ver todas
                </Link>
              </div>
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-zinc-800/60 rounded-xl animate-pulse" />)}
                </div>
              ) : !overview?.events.length ? (
                <div className="py-8 text-center text-xs text-zinc-600">Nenhuma atividade ainda</div>
              ) : (
                <div className="divide-y divide-zinc-800/40 max-h-56 overflow-y-auto">
                  {overview.events.slice(0, 6).map((ev, i) => {
                    const { icon, color } = eventIcon(ev.tipo ?? ev.canal)
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-3 px-4 py-3"
                      >
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', color)}>
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-300 leading-snug truncate">{ev.conteudo}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">{ev.canal} · {timeAgo(ev.created_at)}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Pipeline + Suggested Actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Pipeline */}
          <div className="lg:col-span-8 bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold text-white">Funil de vendas</p>
              <Link href="/dashboard/leads" className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                Ver pipeline completo <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="flex gap-4">
                {[...Array(5)].map((_, i) => <div key={i} className="flex-1 h-32 bg-zinc-800/40 rounded-xl animate-pulse" />)}
              </div>
            ) : !overview?.pipeline.stages.length ? (
              <div className="py-12 text-center text-xs text-zinc-600">Pipeline não configurado</div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-1">
                {overview.pipeline.stages.map(stage => (
                  <StageColumn key={stage.id} stage={stage} leads={overview.pipeline.leads} />
                ))}
              </div>
            )}
          </div>

          {/* Suggested actions */}
          <div className="lg:col-span-4 bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">Próximas ações</p>
              <Link href="/dashboard/nexus?tab=insights" className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
                Ver todas
              </Link>
            </div>
            <div>
              {suggestedActions.map((a, i) => (
                <SuggestedAction key={i} {...a} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom live bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative bg-zinc-900/80 border border-zinc-800/40 rounded-2xl px-5 py-3.5 overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-600/5 via-transparent to-blue-600/5" />
          <div className="relative flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-violet-400" />
              </div>
              <p className="text-xs font-semibold text-zinc-300">A IA NEXUS está trabalhando para você 24/7</p>
            </div>
            <div className="flex items-center gap-5 ml-auto flex-wrap">
              {['Analisando dados', 'Gerando oportunidades', 'Executando automações', 'Aumentando resultados'].map(l => (
                <div key={l} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-zinc-400">{l}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Live scrolling indicator */}
          <div className="mt-2.5 flex items-center gap-2">
            <Activity className="w-3 h-3 text-violet-400 animate-pulse shrink-0" />
            <AnimatePresence mode="wait">
              <motion.span
                key={liveIndex}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.25 }}
                className="text-[11px] text-violet-400"
              >
                {LIVE_STATES[liveIndex]}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
