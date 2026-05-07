'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence }           from 'framer-motion'
import {
  Brain, Zap, TrendingUp, AlertCircle, CheckCircle2,
  Clock, ChevronRight, Loader2, ToggleLeft, ToggleRight,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Decision } from '@/lib/decision-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EngineStatus {
  autopilot_enabled:   boolean
  approval_mode:       'auto' | 'manual'
  max_actions_per_day: number
  actions_today:       number
  actions_remaining:   number
  revenue_today:       number
  pending_count:       number
  is_running:          boolean
  decisions:           Decision[]
  last_run: {
    run_at:           string
    summary:          string
    decisions_found:  number
    actions_executed: number
    revenue_impact:   number
    error:            string | null
  } | null
}

const TRIGGER_LABELS: Record<string, string> = {
  RECOVERY_FLOW:     'Recuperação',
  SALES_FLOW:        'Vendas',
  REACTIVATION_FLOW: 'Reativação',
  COLLECTION_FLOW:   'Cobrança',
  UPSELL_FLOW:       'Upsell',
}

const TRIGGER_COLORS: Record<string, string> = {
  RECOVERY_FLOW:     'text-red-400    bg-red-500/10    border-red-500/20',
  SALES_FLOW:        'text-blue-400   bg-blue-500/10   border-blue-500/20',
  REACTIVATION_FLOW: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  COLLECTION_FLOW:   'text-orange-400 bg-orange-500/10 border-orange-500/20',
  UPSELL_FLOW:       'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

// ─── Component ────────────────────────────────────────────────────────────────

export default function EngineStatusPanel() {
  const [status,   setStatus]   = useState<EngineStatus | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [toggling, setToggling] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/engine/status')
      if (res.ok) setStatus(await res.json() as EngineStatus)
    } catch { /* non-blocking */ }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => {
    void load()
    // Refresh every 2 minutes
    const id = setInterval(() => { void load() }, 2 * 60_000)
    return () => clearInterval(id)
  }, [load])

  async function toggleAutopilot() {
    if (!status || toggling) return
    setToggling(true)
    try {
      await fetch('/api/engine/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ autopilot_enabled: !status.autopilot_enabled }),
      })
      await load()
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-violet-400" />
        <span className="text-sm text-zinc-500">Carregando motor de receita...</span>
      </div>
    )
  }

  if (!status) return null

  const isActive      = status.autopilot_enabled
  const hasDecisions  = status.decisions.length > 0
  const capUsedPct    = Math.min(100, (status.actions_today / status.max_actions_per_day) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 nexus-card transition-colors',
        isActive
          ? 'border-violet-500/30 bg-gradient-to-br from-violet-950/30 to-zinc-900'
          : 'border-zinc-800 bg-zinc-900',
      )}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl border',
            isActive
              ? 'bg-violet-600/20 border-violet-500/30'
              : 'bg-zinc-800 border-zinc-700',
          )}>
            <Brain size={16} className={isActive ? 'text-violet-400' : 'text-zinc-500'} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Motor de Receita</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {isActive
                ? status.is_running ? 'IA Executando agora...' : 'Autopilot ativo'
                : 'Autopilot desativado'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => void toggleAutopilot()}
            disabled={toggling}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: isActive ? 'rgba(124,58,237,0.2)' : 'rgba(63,63,70,0.5)',
              color:      isActive ? '#a78bfa' : '#71717a',
            }}
          >
            {toggling
              ? <Loader2 size={12} className="animate-spin" />
              : isActive
                ? <ToggleRight size={14} />
                : <ToggleLeft  size={14} />
            }
            {isActive ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>

      {/* ── Metrics Row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          {
            label: 'Ações hoje',
            value: `${status.actions_today}/${status.max_actions_per_day}`,
            icon:  <Zap size={12} />,
            color: capUsedPct >= 90 ? 'text-red-400' : 'text-violet-400',
          },
          {
            label: 'Recuperado hoje',
            value: status.revenue_today > 0 ? fmt(status.revenue_today) : '—',
            icon:  <TrendingUp size={12} />,
            color: 'text-emerald-400',
          },
          {
            label: 'Pendentes',
            value: String(status.pending_count),
            icon:  <Clock size={12} />,
            color: status.pending_count > 0 ? 'text-yellow-400' : 'text-zinc-500',
          },
        ].map(card => (
          <div key={card.label} className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-3 py-2.5">
            <div className={cn('flex items-center gap-1 mb-1', card.color)}>{card.icon}</div>
            <p className="text-[10px] text-zinc-500 leading-none mb-1">{card.label}</p>
            <p className={cn('text-sm font-bold', card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Daily cap bar ─────────────────────────────────────────── */}
      {isActive && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
            <span>Cap diário</span>
            <span>{status.actions_today} de {status.max_actions_per_day}</span>
          </div>
          <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${capUsedPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                capUsedPct >= 90 ? 'bg-red-500' : capUsedPct >= 70 ? 'bg-yellow-500' : 'bg-violet-500'
              )}
            />
          </div>
        </div>
      )}

      {/* ── Last run ──────────────────────────────────────────────── */}
      {status.last_run && (
        <div className="flex items-start gap-2 rounded-lg bg-zinc-800/40 border border-zinc-700/40 px-3 py-2 mb-4">
          {status.last_run.error
            ? <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
            : <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
          }
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-500">
              Última execução · {new Date(status.last_run.run_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
            <p className="text-xs text-zinc-300 truncate mt-0.5">{status.last_run.summary}</p>
          </div>
        </div>
      )}

      {/* ── Decisions accordion ───────────────────────────────────── */}
      {hasDecisions && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              {status.decisions.length} decisão(ões) detectada(s)
            </span>
            <ChevronRight
              size={13}
              className={cn('text-zinc-600 transition-transform', expanded && 'rotate-90')}
            />
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-2">
                  {status.decisions.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3"
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className={cn(
                          'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold shrink-0',
                          TRIGGER_COLORS[d.trigger] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700',
                        )}>
                          {TRIGGER_LABELS[d.trigger] ?? d.trigger}
                        </span>
                        {d.auto_executable && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400 shrink-0">
                            <Zap size={8} /> Auto
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-zinc-200 mb-1 line-clamp-2">{d.title}</p>
                      <p className="text-[10px] text-zinc-500 line-clamp-1">{d.recommended_action}</p>
                      <p className="text-[10px] text-emerald-400 mt-1">
                        Impacto estimado: {fmt(d.expected_revenue_impact)}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────────── */}
      {!hasDecisions && !loading && (
        <div className="flex items-center gap-2 text-zinc-600">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <p className="text-xs">Empresa saudável — nenhuma ação urgente detectada</p>
        </div>
      )}

      {/* ── Mode badge ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-600">
          Modo: <span className="text-zinc-400">{status.approval_mode === 'auto' ? 'Automático' : 'Manual (aprovação)'}</span>
        </p>
        <a
          href="/dashboard/settings"
          className="text-[10px] text-violet-500 hover:text-violet-400 transition-colors"
        >
          Configurar →
        </a>
      </div>
    </motion.div>
  )
}
