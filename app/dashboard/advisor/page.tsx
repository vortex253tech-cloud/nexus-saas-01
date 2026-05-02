'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, RefreshCw, Loader2, TrendingUp, AlertTriangle, Zap, CheckCircle2,
  ChevronRight, DollarSign, Clock, Play, Activity, BarChart3, Target,
  ArrowUpRight, ArrowDownRight, Shield, Lightbulb, Rocket,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'
import type {
  BusinessAnalysis,
  BusinessInsight,
  BusinessRisk,
  BusinessOpportunity,
  RecommendedAction,
} from '@/lib/services/business-advisor'

// ─── Score ring ────────────────────────────────────────────────────────────

function ScoreRing({ score, breakdown }: { score: number; breakdown: BusinessAnalysis['score_breakdown'] }) {
  const radius = 54
  const stroke = 8
  const circ   = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ

  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const label = score >= 75 ? 'Saudável' : score >= 50 ? 'Atenção' : 'Crítico'

  const dims = [
    { key: 'collections', label: 'Cobranças',  color: '#7c3aed' },
    { key: 'cashflow',    label: 'Fluxo',       color: '#2563eb' },
    { key: 'growth',      label: 'Crescimento', color: '#10b981' },
    { key: 'operations',  label: 'Operações',   color: '#f59e0b' },
  ] as const

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
      {/* Ring */}
      <div className="relative flex-shrink-0">
        <svg width={136} height={136} className="-rotate-90">
          <circle cx={68} cy={68} r={radius} fill="none" stroke="#27272a" strokeWidth={stroke} />
          <motion.circle
            cx={68} cy={68} r={radius} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white">{score}</span>
          <span className="text-xs font-medium" style={{ color }}>{label}</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="w-full space-y-3">
        {dims.map(d => {
          const val = breakdown[d.key]
          return (
            <div key={d.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-zinc-400">{d.label}</span>
                <span className="font-semibold text-white">{val}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: d.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${val}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Priority badge ─────────────────────────────────────────────────────────

function PriorityBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    high:     'bg-red-500/10 text-red-400 border-red-500/20',
    medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    low:      'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',
    critical: 'bg-red-600/15 text-red-300 border-red-600/30',
  }
  const labels: Record<string, string> = {
    high: 'Alta', medium: 'Média', low: 'Baixa', critical: 'Crítico',
  }
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', map[value] ?? map.low)}>
      {labels[value] ?? value}
    </span>
  )
}

// ─── Insight card ───────────────────────────────────────────────────────────

function InsightCard({ item }: { item: BusinessInsight }) {
  const catColor: Record<string, string> = {
    revenue:     'text-emerald-400',
    cost:        'text-red-400',
    retention:   'text-violet-400',
    operational: 'text-blue-400',
    pricing:     'text-amber-400',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{item.title}</span>
            <PriorityBadge value={item.priority} />
          </div>
          <p className="text-xs leading-relaxed text-zinc-400">{item.description}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <DollarSign size={11} className={catColor[item.category] ?? 'text-zinc-500'} />
            <span className={cn('text-xs font-medium', catColor[item.category] ?? 'text-zinc-500')}>
              {item.impact}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Risk card ──────────────────────────────────────────────────────────────

function RiskCard({ item }: { item: BusinessRisk }) {
  const sevColor: Record<string, string> = {
    critical: 'border-red-600/40 bg-red-950/20',
    high:     'border-red-500/30 bg-red-950/10',
    medium:   'border-amber-500/30 bg-amber-950/10',
    low:      'border-zinc-700/50 bg-zinc-900/40',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border p-4', sevColor[item.severity] ?? sevColor.low)}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <AlertTriangle size={14} className={item.severity === 'critical' || item.severity === 'high' ? 'text-red-400' : 'text-amber-400'} />
        <span className="text-sm font-semibold text-white">{item.title}</span>
        <PriorityBadge value={item.severity} />
      </div>
      <p className="mb-2 text-xs leading-relaxed text-zinc-400">{item.description}</p>
      <div className="rounded-lg bg-zinc-800/40 px-3 py-2">
        <p className="text-xs text-zinc-500">
          <span className="font-medium text-zinc-300">Mitigação:</span>{' '}
          {item.mitigation}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Opportunity card ────────────────────────────────────────────────────────

function OpportunityCard({ item }: { item: BusinessOpportunity }) {
  const effortColor: Record<string, string> = {
    low:    'text-emerald-400',
    medium: 'text-amber-400',
    high:   'text-red-400',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-violet-800/30 bg-violet-950/10 p-4"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Lightbulb size={14} className="text-violet-400" />
        <span className="text-sm font-semibold text-white">{item.title}</span>
        <span className={cn('text-[10px] font-semibold uppercase', effortColor[item.effort])}>
          Esforço {item.effort === 'low' ? 'baixo' : item.effort === 'medium' ? 'médio' : 'alto'}
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-zinc-400">{item.description}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1 font-semibold text-emerald-400">
          <ArrowUpRight size={12} />
          {item.potential_gain}
        </span>
        <span className="flex items-center gap-1 text-zinc-500">
          <Clock size={11} />
          {item.timeframe}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">{item.why_now}</p>
    </motion.div>
  )
}

// ─── Action card ─────────────────────────────────────────────────────────────

function ActionCard({
  item,
  onExecute,
  executing,
}: {
  item: RecommendedAction
  onExecute: (id: string) => void
  executing: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const execTypeLabel: Record<string, string> = {
    email:      'E-mail',
    whatsapp:   'WhatsApp',
    automation: 'Automação',
    analysis:   'Análise',
    manual:     'Manual',
  }
  const execTypeIcon: Record<string, React.ReactNode> = {
    email:      <span className="text-[10px]">📧</span>,
    whatsapp:   <span className="text-[10px]">💬</span>,
    automation: <Zap size={10} className="text-violet-400" />,
    analysis:   <BarChart3 size={10} className="text-blue-400" />,
    manual:     <span className="text-[10px]">✋</span>,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
    >
      <div className="flex items-start gap-3">
        {/* Priority number */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-xs font-black text-violet-300 ring-1 ring-violet-500/30">
          {item.priority}
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{item.title}</span>
            <span className="flex items-center gap-1 rounded-full border border-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-400">
              {execTypeIcon[item.execution_type]}
              {execTypeLabel[item.execution_type] ?? item.execution_type}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-400">{item.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1 font-semibold text-emerald-400">
              <TrendingUp size={11} />
              {item.impact_estimate}
            </span>
            <span className="flex items-center gap-1 text-zinc-500">
              <Clock size={11} />
              Prazo: {item.deadline}
            </span>
          </div>

          {/* Steps toggle */}
          {item.steps?.length > 0 && (
            <button
              onClick={() => setExpanded(p => !p)}
              className="mt-2 flex items-center gap-1 text-[11px] text-violet-400 transition hover:text-violet-300"
            >
              <ChevronRight size={12} className={cn('transition-transform', expanded && 'rotate-90')} />
              {expanded ? 'Ocultar' : 'Ver'} passos ({item.steps.length})
            </button>
          )}

          <AnimatePresence>
            {expanded && (
              <motion.ol
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 space-y-1 overflow-hidden"
              >
                {item.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                    <span className="min-w-[16px] font-semibold text-violet-400">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Execute button */}
      {item.auto_executable && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onExecute(item.id)}
            disabled={executing}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600/20 px-3 py-1.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/30 transition hover:bg-violet-600/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {executing
              ? <><Loader2 size={12} className="animate-spin" /> Executando...</>
              : <><Play size={12} /> Executar agora</>
            }
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  count,
  children,
  iconClass = 'text-zinc-400',
}: {
  icon: React.ElementType
  title: string
  count: number
  children: React.ReactNode
  iconClass?: string
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Icon size={16} className={iconClass} />
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
          {count}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-zinc-800/60', className)} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="flex gap-6">
          <Skeleton className="h-[136px] w-[136px] rounded-full" />
          <div className="flex-1 space-y-3 pt-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i}>
                <div className="mb-1 flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-32" />
          {[1, 2].map(j => (
            <Skeleton key={j} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center">
      <p className="text-sm text-zinc-600">{label}</p>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AdvisorPage() {
  const [analysis, setAnalysis]   = useState<BusinessAnalysis | null>(null)
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [executing, setExecuting] = useState<string | null>(null)

  // Resolve company on mount
  useEffect(() => {
    void resolveCompanyId().then(cid => setCompanyId(cid))
  }, [])

  const fetchAnalysis = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/business-analysis', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ company_id: companyId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as BusinessAnalysis
      setAnalysis(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar análise.')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  // Auto-fetch when company is resolved
  useEffect(() => {
    if (companyId && !analysis && !loading) void fetchAnalysis()
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExecute(actionId: string) {
    setExecuting(actionId)
    // Stub execution — in production this would call /api/ai/execute-action
    await new Promise(r => setTimeout(r, 1500))
    setExecuting(null)
  }

  const lastUpdated = analysis?.analyzed_at
    ? new Date(analysis.analyzed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="min-h-screen bg-zinc-950 pb-16">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/95 px-5 py-3.5 backdrop-blur lg:top-0">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/15 ring-1 ring-violet-500/20">
              <Brain size={16} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Consultor IA</h1>
              <p className="text-[10px] text-zinc-500">Análise inteligente do negócio · NEXUS AI</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="hidden text-[10px] text-zinc-600 sm:block">
                Atualizado às {lastUpdated}
              </span>
            )}
            <button
              onClick={fetchAnalysis}
              disabled={loading || !companyId}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Analisando...' : 'Analisar'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Loading */}
          {loading && !analysis && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-8 flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/15 ring-1 ring-violet-500/20">
                  <Brain size={22} className="animate-pulse text-violet-400" />
                </div>
                <p className="text-sm font-medium text-white">Analisando seu negócio…</p>
                <p className="max-w-xs text-xs text-zinc-500">
                  A IA está processando seus dados financeiros, clientes, mensagens e automações.
                </p>
              </div>
              <LoadingSkeleton />
            </motion.div>
          )}

          {/* Error */}
          {error && !loading && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mt-12 flex flex-col items-center gap-4 text-center"
            >
              <AlertTriangle size={40} className="text-red-400" />
              <p className="text-sm text-zinc-400">{error}</p>
              <button
                onClick={fetchAnalysis}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Tentar novamente
              </button>
            </motion.div>
          )}

          {/* Analysis ready */}
          {analysis && !loading && (
            <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

              {/* ── Health score + summary ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Activity size={14} className="text-violet-400" />
                  <h2 className="text-sm font-bold text-white">Saúde do Negócio</h2>
                </div>
                <p className="mb-5 text-xs text-zinc-500">{analysis.summary}</p>
                <ScoreRing score={analysis.score} breakdown={analysis.score_breakdown} />

                {/* Data coverage */}
                <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-800/60 pt-4">
                  {Object.entries(analysis.data_coverage).map(([key, ok]) => {
                    const labels: Record<string, string> = {
                      financial: 'Financeiro', clients: 'Clientes',
                      messages: 'Mensagens', executions: 'Automações',
                    }
                    return (
                      <span
                        key={key}
                        className={cn(
                          'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium',
                          ok
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : 'border-zinc-700/50 bg-zinc-800/50 text-zinc-500',
                        )}
                      >
                        {ok ? <CheckCircle2 size={10} /> : <span className="h-2.5 w-2.5 rounded-full border border-zinc-600" />}
                        {labels[key] ?? key}
                      </span>
                    )
                  })}
                </div>
              </motion.div>

              {/* ── Recommended actions (first, most important) ── */}
              {analysis.recommended_actions?.length > 0 && (
                <Section icon={Target} title="Ações Recomendadas" count={analysis.recommended_actions.length} iconClass="text-violet-400">
                  {analysis.recommended_actions
                    .sort((a, b) => a.priority - b.priority)
                    .map((item, i) => (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                        <ActionCard
                          item={item}
                          onExecute={handleExecute}
                          executing={executing === item.id}
                        />
                      </motion.div>
                    ))}
                </Section>
              )}

              {/* ── Insights ── */}
              {analysis.insights?.length > 0 && (
                <Section icon={Lightbulb} title="Insights" count={analysis.insights.length} iconClass="text-amber-400">
                  {analysis.insights.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                      <InsightCard item={item} />
                    </motion.div>
                  ))}
                  {analysis.insights.length === 0 && <EmptyPanel label="Nenhum insight identificado." />}
                </Section>
              )}

              {/* ── Risks ── */}
              <Section icon={Shield} title="Riscos" count={analysis.risks?.length ?? 0} iconClass="text-red-400">
                {analysis.risks?.length > 0
                  ? analysis.risks.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                      <RiskCard item={item} />
                    </motion.div>
                  ))
                  : <EmptyPanel label="Nenhum risco crítico detectado." />
                }
              </Section>

              {/* ── Opportunities ── */}
              <Section icon={Rocket} title="Oportunidades" count={analysis.opportunities?.length ?? 0} iconClass="text-emerald-400">
                {analysis.opportunities?.length > 0
                  ? analysis.opportunities.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                      <OpportunityCard item={item} />
                    </motion.div>
                  ))
                  : <EmptyPanel label="Nenhuma oportunidade identificada." />
                }
              </Section>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
