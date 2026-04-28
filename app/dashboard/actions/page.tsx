'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, CheckCircle2, Loader2, Clock, Mail, MessageSquare,
  Megaphone, ClipboardList, LineChart, RefreshCw, AlertCircle,
  DollarSign, Play, Filter, Flame,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getBoolean, getString, isRecord } from '@/lib/unknown'
import { resolveCompanyId } from '@/lib/get-company-id'
import { AIStatus } from '@/components/ui/ai-status'

// ─── Types ────────────────────────────────────────────────────

interface Action {
  id: string
  titulo: string
  descricao: string | null
  detalhe: string | null
  impacto_estimado: number
  ganho_realizado: number
  prazo: string | null
  prioridade: 'critica' | 'alta' | 'media'
  urgencia: 'alta' | 'media' | 'baixa'
  status: 'pending' | 'in_progress' | 'done'
  execution_type: string
  execution_log: string | null
  executed_at: string | null
  created_at: string
}

type ExecuteChannelResult = {
  channel: string
  delivered: boolean
  simulated?: boolean
}

function isAction(value: unknown): value is Action {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.titulo === 'string' &&
    (typeof value.descricao === 'string' || value.descricao === null) &&
    (typeof value.detalhe === 'string' || value.detalhe === null) &&
    typeof value.impacto_estimado === 'number' &&
    typeof value.ganho_realizado === 'number' &&
    (typeof value.prazo === 'string' || value.prazo === null) &&
    (value.prioridade === 'critica' || value.prioridade === 'alta' || value.prioridade === 'media') &&
    (value.urgencia === 'alta' || value.urgencia === 'media' || value.urgencia === 'baixa') &&
    (value.status === 'pending' || value.status === 'in_progress' || value.status === 'done') &&
    typeof value.execution_type === 'string' &&
    (typeof value.execution_log === 'string' || value.execution_log === null) &&
    (typeof value.executed_at === 'string' || value.executed_at === null) &&
    typeof value.created_at === 'string'
  )
}

function getExecuteChannelResult(value: unknown): ExecuteChannelResult | undefined {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.data.channel_result)) return undefined
  const channelResult = value.data.channel_result
  const channel = getString(channelResult, 'channel')
  const delivered = getBoolean(channelResult, 'delivered')
  if (!channel || delivered === undefined) return undefined

  return { channel, delivered, simulated: getBoolean(channelResult, 'simulated') }
}

type Filter = 'all' | 'pending' | 'done'

// ─── Helpers ──────────────────────────────────────────────────

function fmtBRL(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`
  return `R$ ${Math.round(v)}`
}

function executionIcon(type: string) {
  switch (type) {
    case 'email': return <Mail size={14} />
    case 'whatsapp': return <MessageSquare size={14} />
    case 'ads': return <Megaphone size={14} />
    case 'recommendation': return <ClipboardList size={14} />
    case 'analytics': return <LineChart size={14} />
    default: return <Zap size={14} />
  }
}

function executionLabel(type: string) {
  const map: Record<string, string> = {
    email: 'E-mail', whatsapp: 'WhatsApp', ads: 'Ads',
    recommendation: 'Recomendação', analytics: 'Análise',
  }
  return map[type] ?? type
}

function prioColor(p: string) {
  if (p === 'critica') return 'text-red-400 bg-red-400/10 border-red-400/20'
  if (p === 'alta') return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
  return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
}

// ─── Toast ────────────────────────────────────────────────────

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

// ─── Action Card ──────────────────────────────────────────────

function ActionCard({
  action,
  executing,
  onExecute,
}: {
  action: Action
  executing: boolean
  onExecute: (id: string) => void
}) {
  const isDone = action.status === 'done'
  const isRunning = action.status === 'in_progress' || executing

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={!isDone ? { y: -2 } : {}}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={cn(
        'rounded-xl border p-5 transition-all',
        isDone
          ? 'border-zinc-800/40 bg-zinc-900/40'
          : isRunning
          ? 'border-violet-500/40 bg-violet-500/5'
          : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700/60 nexus-card',
      )}
    >
      <div className="flex items-start gap-4">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {isDone ? (
            <CheckCircle2 size={18} className="text-emerald-500" />
          ) : isRunning ? (
            <Loader2 size={18} className="animate-spin text-violet-400" />
          ) : (
            <Clock size={18} className="text-zinc-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
              prioColor(action.prioridade)
            )}>
              {action.prioridade.toUpperCase()}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
              {executionIcon(action.execution_type)}
              {executionLabel(action.execution_type)}
            </span>
            {action.urgencia === 'alta' && !isDone && (
              <motion.span
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[11px] text-red-400"
              >
                <Flame size={9} className="text-red-400" /> Urgente
              </motion.span>
            )}
          </div>

          <h3 className={cn('font-semibold text-sm mb-1', isDone ? 'text-zinc-400' : 'text-white')}>
            {action.titulo}
          </h3>

          {action.descricao && (
            <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{action.descricao}</p>
          )}

          <div className="flex items-center gap-3">
            <span
              className="text-xs font-semibold text-emerald-400"
              style={isDone ? { textShadow: '0 0 10px rgba(52,211,153,0.5)' } : undefined}
            >
              {isDone ? `+ ${fmtBRL(action.ganho_realizado)} recuperado` : `≈ ${fmtBRL(action.impacto_estimado)}/mês`}
            </span>
            {action.prazo && !isDone && (
              <span className="text-xs text-zinc-600">Prazo: {action.prazo}</span>
            )}
            {action.executed_at && isDone && (
              <span className="text-xs text-zinc-600">
                Executado: {new Date(action.executed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Execution log */}
          {isDone && action.execution_log && (
            <div className="mt-3 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2">
              <p className="text-[11px] text-zinc-500 font-mono break-all">{action.execution_log}</p>
            </div>
          )}
        </div>

        {/* Execute button */}
        {!isDone && (
          <motion.button
            onClick={() => onExecute(action.id)}
            disabled={isRunning}
            whileHover={!isRunning ? { scale: 1.04 } : {}}
            whileTap={!isRunning ? { scale: 0.96 } : {}}
            className={cn(
              'shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
              isRunning
                ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
                : 'bg-violet-600 text-white hover:bg-violet-500',
            )}
            style={!isRunning ? { boxShadow: '0 0 16px rgba(124,58,237,0.35)' } : undefined}
          >
            {isRunning ? (
              <><Loader2 size={12} className="animate-spin" /> Executando</>
            ) : (
              <><Play size={12} /> Executar</>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function ActionsPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('all')
  const [toasts, setToasts] = useState<Toast[]>([])

  // ─── Toast helpers ─────────────────────────────────────────

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  // ─── Load session ─────────────────────────────────────────

  useEffect(() => {
    void resolveCompanyId().then(cid => { if (cid) setCompanyId(cid) })
  }, [])

  // ─── Fetch actions ────────────────────────────────────────

  const fetchActions = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/actions?company_id=${companyId}`)
      const json: unknown = await res.json()
      if (isRecord(json) && Array.isArray(json.data)) setActions(json.data.filter(isAction))
    } catch { /* ok */ } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (companyId) fetchActions()
  }, [companyId, fetchActions])

  // ─── Execute action ───────────────────────────────────────

  async function handleExecute(actionId: string) {
    setExecutingIds(prev => new Set(prev).add(actionId))

    // Optimistic: mark in_progress
    setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: 'in_progress' } : a))

    try {
      const res = await fetch('/api/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId }),
      })
      const json: unknown = await res.json()
      const error = isRecord(json) ? getString(json, 'error') : undefined

      if (!res.ok || error) {
        showToast('error', error ?? 'Erro ao executar acao')
        // Revert optimistic
        setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: 'pending' } : a))
      } else {
        const ch = getExecuteChannelResult(json)
        if (ch) {
          const channel = ch.channel === 'email' ? 'E-mail' : 'WhatsApp'
          const simMsg = ch.simulated ? ' (simulado — configure as credenciais)' : ''
          showToast('success', ch.delivered
            ? `${channel} enviado com sucesso!${simMsg}`
            : `${channel} falhou — veja os logs`
          )
        } else {
          showToast('success', 'Ação executada com sucesso!')
        }
        // Refresh to get final state
        await fetchActions()
      }
    } catch {
      showToast('error', 'Erro de conexão')
      setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: 'pending' } : a))
    } finally {
      setExecutingIds(prev => { const s = new Set(prev); s.delete(actionId); return s })
    }
  }

  // ─── Filtered actions ─────────────────────────────────────

  const filtered = actions.filter(a => {
    if (filter === 'pending') return a.status !== 'done'
    if (filter === 'done') return a.status === 'done'
    return true
  })

  const pendingCount = actions.filter(a => a.status === 'pending').length
  const doneCount = actions.filter(a => a.status === 'done').length
  const totalGanho = actions.filter(a => a.status === 'done').reduce((s, a) => s + (a.ganho_realizado ?? 0), 0)
  const totalPotential = actions.filter(a => a.status !== 'done').reduce((s, a) => s + (a.impacto_estimado ?? 0), 0)

  // ─── No company ──────────────────────────────────────────

  if (!companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400 mb-4">Sessão não encontrada. Faça o onboarding primeiro.</p>
          <a href="/start" className="inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
            Iniciar
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-xl border max-w-xs',
                t.type === 'success' && 'bg-emerald-900/90 border-emerald-700 text-emerald-300',
                t.type === 'error' && 'bg-red-900/90 border-red-700 text-red-300',
                t.type === 'info' && 'bg-zinc-800/90 border-zinc-700 text-zinc-300',
              )}
            >
              {t.type === 'success' && <CheckCircle2 size={15} />}
              {t.type === 'error' && <AlertCircle size={15} />}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Zap size={22} className="text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Central de Ações</h1>
          <AIStatus
            state={loading ? 'analyzing' : executingIds.size > 0 ? 'executing' : 'idle'}
            label={loading ? 'IA carregando' : executingIds.size > 0 ? 'IA executando' : undefined}
          />
        </div>
        <p className="text-zinc-500 text-sm">Execute ações de alto impacto geradas pela IA — email, WhatsApp e mais.</p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pendentes', value: pendingCount, color: 'text-yellow-400' },
          { label: 'Concluídas', value: doneCount, color: 'text-emerald-400' },
          { label: 'Potencial', value: fmtBRL(totalPotential) + '/mês', color: 'text-violet-400' },
          { label: 'Ganho Real', value: fmtBRL(totalGanho), color: 'text-emerald-400', glow: true },
        ].map(c => (
          <motion.div
            key={c.label}
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 cursor-default"
          >
            <p className="text-xs text-zinc-500 mb-1">{c.label}</p>
            <p
              className={cn('text-lg font-bold', c.color)}
              style={'glow' in c && c.glow ? { textShadow: '0 0 14px rgba(52,211,153,0.5)' } : undefined}
            >
              {c.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filter + Refresh */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-zinc-500" />
          {(['all', 'pending', 'done'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === f
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white',
              )}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Concluídas'}
            </button>
          ))}
        </div>
        <button
          onClick={fetchActions}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Actions list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
          <DollarSign size={36} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500 text-sm">
            {filter === 'done'
              ? 'Nenhuma ação concluída ainda — execute as pendentes!'
              : 'Nenhuma ação encontrada. Gere insights no dashboard primeiro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                executing={executingIds.has(action.id)}
                onExecute={handleExecute}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

