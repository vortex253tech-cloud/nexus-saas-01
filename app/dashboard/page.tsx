'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Activity, TrendingUp, AlertTriangle, DollarSign,
  Zap, BarChart3, Bell, Settings, ArrowRight,
  CheckCircle2, Circle, Loader2, ChevronDown, ChevronUp,
  X, ShieldAlert, Lightbulb, TrendingDown, Database,
  RefreshCw, Lock, Sparkles, Play, History, Mail,
  MessageSquare, Megaphone, ClipboardList, LineChart, Bot,
  Flame, Clock, TrendingUp as Impact,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { gerarDiagnostico } from '@/lib/diagnostico'
import { gerarInsights } from '@/lib/insights'
import { gerarAlertas } from '@/lib/alertas'
import { getFeatures, isAtLeast } from '@/lib/plan-gates'
import { calcularProjection, getSocialProof } from '@/lib/projection'
import type { InsightAcao } from '@/lib/insights'
import type { Alerta, AlertaTipo } from '@/lib/alertas'
import type { Diagnostico } from '@/lib/diagnostico'
import type { DBAction, DBAlert, DBFinancialData, Plan } from '@/lib/db'

// ─── Types ─────────────────────────────────────────────────────

interface SessionData {
  nomeEmpresa?: string
  email?: string
  nome?: string
  perfil?: string
  setor?: string
  metaMensal?: number
  principalDesafio?: string
  company_id?: string
  companyId?: string
  stage?: string
  revenueRange?: string
}

type ActiveTab = 'insights' | 'alertas' | 'historico'
type ExecutionType = 'email' | 'whatsapp' | 'ads' | 'recommendation' | 'analytics'
type ExtendedDBAction = DBAction & {
  auto_executable?: boolean
  execution_type?: string | null
  effort_level?: string | null
  urgencia?: string | null
}

interface UnifiedInsight {
  id: string
  titulo: string
  descricao: string
  detalhe: string
  impacto_estimado: number
  ganho_realizado: number
  prazo: string
  prioridade: 'critica' | 'alta' | 'media'
  urgencia: 'alta' | 'media' | 'baixa'
  categoria: string
  icone: string
  passos: string[]
  status: 'pending' | 'in_progress' | 'done'
  isReal: boolean
  auto_executable: boolean
  execution_type: ExecutionType
  effort_level: 'low' | 'medium' | 'high'
}

function parseExecutionType(value: string | null | undefined): ExecutionType {
  switch (value) {
    case 'email':
    case 'whatsapp':
    case 'ads':
    case 'analytics':
    case 'recommendation':
      return value
    default:
      return 'recommendation'
  }
}

function parseEffortLevel(value: string | null | undefined): UnifiedInsight['effort_level'] {
  switch (value) {
    case 'low':
    case 'medium':
    case 'high':
      return value
    default:
      return 'medium'
  }
}

function parseUrgencia(value: string | null | undefined): UnifiedInsight['urgencia'] {
  switch (value) {
    case 'alta':
    case 'media':
    case 'baixa':
      return value
    default:
      return 'media'
  }
}

interface ExecutionHistoryItem {
  id: string
  titulo: string
  execution_type: string
  ganho_realizado: number
  execution_log: string | null
  executed_at: string
}

interface UnifiedAlerta {
  id: string
  tipo: string
  titulo: string
  descricao: string
  impacto: string
  lido: boolean
  isReal: boolean
}

// ─── Helpers ───────────────────────────────────────────────────

function fmtBRL(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1000).toFixed(1)}k`
  return `R$ ${Math.round(v)}`
}

function fmtBRLExact(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function alertaStyle(tipo: AlertaTipo | string) {
  switch (tipo) {
    case 'perigo':       return { border: 'border-red-800/50',     bg: 'bg-red-950/30',     dot: 'bg-red-400',     text: 'text-red-300' }
    case 'atencao':      return { border: 'border-amber-800/50',   bg: 'bg-amber-950/30',   dot: 'bg-amber-400',   text: 'text-amber-300' }
    case 'oportunidade': return { border: 'border-emerald-800/50', bg: 'bg-emerald-950/30', dot: 'bg-emerald-400', text: 'text-emerald-300' }
    default:             return { border: 'border-blue-800/50',    bg: 'bg-blue-950/30',    dot: 'bg-blue-400',    text: 'text-blue-300' }
  }
}

function AlertaIcon({ tipo }: { tipo: string }) {
  if (tipo === 'perigo')       return <ShieldAlert className="h-4 w-4 text-red-400" />
  if (tipo === 'atencao')      return <AlertTriangle className="h-4 w-4 text-amber-400" />
  if (tipo === 'oportunidade') return <Lightbulb className="h-4 w-4 text-emerald-400" />
  return <TrendingDown className="h-4 w-4 text-blue-400" />
}

function ExecutionTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn('h-3.5 w-3.5', className)
  if (type === 'email')     return <Mail className={cls} />
  if (type === 'whatsapp')  return <MessageSquare className={cls} />
  if (type === 'ads')       return <Megaphone className={cls} />
  if (type === 'analytics') return <LineChart className={cls} />
  return <ClipboardList className={cls} />
}

function executionTypeLabel(type: string) {
  const map: Record<string, string> = {
    email: 'E-mail', whatsapp: 'WhatsApp', ads: 'Ads',
    recommendation: 'Recomendação', analytics: 'Análise',
  }
  return map[type] ?? type
}

// Dynamic CTA text based on ganho potencial
function ctaText(ganho: number, recovered: number): string {
  const remaining = ganho - recovered
  if (remaining > 5000) return `Recuperar ${fmtBRL(remaining)} agora`
  if (remaining > 2000) return 'Começar a recuperar dinheiro'
  return 'Otimizar minha operação'
}

// ─── Animated counter ──────────────────────────────────────────

function AnimCounter({ value, className }: { value: number; className?: string }) {
  const [displayed, setDisplayed] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const diff = value - prev.current
    if (diff === 0) return
    const steps = 30
    let step = 0
    const t = setInterval(() => {
      step++
      prev.current = Math.round(prev.current + (diff * step) / steps)
      setDisplayed(prev.current)
      if (step >= steps) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  }, [value])
  return <span className={className}>{fmtBRL(displayed)}</span>
}

// ─── Phase 1+2: Urgency banner + money leak counter ────────────

function UrgencyBanner({ ganho, recovered }: { ganho: number; recovered: number }) {
  const [leaked, setLeaked] = useState(0)
  const perSecond = ganho / 30 / 24 / 3600

  // Seed with hours already passed today
  useEffect(() => {
    const now = new Date()
    const secondsPassed = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
    setLeaked(perSecond * secondsPassed)
  }, [perSecond])

  // Tick every second
  useEffect(() => {
    const t = setInterval(() => setLeaked(v => v + perSecond), 1000)
    return () => clearInterval(t)
  }, [perSecond])

  if (ganho <= 5000) return null

  const remaining = ganho - recovered

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-5 overflow-hidden rounded-2xl"
    >
      {/* Gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-950/80 via-violet-950/80 to-red-950/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.15)_0%,transparent_70%)]" />
      {/* Pulsing top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent animate-pulse" />

      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20">
            <Flame className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              Você está perdendo{' '}
              <span className="text-red-300">{fmtBRLExact(remaining)}/mês</span>{' '}
              neste exato momento
            </p>
            {/* Live ticking counter */}
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              <p className="text-xs text-zinc-400">
                Perdido hoje:{' '}
                <span className="font-mono font-semibold text-red-300">
                  {fmtBRLExact(leaked)}
                </span>
                {' '}e contando...
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/upgrade"
          onClick={() => sessionStorage.setItem('nexus_ganho_potencial', String(ganho))}
          className="shrink-0 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] transition hover:bg-red-400 active:scale-[0.97]"
        >
          {ctaText(ganho, recovered)}
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Phase 5: Recovery progress bar ───────────────────────────

function RecoveryProgress({ recovered, total }: { recovered: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (recovered / total) * 100) : 0
  return (
    <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400">
          Você recuperou{' '}
          <span className="font-semibold text-white">{Math.round(pct)}%</span>{' '}
          de{' '}
          <span className="font-semibold text-violet-300">{fmtBRL(total)}</span>
          {' '}identificados
        </span>
        {recovered > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {fmtBRL(recovered)} recuperado
          </span>
        )}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className={cn(
            'h-full rounded-full',
            pct >= 50
              ? 'bg-gradient-to-r from-violet-600 to-emerald-500'
              : pct > 0
                ? 'bg-gradient-to-r from-violet-600 to-violet-400'
                : 'bg-zinc-700',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      {pct === 0 && (
        <p className="mt-2 text-[11px] text-zinc-600">
          Execute a primeira ação para começar a recuperar seu dinheiro
        </p>
      )}
    </div>
  )
}

// ─── Phase 6: Social proof ────────────────────────────────────

function SocialProofBlock({ perfil }: { perfil: string }) {
  const proof = getSocialProof(perfil)
  return (
    <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {proof.totalEmpresas} {proof.empresaTipo} já recuperaram:
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/20 p-3 text-center">
          <p className="text-xl font-bold text-emerald-300">+{fmtBRL(proof.ganho7d)}</p>
          <p className="text-xs text-zinc-500">em 7 dias</p>
        </div>
        <div className="rounded-xl border border-violet-800/30 bg-violet-950/20 p-3 text-center">
          <p className="text-xl font-bold text-violet-300">+{fmtBRL(proof.ganho30d)}</p>
          <p className="text-xs text-zinc-500">em 30 dias</p>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <p className="text-sm italic text-zinc-400">"{proof.depoimento}"</p>
        <p className="mt-1.5 text-[11px] text-zinc-600">— Empresa do mesmo segmento</p>
      </div>
    </div>
  )
}

// ─── Phase 3+8: Upgrade modal ─────────────────────────────────

interface UpgradeModalProps {
  isOpen: boolean
  type: 'action' | 'autopilot'
  insight?: UnifiedInsight
  totalGanho: number
  onClose: () => void
}

function UpgradeModal({ isOpen, type, insight, totalGanho, onClose }: UpgradeModalProps) {
  if (!isOpen) return null

  const valor = insight?.impacto_estimado ?? totalGanho

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ type: 'spring', damping: 20 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-violet-700/50 bg-zinc-900"
        >
          {/* Top glow */}
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-400"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-6 pt-8 text-center">
            {type === 'action' ? (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20">
                  <DollarSign className="h-7 w-7 text-violet-400" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-white">
                  Essa ação pode recuperar
                </h2>
                <p className="mb-1 text-3xl font-bold text-emerald-300">
                  {fmtBRLExact(valor)}/mês
                </p>
                {insight && (
                  <p className="mb-5 text-sm text-zinc-400">"{insight.titulo}"</p>
                )}
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20">
                  <Bot className="h-7 w-7 text-violet-400" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-white">
                  Deixe a IA recuperar esse
                  <br />dinheiro automaticamente
                </h2>
                <p className="mb-5 text-sm text-zinc-400">
                  O Auto-Pilot executa todas as ações enquanto você foca no que importa.
                  <br />
                  <span className="mt-1 block font-semibold text-violet-300">
                    Potencial: {fmtBRL(totalGanho)}/mês
                  </span>
                </p>
              </>
            )}

            {/* What's included */}
            <div className="mb-5 space-y-2 text-left">
              {[
                'Execução automática de ações',
                'Insights ilimitados da IA',
                'Alertas WhatsApp + e-mail',
                'Gráfico de evolução financeira',
              ].map(f => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </div>
              ))}
            </div>

            <Link
              href="/dashboard/upgrade"
              onClick={() => sessionStorage.setItem('nexus_ganho_potencial', String(totalGanho))}
              className="block w-full rounded-xl bg-violet-600 py-3.5 text-center text-sm font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] transition hover:bg-violet-500 active:scale-[0.98]"
            >
              Começar a recuperar dinheiro
            </Link>
            <p className="mt-2 text-xs text-zinc-600">7 dias grátis · Cancele quando quiser</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Plan gate overlay ─────────────────────────────────────────

function PlanGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {children}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/80 backdrop-blur-sm">
        <Lock className="h-6 w-6 text-zinc-500" />
        <div className="text-center">
          <p className="text-sm font-semibold text-white">{feature}</p>
          <p className="mt-0.5 text-xs text-zinc-400">Disponível no plano Pro</p>
        </div>
        <Link href="/dashboard/upgrade" className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition">
          <Zap className="h-3 w-3" /> Começar a recuperar dinheiro
        </Link>
      </div>
    </div>
  )
}

// ─── Phase 4+10: Insight card with badges + priority highlight ─

function PrioridadeBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    critica: 'bg-red-500/15 text-red-300 border-red-500/30',
    alta:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
    media:   'bg-blue-500/15 text-blue-300 border-blue-500/30',
  }
  const label: Record<string, string> = { critica: 'Crítica', alta: 'Alta', media: 'Média' }
  return (
    <span className={cn('rounded-md border px-1.5 py-0.5 text-xs font-medium', map[p] ?? map.media)}>
      {label[p] ?? p}
    </span>
  )
}

// Phase 10: badges based on urgency + effort + impact
function getInsightBadges(insight: UnifiedInsight): { icon: string; label: string; className: string }[] {
  const badges = []
  if (insight.urgencia === 'alta' || insight.prioridade === 'critica') {
    badges.push({ icon: '🔥', label: 'Dinheiro perdido agora', className: 'border-red-700/40 bg-red-950/30 text-red-300' })
  }
  if (insight.effort_level === 'low') {
    badges.push({ icon: '⚡', label: 'Rápido de implementar', className: 'border-amber-700/40 bg-amber-950/30 text-amber-300' })
  }
  if (insight.impacto_estimado >= 3000) {
    badges.push({ icon: '💰', label: 'Alto impacto', className: 'border-emerald-700/40 bg-emerald-950/30 text-emerald-300' })
  }
  return badges
}

interface InsightCardProps {
  insight: UnifiedInsight
  index: number
  plan: Plan
  isFirst: boolean
  onStatusChange: (id: string, status: UnifiedInsight['status'], ganho?: number) => void
  onPaywallTrigger: (insight: UnifiedInsight) => void
}

function InsightCard({ insight, index, plan, isFirst, onStatusChange, onPaywallTrigger }: InsightCardProps) {
  const [expanded, setExpanded] = useState(isFirst) // auto-expand #1
  const [passosFeitos, setPassosFeitos] = useState<boolean[]>(
    () => Array(insight.passos.length).fill(false)
  )
  const [updating, setUpdating] = useState(false)
  const [execLog, setExecLog] = useState<string | null>(null)

  const isFree = plan === 'free'
  const isConcluido = insight.status === 'done'
  const isExecutando = insight.status === 'in_progress'
  const todosFeitos = passosFeitos.every(Boolean)
  const canAutoExec = insight.auto_executable && insight.isReal

  const badges = getInsightBadges(insight)

  function togglePasso(i: number) {
    setPassosFeitos(prev => { const n = [...prev]; n[i] = !n[i]; return n })
  }

  async function handleAcao() {
    if (isConcluido || updating) return

    // Phase 3: intercept free users
    if (isFree && insight.status === 'pending') {
      onPaywallTrigger(insight)
      return
    }

    if (canAutoExec && insight.status === 'pending') {
      setUpdating(true)
      try {
        onStatusChange(insight.id, 'in_progress')
        const res = await fetch('/api/actions/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_id: insight.id }),
        })
        const json = await res.json()
        if (res.ok) {
          setExecLog(json.data?.log ?? null)
          onStatusChange(insight.id, 'done', json.data?.ganho_realizado ?? insight.impacto_estimado)
        } else {
          onStatusChange(insight.id, 'pending')
        }
      } finally {
        setUpdating(false)
      }
      return
    }

    const next = insight.status === 'pending' ? 'in_progress' : 'done'
    if (insight.status === 'in_progress' && !todosFeitos) return
    setUpdating(true)
    try {
      if (insight.isReal) {
        await fetch(`/api/actions/${insight.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        })
      }
      onStatusChange(insight.id, next, next === 'done' ? insight.impacto_estimado : 0)
      if (next === 'in_progress') setExpanded(true)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.35 }}
      className={cn(
        'overflow-hidden rounded-2xl border transition-all duration-300',
        isConcluido
          ? 'border-emerald-800/40 bg-emerald-950/20'
          : isFirst
            ? 'border-violet-600/50 bg-violet-950/20 shadow-[0_0_24px_rgba(124,58,237,0.12)]'
            : 'border-zinc-800 bg-zinc-900/60',
      )}
    >
      {/* Top line: critical = red, first = violet */}
      {(insight.prioridade === 'critica' || isFirst) && !isConcluido && (
        <div className={cn(
          'h-0.5 w-full bg-gradient-to-r from-transparent to-transparent',
          insight.prioridade === 'critica'
            ? 'via-red-500/60'
            : 'via-violet-500/50',
        )} />
      )}

      <div className="p-5">
        {/* Phase 4: "COMECE POR AQUI" badge */}
        {isFirst && !isConcluido && (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-600/40 bg-violet-600/10 px-2.5 py-1">
            <Zap className="h-3 w-3 text-violet-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300">Comece por aqui</span>
          </div>
        )}

        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg',
              isConcluido ? 'bg-emerald-500/15' : isFirst ? 'bg-violet-600/20' : 'bg-zinc-800',
            )}>
              {isConcluido ? '✅' : insight.icone}
            </div>
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <PrioridadeBadge p={insight.prioridade} />
                <span className="text-xs text-zinc-500">{insight.prazo}</span>
                {insight.isReal && (
                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-violet-400">
                    <Sparkles className="h-2.5 w-2.5" /> IA Real
                  </span>
                )}
              </div>
              {/* Phase 10 badges */}
              {badges.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {badges.map(b => (
                    <span key={b.label} className={cn('flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', b.className)}>
                      {b.icon} {b.label}
                    </span>
                  ))}
                </div>
              )}
              <h3 className={cn(
                'text-sm font-semibold leading-snug',
                isConcluido ? 'text-emerald-300 line-through opacity-70' : 'text-white',
              )}>
                {insight.titulo}
              </h3>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {isConcluido && <span className="flex items-center gap-1 text-xs font-medium text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Concluído</span>}
            {isExecutando && <span className="flex items-center gap-1 text-xs font-medium text-violet-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Executando</span>}
            {insight.status === 'pending' && <span className="flex items-center gap-1 text-xs font-medium text-zinc-500"><Circle className="h-3.5 w-3.5" /> Pendente</span>}
          </div>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-zinc-400">{insight.descricao}</p>

        {execLog && (
          <div className="mb-4 rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3">
            <p className="text-[11px] font-mono text-emerald-400">{execLog}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Impact pill */}
          <div className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-1.5',
            isConcluido ? 'border-emerald-800/40 bg-emerald-950/30' : 'border-emerald-800/40 bg-emerald-950/30',
          )}>
            {isConcluido ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">+{fmtBRL(insight.ganho_realizado)}/mês recuperado</span></>
            ) : (
              <><TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">+{fmtBRL(insight.impacto_estimado)}/mês estimado</span></>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Fechar' : 'Ver passos'}
            </button>

            {!isConcluido && (
              <button
                onClick={handleAcao}
                disabled={updating || (isExecutando && !todosFeitos && !canAutoExec)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition-all active:scale-[0.97]',
                  // Free: always violet (triggers modal)
                  isFree && insight.status === 'pending'
                    ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                    : canAutoExec && insight.status === 'pending'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : insight.status === 'pending'
                        ? 'bg-violet-600 text-white hover:bg-violet-500'
                        : todosFeitos
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'cursor-not-allowed bg-zinc-700 text-zinc-500',
                )}
              >
                {updating && <Loader2 className="h-3 w-3 animate-spin" />}
                {!updating && insight.status === 'pending' && canAutoExec && <><Play className="h-3 w-3" /> Executar agora</>}
                {!updating && insight.status === 'pending' && !canAutoExec && <><Zap className="h-3 w-3" /> {isFree ? 'Recuperar agora' : 'Iniciar ação'}</>}
                {!updating && isExecutando && todosFeitos && <><CheckCircle2 className="h-3 w-3" /> Concluir</>}
                {!updating && isExecutando && !todosFeitos && <><Loader2 className="h-3 w-3 animate-spin" /> Fazendo...</>}
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Como executar</p>
                <p className="mb-4 text-sm leading-relaxed text-zinc-400">{insight.detalhe}</p>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Checklist</p>
                <ul className="space-y-2">
                  {insight.passos.map((passo, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <button onClick={() => togglePasso(i)} disabled={isConcluido} className="mt-0.5 shrink-0">
                        {passosFeitos[i]
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          : <Circle className="h-4 w-4 text-zinc-600" />}
                      </button>
                      <span className={cn('text-sm', passosFeitos[i] ? 'text-zinc-500 line-through' : 'text-zinc-300')}>
                        {passo}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Alerta card ───────────────────────────────────────────────

function AlertaCard({ alerta, onDismiss }: { alerta: UnifiedAlerta; onDismiss: (id: string) => void }) {
  const s = alertaStyle(alerta.tipo)
  return (
    <motion.div layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
      className={cn('flex items-start gap-3 rounded-xl border p-4', s.border, s.bg, alerta.lido && 'opacity-60')}
    >
      <div className="mt-0.5 shrink-0"><AlertaIcon tipo={alerta.tipo} /></div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <p className={cn('text-sm font-semibold', s.text)}>{alerta.titulo}</p>
          <button onClick={() => onDismiss(alerta.id)} className="shrink-0 text-zinc-600 transition hover:text-zinc-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-zinc-400">{alerta.descricao}</p>
        <div className="mt-2 flex items-center gap-3">
          <span className={cn('text-xs font-semibold', s.text)}>{alerta.impacto}</span>
          {!alerta.lido && <div className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Histórico card ───────────────────────────────────────────

function HistoricoCard({ item, index }: { item: ExecutionHistoryItem; index: number }) {
  const [showLog, setShowLog] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * index }} className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-700/50 bg-emerald-950/50">
          <ExecutionTypeIcon type={item.execution_type} className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <div className="mt-1 flex-1 w-px bg-zinc-800" />
      </div>
      <div className="mb-4 flex-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-1 flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-white">{item.titulo}</p>
          <span className="shrink-0 text-xs font-bold text-emerald-400">+{fmtBRL(item.ganho_realizado)}</span>
        </div>
        <div className="mb-2 flex items-center gap-3">
          <span className="text-[11px] text-zinc-500">{executionTypeLabel(item.execution_type)}</span>
          <span className="text-[11px] text-zinc-600">{fmtDate(item.executed_at)}</span>
        </div>
        {item.execution_log && (
          <>
            <button onClick={() => setShowLog(v => !v)} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition">
              {showLog ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} {showLog ? 'Ocultar log' : 'Ver log'}
            </button>
            <AnimatePresence>
              {showLog && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-[11px] font-mono leading-relaxed text-emerald-400/80">{item.execution_log}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ─── Phase 8: Auto-pilot control ─────────────────────────────

interface AutoPilotProps {
  enabled: boolean
  running: boolean
  autoCount: number
  plan: Plan
  totalGanho: number
  onToggle: () => void
  onPaywall: () => void
}

function AutoPilotControl({ enabled, running, autoCount, plan, totalGanho, onToggle, onPaywall }: AutoPilotProps) {
  const canAutoRun = isAtLeast(plan, 'starter')
  function handleClick() {
    if (!canAutoRun) { onPaywall(); return }
    onToggle()
  }
  return (
    <div className={cn(
      'mb-6 flex items-center justify-between gap-4 rounded-2xl border p-4 transition-colors',
      enabled && canAutoRun ? 'border-violet-700/50 bg-violet-950/30' : 'border-zinc-800 bg-zinc-900/40',
    )}>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors', enabled && canAutoRun ? 'bg-violet-600/30' : 'bg-zinc-800')}>
          <Bot className={cn('h-5 w-5', enabled && canAutoRun ? 'text-violet-300' : 'text-zinc-500')} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">Auto-Pilot</p>
            {!canAutoRun && <span className="flex items-center gap-1 rounded-md border border-amber-700/50 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"><Lock className="h-2.5 w-2.5" /> Pro</span>}
            {running && <span className="flex items-center gap-1 text-xs font-medium text-violet-400"><Loader2 className="h-3 w-3 animate-spin" /> Executando...</span>}
          </div>
          <p className="text-xs text-zinc-500">
            {!canAutoRun
              ? `Recupere ${fmtBRL(totalGanho)} automaticamente com o Pro`
              : autoCount > 0 ? `${autoCount} ação${autoCount > 1 ? 'ões' : ''} prontas para execução automática`
                : 'Nenhuma ação automática pendente'}
          </p>
        </div>
      </div>
      {autoCount > 0 && (
        <button
          onClick={handleClick}
          disabled={running}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-[0.97]',
            running ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
              : enabled && canAutoRun ? 'bg-red-600/80 text-white hover:bg-red-500'
                : 'bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_16px_rgba(124,58,237,0.3)]',
          )}
        >
          {running ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguarde</>
            : enabled && canAutoRun ? <><X className="h-3.5 w-3.5" /> Parar</>
              : <><Play className="h-3.5 w-3.5" /> Iniciar Auto-Pilot</>}
        </button>
      )}
    </div>
  )
}

// ─── AI Generate bar ──────────────────────────────────────────

function AIGenerateBar({ onGenerate, generating, hasApiKey, plan, lastGenerated }: {
  onGenerate: () => void; generating: boolean; hasApiKey: boolean; plan: Plan; lastGenerated: Date | null
}) {
  const canAI = isAtLeast(plan, 'starter') && hasApiKey
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', canAI ? 'bg-violet-600/20' : 'bg-zinc-800')}>
          <Sparkles className={cn('h-4 w-4', canAI ? 'text-violet-400' : 'text-zinc-600')} />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">{canAI ? 'IA Real ativa' : 'IA simulada (modo demo)'}</p>
          <p className="text-[11px] text-zinc-500">
            {lastGenerated
              ? `Última análise: ${lastGenerated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : canAI ? 'Clique para gerar análise com dados reais' : 'Configure ANTHROPIC_API_KEY para IA real'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/dashboard/dados" className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white">
          <Database className="h-3 w-3" /> Dados
        </Link>
        <button
          onClick={onGenerate}
          disabled={generating || !canAI}
          className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
            canAI && !generating ? 'bg-violet-600 text-white hover:bg-violet-500' : 'cursor-not-allowed bg-zinc-800 text-zinc-500')}
        >
          {generating ? <><Loader2 className="h-3 w-3 animate-spin" /> Analisando...</> : <><RefreshCw className="h-3 w-3" /> Gerar análise</>}
        </button>
      </div>
    </div>
  )
}

// ─── Phase 7: Return notification (localStorage) ──────────────

function ReturnNotif({ ganho, onClose }: { ganho: number; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-800/50 bg-amber-950/20 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <Clock className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm text-amber-300">
          Você deixou <span className="font-bold">{fmtBRL(ganho)}</span> na mesa ontem. Ainda dá tempo de recuperar.
        </p>
      </div>
      <button onClick={onClose} className="shrink-0 text-zinc-600 hover:text-zinc-400 transition">
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export default function DashboardPage() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [plan, setPlan] = useState<Plan>('free')
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [financialData, setFinancialData] = useState<DBFinancialData[]>([])
  const [insights, setInsights] = useState<UnifiedInsight[]>([])
  const [alertas, setAlertas] = useState<UnifiedAlerta[]>([])
  const [historico, setHistorico] = useState<ExecutionHistoryItem[]>([])
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null)
  const [ganhoAcumulado, setGanhoAcumulado] = useState(0)

  const [generating, setGenerating] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [autopilotRunning, setAutopilotRunning] = useState(false)
  const autopilotCancelRef = useRef(false)

  // Modals & notifications
  const [modal, setModal] = useState<{ open: boolean; type: 'action' | 'autopilot'; insight?: UnifiedInsight }>({ open: false, type: 'action' })
  const [returnNotif, setReturnNotif] = useState(false)

  const [activeTab, setActiveTab] = useState<ActiveTab>('insights')
  const [loading, setLoading] = useState(true)

  const features = getFeatures(plan)

  // ─── Boot ─────────────────────────────────────────────────

  useEffect(() => {
    async function boot() {
      try {
        // ── Phase 7: check last visit ────────────────────────
        const lastVisitKey = 'nexus_last_visit'
        const lastVisit = localStorage.getItem(lastVisitKey)
        if (lastVisit) {
          const diff = Date.now() - Number(lastVisit)
          if (diff > 12 * 3600 * 1000) setReturnNotif(true)
        }
        localStorage.setItem(lastVisitKey, String(Date.now()))

        const keyRes = await fetch('/api/check-config').catch(() => null)
        if (keyRes?.ok) {
          const cfg = await keyRes.json() as Record<string, unknown>
          setHasApiKey(cfg.hasAnthropicKey === true)
        }

        // ── Primary: get company from authenticated session ──
        let cid: string | null = null
        let data: SessionData = {}

        const sessionRes = await fetch('/api/auth/session').catch(() => null)
        if (sessionRes?.ok) {
          const sessionJson = await sessionRes.json() as {
            authenticated: boolean
            user?: { id: string; email: string; name: string | null; plan: string }
            company?: { id: string; name: string; perfil: string | null; email: string | null }
            companyId?: string
          }
          if (sessionJson.authenticated && sessionJson.companyId) {
            cid = sessionJson.companyId
            setPlan((sessionJson.user?.plan ?? 'free') as Plan)
            data = {
              email: sessionJson.user?.email,
              nome: sessionJson.user?.name ?? undefined,
              nomeEmpresa: sessionJson.company?.name,
              perfil: sessionJson.company?.perfil ?? undefined,
              company_id: cid,
            }
            console.log('[dashboard] SESSION — user:', sessionJson.user?.email, '| company:', cid)
          }
        }

        // ── Fallback: sessionStorage (onboarding flow) ───────
        if (!cid) {
          const raw = sessionStorage.getItem('nexus_resultado')
          if (raw) {
            const stored = JSON.parse(raw) as SessionData
            data = stored
            cid = stored.company_id ?? stored.companyId ?? null

            if (!cid && stored.email) {
              const res = await fetch('/api/company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: stored.email, name: stored.nome ?? null,
                  nomeEmpresa: stored.nomeEmpresa ?? 'Minha Empresa',
                  perfil: stored.perfil ?? 'outro', setor: stored.setor ?? null,
                }),
              }).catch(() => null)
              if (res?.ok) {
                const json = await res.json() as { company?: { id: string; ganho_acumulado?: number }; user?: { plan?: string } }
                cid = json.company?.id ?? null
                setPlan((json.user?.plan ?? 'free') as Plan)
                setGanhoAcumulado(json.company?.ganho_acumulado ?? 0)
                if (cid) sessionStorage.setItem('nexus_resultado', JSON.stringify({ ...stored, company_id: cid }))
              }
            }
          }
        }

        if (!cid) { setLoading(false); return }
        setSession(data)
        setCompanyId(cid)

        const diagInput = { ...data, perfil: (data.perfil ?? null) as import('@/lib/types').Perfil | null }
        setDiagnostico(gerarDiagnostico(diagInput))

        if (cid) {
          const [fdRes, actRes, alertRes, histRes] = await Promise.all([
            fetch(`/api/financial-data?company_id=${cid}`).catch(() => null),
            fetch(`/api/actions?company_id=${cid}`).catch(() => null),
            fetch(`/api/alerts?company_id=${cid}`).catch(() => null),
            fetch(`/api/execution-history?company_id=${cid}`).catch(() => null),
          ])
          if (fdRes?.ok) { const fd = await fdRes.json(); setFinancialData(fd.data ?? []) }

          let hasReal = false
          if (actRes?.ok) {
            const aj = await actRes.json()
            if (aj.data?.length > 0) { hasReal = true; setInsights(mapActions(aj.data)) }
          }
          let hasRealAlerts = false
          if (alertRes?.ok) {
            const alj = await alertRes.json()
            if (alj.data?.length > 0) {
              hasRealAlerts = true
              setAlertas(alj.data.map((a: DBAlert) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, descricao: a.descricao ?? '', impacto: a.impacto ?? '', lido: a.lido, isReal: true })))
            }
          }
          if (histRes?.ok) { const hj = await histRes.json(); setHistorico(hj.data ?? []) }
          if (!hasReal) fallbackMock(diagInput)
          if (!hasRealAlerts) fallbackAlerts(diagInput)
        } else {
          const diagInput2 = { ...data, perfil: (data.perfil ?? null) as import('@/lib/types').Perfil | null }
          fallbackMock(diagInput2)
          fallbackAlerts(diagInput2)
        }
      } catch (e) { console.error('Boot error:', e) }
      finally { setLoading(false) }
    }
    boot()
  }, []) // eslint-disable-line

  function mapActions(data: ExtendedDBAction[]): UnifiedInsight[] {
    return data
      .map((a) => ({
        id: a.id, titulo: a.titulo, descricao: a.descricao ?? '',
        detalhe: a.detalhe ?? '', impacto_estimado: a.impacto_estimado,
        ganho_realizado: a.ganho_realizado, prazo: a.prazo ?? '1 semana',
        prioridade: a.prioridade, categoria: a.categoria ?? 'operacional',
        icone: a.icone, passos: Array.isArray(a.passos) ? a.passos : [],
        status: a.status, isReal: true,
        auto_executable: a.auto_executable ?? false,
        execution_type: parseExecutionType(a.execution_type),
        effort_level: parseEffortLevel(a.effort_level),
        urgencia: parseUrgencia(a.urgencia),
      }))
      // Phase 4: sort by impact DESC
      .sort((a, b) => b.impacto_estimado - a.impacto_estimado)
  }

  function fallbackMock(diagInput: Parameters<typeof gerarDiagnostico>[0]) {
    const mock = gerarInsights(diagInput)
    setInsights(
      mock
        .map((i: InsightAcao): UnifiedInsight => ({
          id: i.id, titulo: i.titulo, descricao: i.descricao, detalhe: i.detalhe,
          impacto_estimado: i.impactoEstimado, ganho_realizado: i.ganhoRealizado,
          prazo: i.prazo, prioridade: i.prioridade, categoria: i.categoria,
          icone: i.icone, passos: i.passos,
          status: i.status === 'concluido' ? 'done' : i.status === 'executando' ? 'in_progress' : 'pending',
          isReal: false, auto_executable: false, execution_type: 'recommendation',
          effort_level: 'medium',
          urgencia: 'media',
        }))
        .sort((a, b) => b.impacto_estimado - a.impacto_estimado)
    )
  }

  function fallbackAlerts(diagInput: Parameters<typeof gerarAlertas>[0]) {
    const mock = gerarAlertas(diagInput)
    setAlertas(mock.map((a: Alerta) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, descricao: a.descricao, impacto: a.impacto, lido: a.lido, isReal: false })))
  }

  // ─── AI generation ────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!companyId || !session || generating) return
    setGenerating(true); setGenerateError(null)
    try {
      const res = await fetch('/api/insights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId, perfil: session.perfil ?? 'outro',
          setor: session.setor ?? 'Negócios', metaMensal: session.metaMensal ?? 50000,
          principalDesafio: session.principalDesafio ?? 'fluxo',
          nomeEmpresa: session.nomeEmpresa ?? 'Minha Empresa', financialData,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setGenerateError(json.code === 'NO_API_KEY' ? 'Configure ANTHROPIC_API_KEY no .env.local.' : json.error ?? 'Erro na geração')
        return
      }
      if (json.actions?.length > 0) setInsights(mapActions(json.actions))
      if (json.alerts?.length > 0) setAlertas(json.alerts.map((a: DBAlert) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, descricao: a.descricao ?? '', impacto: a.impacto ?? '', lido: false, isReal: true })))
      if (json.summary) setAiSummary(json.summary)
      setLastGenerated(new Date())
    } catch (e) { setGenerateError(String(e)) }
    finally { setGenerating(false) }
  }, [companyId, session, financialData, generating]) // eslint-disable-line

  const handleStatusChange = useCallback((id: string, status: UnifiedInsight['status'], ganho?: number) => {
    setInsights(prev => prev.map(i => i.id !== id ? i : {
      ...i, status, ganho_realizado: status === 'done' ? (ganho ?? i.impacto_estimado) : i.ganho_realizado,
    }))
    if (status === 'done' && ganho) {
      setGanhoAcumulado(prev => prev + ganho)
      const action = insights.find(i => i.id === id)
      setHistorico(prev => [{
        id: id + '-h', titulo: action?.titulo ?? 'Ação', execution_type: action?.execution_type ?? 'recommendation',
        ganho_realizado: ganho, execution_log: null, executed_at: new Date().toISOString(),
      }, ...prev])
    }
  }, [insights])

  const handleDismiss = useCallback(async (id: string) => {
    const alerta = alertas.find(a => a.id === id)
    if (alerta?.isReal) await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, dismissed: true }) }).catch(() => null)
    setAlertas(prev => prev.filter(a => a.id !== id))
  }, [alertas])

  // ─── Auto-pilot ───────────────────────────────────────────

  const handleAutoPilot = useCallback(async () => {
    if (autopilotRunning) { autopilotCancelRef.current = true; setAutopilotRunning(false); return }
    const queue = insights.filter(i => i.auto_executable && i.status === 'pending' && i.isReal)
    if (!queue.length) return
    autopilotCancelRef.current = false; setAutopilotRunning(true)
    for (const action of queue) {
      if (autopilotCancelRef.current) break
      setInsights(prev => prev.map(i => i.id === action.id ? { ...i, status: 'in_progress' } : i))
      try {
        const res = await fetch('/api/actions/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action_id: action.id }) })
        const json = await res.json()
        if (res.ok) {
          const ganho = json.data?.ganho_realizado ?? action.impacto_estimado
          setInsights(prev => prev.map(i => i.id === action.id ? { ...i, status: 'done', ganho_realizado: ganho } : i))
          setGanhoAcumulado(prev => prev + ganho)
          setHistorico(prev => [{ id: action.id + '-h-' + Date.now(), titulo: action.titulo, execution_type: action.execution_type, ganho_realizado: ganho, execution_log: json.data?.log ?? null, executed_at: new Date().toISOString() }, ...prev])
          await new Promise(r => setTimeout(r, 800))
        } else {
          setInsights(prev => prev.map(i => i.id === action.id ? { ...i, status: 'pending' } : i))
        }
      } catch {
        setInsights(prev => prev.map(i => i.id === action.id ? { ...i, status: 'pending' } : i))
      }
    }
    setAutopilotRunning(false)
  }, [autopilotRunning, insights])

  // ─── Computed ─────────────────────────────────────────────

  const sortedInsights = [...insights].sort((a, b) => b.impacto_estimado - a.impacto_estimado)
  const pendingInsights = sortedInsights.filter(i => i.status !== 'done')
  const ganhoRecuperado = insights.filter(i => i.status === 'done').reduce((s, i) => s + i.ganho_realizado, 0)
  const ganhoTotal = Math.max(ganhoRecuperado, ganhoAcumulado)
  const ganhoEstimado = diagnostico?.ganhoTotalEstimado ?? insights.reduce((s, i) => s + i.impacto_estimado, 0)
  const insightsConcluidos = insights.filter(i => i.status === 'done').length
  const alertasAtivos = alertas.filter(a => a.tipo === 'perigo' || a.tipo === 'atencao').length
  const alertasNaoLidos = alertas.filter(a => !a.lido).length
  const autoExecPending = insights.filter(i => i.auto_executable && i.status === 'pending' && i.isReal).length
  const latestFinancial = financialData.length > 0 ? [...financialData].sort((a, b) => b.period_date.localeCompare(a.period_date))[0] : null
  const hasCritical = insights.some(i => i.prioridade === 'critica' && i.status === 'pending')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-64 top-0 h-96 w-96 rounded-full bg-violet-700/6 blur-[100px]" />
        <div className="absolute -right-64 bottom-0 h-96 w-96 rounded-full bg-blue-700/5 blur-[100px]" />
      </div>

      {/* Phase 3+8 modal */}
      <UpgradeModal
        isOpen={modal.open}
        type={modal.type}
        insight={modal.insight}
        totalGanho={ganhoEstimado}
        onClose={() => setModal({ open: false, type: 'action' })}
      />

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-16 flex-col items-center gap-6 border-r border-zinc-800 bg-zinc-950 py-6 md:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 shadow-[0_0_16px_rgba(124,58,237,0.4)]">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <nav className="flex flex-col items-center gap-4">
            {[BarChart3, TrendingUp, AlertTriangle, DollarSign].map((Icon, i) => (
              <button key={i} className={cn('rounded-xl p-2.5 transition', i === 0 ? 'bg-violet-600/20 text-violet-400' : 'text-zinc-600 hover:text-zinc-400')}>
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-4">
            <button className="relative rounded-xl p-2.5 text-zinc-600 transition hover:text-zinc-400">
              <Bell className="h-5 w-5" />
              {alertasNaoLidos > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{alertasNaoLidos}</span>}
            </button>
            <button className="rounded-xl p-2.5 text-zinc-600 transition hover:text-zinc-400"><Settings className="h-5 w-5" /></button>
          </div>
        </aside>

        <main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-8">
          {loading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-violet-400" />
                <p className="text-sm text-zinc-400">Analisando sua empresa...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Phase 7: return notification */}
              <AnimatePresence>
                {returnNotif && (
                  <ReturnNotif ganho={Math.round(ganhoEstimado / 30)} onClose={() => setReturnNotif(false)} />
                )}
              </AnimatePresence>

              {/* Phase 1+2: Urgency banner */}
              <UrgencyBanner ganho={ganhoEstimado} recovered={ganhoTotal} />

              {/* Phase 8: critical alert banner */}
              {hasCritical && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mb-5 flex items-center gap-3 rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-3"
                >
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                  <p className="flex-1 text-sm font-semibold text-red-300">
                    Você está perdendo dinheiro AGORA — existe uma ação crítica não executada
                  </p>
                  <button onClick={() => setActiveTab('insights')} className="shrink-0 text-xs font-bold text-red-300 underline hover:text-red-200">
                    Ver agora
                  </button>
                </motion.div>
              )}

              {/* Header */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-500">Dashboard —</p>
                  <h1 className="text-xl font-bold text-white">{session?.nomeEmpresa ?? 'Minha Empresa'}</h1>
                </div>
                <div className="flex items-center gap-2">
                  {/* Phase 7: dynamic CTA button */}
                  <Link
                    href="/dashboard/upgrade"
                    onClick={() => sessionStorage.setItem('nexus_ganho_potencial', String(ganhoEstimado))}
                    className="flex items-center gap-1.5 rounded-full border border-violet-600/50 bg-violet-600/15 px-4 py-1.5 text-xs font-bold text-violet-300 transition hover:bg-violet-600/25"
                  >
                    <Zap className="h-3 w-3" />
                    {ctaText(ganhoEstimado, ganhoTotal)}
                  </Link>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {
                    label: latestFinancial ? `Receita (${latestFinancial.period_label})` : 'Receita',
                    value: latestFinancial ? fmtBRL(latestFinancial.revenue) : '—',
                    sub: latestFinancial ? `Lucro: ${fmtBRL(latestFinancial.profit)}` : 'Insira dados financeiros',
                    icon: TrendingUp, color: 'text-violet-400', highlight: false, link: '/dashboard/dados',
                  },
                  {
                    label: 'Ganho recuperado',
                    value: <AnimCounter value={ganhoTotal} />,
                    sub: `${insightsConcluidos} ações concluídas`,
                    icon: DollarSign, color: 'text-emerald-400', highlight: ganhoTotal > 0, link: null,
                  },
                  {
                    label: 'Alertas ativos',
                    value: String(alertasAtivos),
                    sub: alertasAtivos > 0 ? '⚠ requerem atenção' : 'tudo em ordem',
                    icon: AlertTriangle, color: alertasAtivos > 0 ? 'text-red-400' : 'text-zinc-500', highlight: false, link: null,
                  },
                  {
                    label: 'Score financeiro',
                    value: diagnostico ? String(diagnostico.score) : '—',
                    sub: diagnostico?.benchmarkLabel ?? 'vs benchmark do setor',
                    icon: BarChart3, color: 'text-blue-400', highlight: false, link: null,
                  },
                ].map((kpi, i) => (
                  <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }}
                    className={cn('rounded-2xl border p-5 transition-colors', kpi.highlight ? 'border-emerald-800/50 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-900/60', kpi.link && 'cursor-pointer hover:border-zinc-700')}
                    onClick={() => kpi.link && (window.location.href = kpi.link)}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{kpi.label}</span>
                      <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                    </div>
                    <p className={cn('text-2xl font-bold', kpi.highlight ? 'text-emerald-300' : 'text-white')}>{kpi.value}</p>
                    <p className="mt-1 text-xs text-zinc-600">{kpi.sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* Phase 5: Recovery progress */}
              <RecoveryProgress recovered={ganhoTotal} total={ganhoEstimado} />

              {/* Auto-Pilot */}
              <AutoPilotControl
                enabled={autopilotRunning} running={autopilotRunning}
                autoCount={autoExecPending} plan={plan} totalGanho={ganhoEstimado}
                onToggle={handleAutoPilot}
                onPaywall={() => setModal({ open: true, type: 'autopilot' })}
              />

              {/* AI bar */}
              <AIGenerateBar onGenerate={handleGenerate} generating={generating} hasApiKey={hasApiKey} plan={plan} lastGenerated={lastGenerated} />

              {generateError && (
                <div className="mb-4 rounded-xl border border-red-800/50 bg-red-950/30 p-3">
                  <p className="text-xs text-red-300">{generateError}</p>
                </div>
              )}

              {/* Tabs */}
              <div className="mb-5 flex w-fit items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
                {([
                  { key: 'insights' as const, label: 'Insights', count: pendingInsights.length },
                  { key: 'alertas' as const, label: 'Alertas', count: alertasNaoLidos },
                  { key: 'historico' as const, label: 'Histórico', count: historico.length },
                ]).map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                      activeTab === tab.key ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}
                  >
                    {tab.key === 'historico' && <History className="h-3.5 w-3.5" />}
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={cn('flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-bold',
                        activeTab === tab.key
                          ? tab.key === 'alertas' ? 'bg-red-500 text-white' : 'bg-violet-600 text-white'
                          : 'bg-zinc-700 text-zinc-400')}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'insights' && (
                  <motion.div key="insights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <div className="space-y-4">
                      {sortedInsights
                        .slice(0, features.maxInsights === -1 ? undefined : features.maxInsights)
                        .map((insight, i) => (
                          <InsightCard
                            key={insight.id} insight={insight} index={i} plan={plan}
                            isFirst={i === 0 && insight.status !== 'done'}
                            onStatusChange={handleStatusChange}
                            onPaywallTrigger={(ins) => setModal({ open: true, type: 'action', insight: ins })}
                          />
                        ))}

                      {/* Locked insights */}
                      {features.maxInsights !== -1 && sortedInsights.length > features.maxInsights && (
                        <div className="relative overflow-hidden rounded-2xl border border-zinc-800">
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-950/85 backdrop-blur-sm p-6 text-center">
                            <Lock className="h-7 w-7 text-zinc-500" />
                            <div>
                              <p className="text-base font-bold text-white">
                                Você tem {fmtBRL(sortedInsights.slice(features.maxInsights).reduce((s, i) => s + i.impacto_estimado, 0))}/mês bloqueados
                              </p>
                              <p className="mt-1 text-sm text-zinc-400">
                                {sortedInsights.length - features.maxInsights} ações aguardando sua execução
                              </p>
                            </div>
                            <Link href="/dashboard/upgrade"
                              onClick={() => sessionStorage.setItem('nexus_ganho_potencial', String(ganhoEstimado))}
                              className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] transition hover:bg-violet-500"
                            >
                              <Zap className="h-4 w-4" /> Começar a recuperar dinheiro
                            </Link>
                          </div>
                          <div className="space-y-4 p-5 opacity-20 pointer-events-none select-none">
                            {sortedInsights.slice(features.maxInsights).map(i => (
                              <div key={i.id} className="rounded-xl border border-zinc-800 p-4">
                                <div className="h-4 w-48 rounded bg-zinc-700" />
                                <div className="mt-2 h-3 w-64 rounded bg-zinc-800" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {insights.length === 0 && !generating && (
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
                          <Sparkles className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                          <p className="font-semibold text-white">Nenhum insight gerado ainda</p>
                          <p className="mt-1 text-sm text-zinc-500">{hasApiKey ? 'Clique em "Gerar análise" acima.' : 'Insights simulados baseados no seu perfil.'}</p>
                        </div>
                      )}
                    </div>

                    {/* Phase 6: Social proof */}
                    <div className="mt-8">
                      <SocialProofBlock perfil={session?.perfil ?? 'outro'} />
                    </div>
                  </motion.div>
                )}

                {activeTab === 'alertas' && (
                  <motion.div key="alertas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    {!features.alertas ? (
                      <PlanGate feature="Alertas automáticos de monitoramento">
                        <div className="space-y-3 p-4">
                          {[1, 2, 3].map(i => <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"><div className="h-4 w-48 rounded bg-zinc-700" /><div className="mt-2 h-3 w-64 rounded bg-zinc-800" /></div>)}
                        </div>
                      </PlanGate>
                    ) : (
                      <>
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-sm text-zinc-400">Monitoramento — <span className="text-zinc-500">{alertas.some(a => a.isReal) ? 'dados reais' : 'simulado'}</span></p>
                          {alertas.length > 0 && <button onClick={() => setAlertas([])} className="text-xs text-zinc-600 transition hover:text-zinc-400">Limpar todos</button>}
                        </div>
                        <AnimatePresence mode="popLayout">
                          {alertas.length > 0
                            ? <div className="space-y-3">{alertas.map(a => <AlertaCard key={a.id} alerta={a} onDismiss={handleDismiss} />)}</div>
                            : <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
                              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
                              <p className="font-semibold text-white">Sem alertas ativos</p>
                            </motion.div>}
                        </AnimatePresence>
                      </>
                    )}
                  </motion.div>
                )}

                {activeTab === 'historico' && (
                  <motion.div key="historico" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    {ganhoTotal > 0 && (
                      <div className="mb-6 rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-5 text-center">
                        <p className="text-xs text-zinc-500 mb-1">Total de ganhos recuperados</p>
                        <p className="text-4xl font-bold text-emerald-300">
                          <AnimCounter value={ganhoTotal} />
                          <span className="text-lg font-normal text-zinc-500">/mês</span>
                        </p>
                        <p className="mt-2 text-xs text-emerald-500">{historico.length} ação{historico.length !== 1 ? 'ões' : ''} executada{historico.length !== 1 ? 's' : ''}</p>
                      </div>
                    )}
                    {historico.length > 0
                      ? <div className="pl-2">{historico.map((item, i) => <HistoricoCard key={item.id} item={item} index={i} />)}</div>
                      : <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
                        <History className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                        <p className="font-semibold text-white">Nenhuma ação executada ainda</p>
                        <p className="mt-1 text-sm text-zinc-500">Execute ações para ver o histórico aqui.</p>
                      </div>}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
