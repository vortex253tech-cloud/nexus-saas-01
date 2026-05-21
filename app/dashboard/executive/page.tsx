'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown, TrendingUp, Megaphone, DollarSign, FolderKanban,
  Headphones, PenLine, BarChart3, Zap, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Activity, Target, Users,
  CreditCard, LayoutGrid, RefreshCw, Wifi,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'
import { LiveFeed } from '@/components/live-feed/LiveFeed'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Metric {
  label:   string
  value:   string
  delta?:  { pct: number; positive: boolean }
  accent:  string
  icon:    React.ElementType
  sub?:    string
}

interface Alert {
  severity: 'critical' | 'warning' | 'info'
  title:    string
  body:     string
  agent:    string
  agentColor: string
}

interface OverviewData {
  pipeline: { total: number; hot: number; closed: number }
  today:    { mensagens: number; leads_novos: number }
  ai:       { active: boolean; nome: string }
}

interface FinancialData {
  revenue_received: number
  pending_amount:   number
  overdue_amount:   number
  pending_charges:  number
}

interface AgentData {
  agents: Array<{
    id: string; name: string; hex: string; bg: string; border: string;
    icon: string; actionsToday: number; isActive: boolean; lastAction: string | null
  }>
  totalToday: number
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  Crown, TrendingUp, Megaphone, DollarSign,
  FolderKanban, Headphones, PenLine, BarChart3,
}
const ICON_BY_ID: Record<string, string> = {
  ceo: 'Crown', sales: 'TrendingUp', marketing: 'Megaphone',
  finance: 'DollarSign', projects: 'FolderKanban', support: 'Headphones',
  content: 'PenLine', analytics: 'BarChart3',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}M`
  if (n >= 1000)    return `R$ ${(n / 1000).toFixed(1)}k`
  return `R$ ${n.toFixed(0)}`
}

// ─── Animated number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const start = display
    const end = value
    const duration = 800
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <>{prefix}{display.toLocaleString('pt-BR')}</>
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricPanel({ m }: { m: Metric }) {
  const Icon = m.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 flex flex-col gap-3 group hover:border-white/15 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${m.accent}18` }}
        >
          <Icon className="w-4 h-4" style={{ color: m.accent }} />
        </div>
        {m.delta && (
          <div className={cn('flex items-center gap-1 text-xs font-semibold', m.delta.positive ? 'text-emerald-400' : 'text-red-400')}>
            {m.delta.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(m.delta.pct)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white leading-none tracking-tight">{m.value}</p>
        <p className="text-xs text-white/40 mt-1">{m.label}</p>
        {m.sub && <p className="text-[11px] text-white/25 mt-0.5">{m.sub}</p>}
      </div>
    </motion.div>
  )
}

// ─── Alert banner ─────────────────────────────────────────────────────────────

const ALERT_STYLE = {
  critical: { bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.25)',  dot: '#ef4444' },
  warning:  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', dot: '#f59e0b' },
  info:     { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)', dot: '#7c3aed' },
}

function AlertCard({ alert }: { alert: Alert }) {
  const s = ALERT_STYLE[alert.severity]
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
      className="rounded-xl p-3 flex items-start gap-3"
    >
      <div className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}` }} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-white/90">{alert.title}</p>
        <p className="text-[11px] text-white/45 mt-0.5 leading-relaxed">{alert.body}</p>
      </div>
      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5"
        style={{ color: alert.agentColor, background: `${alert.agentColor}18` }}>
        {alert.agent}
      </span>
    </motion.div>
  )
}

// ─── Agent status row ─────────────────────────────────────────────────────────

function AgentStatusRow({ agent }: { agent: AgentData['agents'][0] }) {
  const iconName = ICON_BY_ID[agent.id] ?? 'Zap'
  const Icon = ICONS[iconName] ?? Zap

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: agent.bg, boxShadow: agent.isActive ? `0 0 8px ${agent.hex}40` : 'none' }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: agent.hex }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-white/75">{agent.name}</p>
      </div>
      <div className="flex items-center gap-2">
        {agent.actionsToday > 0 && (
          <span className="text-[11px] font-bold tabular-nums" style={{ color: agent.hex }}>
            {agent.actionsToday}
          </span>
        )}
        {/* Activity bar */}
        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: agent.hex }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(agent.actionsToday * 10, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: agent.isActive ? '#10b981' : '#ffffff20', boxShadow: agent.isActive ? '0 0 5px #10b981' : 'none' }}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExecutivePage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [overview, setOverview]   = useState<OverviewData | null>(null)
  const [financial, setFinancial] = useState<FinancialData | null>(null)
  const [agents, setAgents]       = useState<AgentData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [tick, setTick]           = useState(0)

  // Derive alerts from data
  const alerts: Alert[] = []
  if (financial?.overdue_amount && financial.overdue_amount > 0) {
    alerts.push({
      severity:   'critical',
      title:      `R$ ${financial.overdue_amount.toFixed(0)} em atraso`,
      body:       'Cobranças vencidas detectadas. Acionar follow-up imediato.',
      agent:      'Finance',
      agentColor: '#dc2626',
    })
  }
  if (overview?.pipeline.hot === 0 && (overview?.pipeline.total ?? 0) > 5) {
    alerts.push({
      severity:   'warning',
      title:      'Nenhum lead quente no pipeline',
      body:       `${overview.pipeline.total} leads no CRM, nenhum classificado como quente.`,
      agent:      'Sales',
      agentColor: '#059669',
    })
  }
  if ((agents?.totalToday ?? 0) === 0) {
    alerts.push({
      severity:   'info',
      title:      'Agentes em standby',
      body:       'Nenhuma ação registrada hoje. Use o Engine para ativar.',
      agent:      'CEO',
      agentColor: '#7c3aed',
    })
  }

  const metrics: Metric[] = overview && financial ? [
    {
      label: 'Receita recebida',
      value: fmt(financial.revenue_received),
      accent: '#059669',
      icon: DollarSign,
    },
    {
      label: 'A receber',
      value: fmt(financial.pending_amount),
      accent: '#f59e0b',
      icon: CreditCard,
      sub: `${financial.pending_charges} cobranças`,
    },
    {
      label: 'Leads no pipeline',
      value: String(overview.pipeline.total),
      accent: '#7c3aed',
      icon: Users,
      sub: `${overview.pipeline.hot} quentes`,
    },
    {
      label: 'Mensagens hoje',
      value: String(overview.today.mensagens),
      accent: '#0891b2',
      icon: Activity,
    },
    {
      label: 'Leads hoje',
      value: String(overview.today.leads_novos),
      accent: '#ec4899',
      icon: Target,
    },
    {
      label: 'Ações dos agentes',
      value: String(agents?.totalToday ?? 0),
      accent: '#16a34a',
      icon: Zap,
      sub: `${agents?.agents.filter(a => a.isActive).length ?? 0} ativos`,
    },
  ] : []

  const load = useCallback(async (cid: string) => {
    const [ov, fin, ag] = await Promise.allSettled([
      fetch(`/api/nexus/overview?company_id=${cid}`).then(r => r.json()),
      fetch('/api/agents/orchestrate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: 'resumo financeiro rápido' }),
      }).then(() => fetch('/api/nexus/overview?company_id=' + cid).then(r => r.json())).catch(() => null),
      fetch('/api/agents/status').then(r => r.json()),
    ])

    if (ov.status === 'fulfilled') setOverview(ov.value)
    if (ag.status === 'fulfilled') setAgents(ag.value)

    // Fetch financial separately
    try {
      const finRes = await fetch('/api/nexus/overview?company_id=' + cid)
      // financial data comes from overview for now; agents/orchestrate for real
    } catch { /* */ }

    setLoading(false)
  }, [])

  // Simpler: fetch overview + agents status
  const loadFast = useCallback(async (cid: string) => {
    const [ovRes, agRes] = await Promise.allSettled([
      fetch(`/api/nexus/overview?company_id=${cid}`).then(r => r.json()),
      fetch('/api/agents/status').then(r => r.json()),
    ])
    if (ovRes.status === 'fulfilled') setOverview(ovRes.value)
    if (agRes.status === 'fulfilled') setAgents(agRes.value)
    setLoading(false)
  }, [])

  useEffect(() => { resolveCompanyId().then(setCompanyId) }, [])
  useEffect(() => {
    if (companyId) {
      loadFast(companyId)
      const t = setInterval(() => {
        loadFast(companyId)
        setTick(n => n + 1)
      }, 30000)
      return () => clearInterval(t)
    }
  }, [companyId, loadFast])

  if (!companyId) return null

  return (
    <div className="min-h-screen bg-[#050508] text-white p-4 lg:p-6 space-y-4 font-mono">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: '0 0 8px #10b981' }} />
            <span className="text-[11px] text-white/30 uppercase tracking-widest">NEXUS OS</span>
          </div>
          <span className="text-white/10">|</span>
          <span className="text-[11px] text-white/20">{new Date().toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5 font-semibold uppercase tracking-wider">
            Executive Mode
          </span>
          <button
            onClick={() => companyId && loadFast(companyId)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/8 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 text-white/30', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left column: metrics + alerts */}
        <div className="lg:col-span-2 space-y-4">

          {/* Metric grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] h-28 animate-pulse" />
                ))
              : metrics.map((m, i) => <MetricPanel key={i} m={m} />)
            }
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/20 uppercase tracking-widest px-1">Alertas críticos</p>
              <AnimatePresence mode="popLayout">
                {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
              </AnimatePresence>
            </div>
          )}

          {/* Live feed */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden" style={{ height: 400 }}>
            <LiveFeed companyId={companyId} className="h-full" />
          </div>
        </div>

        {/* Right column: agents + quick commands */}
        <div className="space-y-4">

          {/* Agent status */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Agentes</p>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {agents?.agents.filter(a => a.isActive).length ?? 0} / {agents?.agents.length ?? 8} online
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {agents
                ? agents.agents.map(a => <AgentStatusRow key={a.id} agent={a} />)
                : Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="py-2 h-9 bg-white/[0.02] rounded animate-pulse my-1" />
                  ))
              }
            </div>
          </div>

          {/* Quick commands */}
          <QuickCommands />

          {/* System status */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[10px] text-white/25 uppercase tracking-widest">Sistema</p>
            {[
              { label: 'NEXUS Engine',   status: 'online',   dot: '#10b981' },
              { label: 'Realtime Feed',  status: 'ativo',    dot: '#10b981' },
              { label: 'AI Agents',      status: `${agents?.agents.filter(a => a.isActive).length ?? 0} ativos`, dot: '#7c3aed' },
              { label: 'CRM Sync',       status: 'sincronizado', dot: '#10b981' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-[11px] text-white/40">{s.label}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot, boxShadow: `0 0 5px ${s.dot}` }} />
                  <span className="text-[11px] text-white/60">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Quick commands ───────────────────────────────────────────────────────────

const QUICK_CMDS = [
  { label: 'Pipeline overview',    msg: 'me dê um overview completo do pipeline', color: '#059669' },
  { label: 'Leads quentes',        msg: 'quais leads estão quentes agora?',        color: '#f59e0b' },
  { label: 'Status financeiro',    msg: 'qual é o status financeiro da empresa?',  color: '#dc2626' },
  { label: 'Projetos em risco',    msg: 'tem algum projeto com risco de atraso?',  color: '#0891b2' },
]

function QuickCommands() {
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function run(cmd: { label: string; msg: string }) {
    setLoading(cmd.label)
    setResult(null)
    try {
      const res = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cmd.msg }),
      })
      const data = await res.json()
      setResult(data.message ?? 'Concluído.')
    } catch { setResult('Erro ao executar.') }
    finally { setLoading(null) }
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
      <p className="text-[10px] text-white/25 uppercase tracking-widest">Comandos rápidos</p>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_CMDS.map(cmd => (
          <button
            key={cmd.label}
            onClick={() => run(cmd)}
            disabled={!!loading}
            className="text-left text-[11px] px-3 py-2.5 rounded-xl border border-white/8 hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.04] text-white/50 hover:text-white/80 transition-all disabled:opacity-40"
          >
            {loading === cmd.label ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" style={{ color: cmd.color }} />
                executando...
              </span>
            ) : (
              <span>
                <span className="block w-1.5 h-1.5 rounded-full mb-1.5" style={{ background: cmd.color }} />
                {cmd.label}
              </span>
            )}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white/[0.03] border border-white/8 rounded-xl p-3 overflow-hidden"
          >
            <p className="text-[11px] text-white/60 leading-relaxed whitespace-pre-wrap line-clamp-6">{result}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
