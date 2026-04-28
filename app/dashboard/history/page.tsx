'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History, Mail, MessageSquare, Megaphone, ClipboardList,
  LineChart, Loader2, TrendingUp, AlertCircle, RefreshCw,
  Bot, Zap, CheckCircle2, XCircle, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { isRecord } from '@/lib/unknown'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── Types ────────────────────────────────────────────────────

interface HistoryItem {
  id: string
  titulo: string
  execution_type: string
  ganho_realizado: number
  execution_log: string | null
  executed_at: string
}

interface AutopilotLog {
  id: string
  triggered_by: string
  actions_executed: number
  actions_failed: number
  new_insights: number
  ai_summary: string | null
  created_at: string
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.titulo === 'string' &&
    typeof value.execution_type === 'string' &&
    typeof value.ganho_realizado === 'number' &&
    (typeof value.execution_log === 'string' || value.execution_log === null) &&
    typeof value.executed_at === 'string'
  )
}

function isAutopilotLog(value: unknown): value is AutopilotLog {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.triggered_by === 'string' &&
    typeof value.actions_executed === 'number' &&
    typeof value.actions_failed === 'number' &&
    typeof value.new_insights === 'number' &&
    (typeof value.ai_summary === 'string' || value.ai_summary === null) &&
    typeof value.created_at === 'string'
  )
}

type ActiveTab = 'acoes' | 'autopilot'

// ─── Helpers ──────────────────────────────────────────────────

function fmtBRL(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`
  return `R$ ${Math.round(v)}`
}

function typeIcon(type: string) {
  switch (type) {
    case 'email': return <Mail size={15} className="text-blue-400" />
    case 'whatsapp': return <MessageSquare size={15} className="text-emerald-400" />
    case 'ads': return <Megaphone size={15} className="text-orange-400" />
    case 'recommendation': return <ClipboardList size={15} className="text-violet-400" />
    case 'analytics': return <LineChart size={15} className="text-cyan-400" />
    default: return <TrendingUp size={15} className="text-zinc-400" />
  }
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    email: 'E-mail', whatsapp: 'WhatsApp', ads: 'Ads',
    recommendation: 'Recomendação', analytics: 'Análise',
  }
  return map[type] ?? type
}

function triggeredByLabel(v: string) {
  return v === 'cron' ? 'Automático (cron)' : v === 'user' ? 'Manual' : v
}

// ─── Page ─────────────────────────────────────────────────────

export default function HistoryPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<HistoryItem[]>([])
  const [autopilotLogs, setAutopilotLogs] = useState<AutopilotLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('acoes')

  useEffect(() => {
    void resolveCompanyId().then(cid => { if (cid) setCompanyId(cid) })
  }, [])

  const fetchHistory = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [histRes, apRes] = await Promise.all([
        fetch(`/api/execution-history?company_id=${companyId}`),
        fetch('/api/autopilot/logs'),
      ])
      const histJson: unknown = await histRes.json()
      if (isRecord(histJson) && Array.isArray(histJson.data)) setItems(histJson.data.filter(isHistoryItem))
      if (apRes.ok) {
        const apJson: unknown = await apRes.json()
        if (isRecord(apJson) && Array.isArray(apJson.data)) setAutopilotLogs(apJson.data.filter(isAutopilotLog))
      }
    } catch { /* ok */ } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (companyId) fetchHistory()
  }, [companyId, fetchHistory])

  const totalGanho = items.reduce((s, i) => s + (i.ganho_realizado ?? 0), 0)

  if (!companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-zinc-500 text-sm">Sessão não encontrada.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <History size={22} className="text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Histórico</h1>
        </div>
        <p className="text-zinc-500 text-sm">Ações executadas e execuções do Auto-Pilot.</p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Ações Executadas</p>
          <p className="text-xl font-bold text-violet-400">{items.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Ganho Realizado</p>
          <p className="text-xl font-bold text-emerald-400">{fmtBRL(totalGanho)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Runs Auto-Pilot</p>
          <p className="text-xl font-bold text-blue-400">{autopilotLogs.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
          <button
            onClick={() => setActiveTab('acoes')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              activeTab === 'acoes' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <CheckCircle2 size={14} /> Ações
            {items.length > 0 && (
              <span className={cn('rounded-full px-1.5 text-xs font-bold', activeTab === 'acoes' ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-400')}>
                {items.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('autopilot')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              activeTab === 'autopilot' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <Bot size={14} /> Auto-Pilot
            {autopilotLogs.length > 0 && (
              <span className={cn('rounded-full px-1.5 text-xs font-bold', activeTab === 'autopilot' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-400')}>
                {autopilotLogs.length}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={fetchHistory}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'acoes' && (
            <motion.div key="acoes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {items.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
                  <History size={36} className="mx-auto mb-3 text-zinc-700" />
                  <p className="text-zinc-500 text-sm">Nenhuma ação executada ainda.</p>
                  <p className="text-xs text-zinc-600 mt-1">Vá para Insights e execute as recomendações da IA.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -2 }}
                      transition={{ delay: i * 0.03, type: 'spring', stiffness: 380, damping: 28 }}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden hover:border-zinc-700/60 transition-colors"
                    >
                      <button
                        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-zinc-800/40 transition-colors"
                      >
                        <span className="shrink-0">{typeIcon(item.execution_type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white truncate">{item.titulo}</p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/15 border border-violet-600/25 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400 uppercase tracking-wide">
                              <Sparkles size={7} /> IA
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-zinc-500">{typeLabel(item.execution_type)}</span>
                            <span className="text-[11px] text-zinc-600">
                              {new Date(item.executed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <span
                          className="shrink-0 text-sm font-bold text-emerald-400"
                          style={{ textShadow: '0 0 10px rgba(52,211,153,0.5)' }}
                        >
                          + {fmtBRL(item.ganho_realizado)}
                        </span>
                      </button>

                      {expanded === item.id && item.execution_log && (
                        <div className="px-5 pb-4">
                          <div className="rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-3">
                            <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wide mb-2">Log de execução</p>
                            <p className="text-[11px] font-mono text-zinc-400 break-all">{item.execution_log}</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'autopilot' && (
            <motion.div key="autopilot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {autopilotLogs.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
                  <Bot size={36} className="mx-auto mb-3 text-zinc-700" />
                  <p className="text-zinc-500 text-sm">Nenhuma execução do Auto-Pilot ainda.</p>
                  <p className="text-xs text-zinc-600 mt-1">Ative o Auto-Pilot no Dashboard para começar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {autopilotLogs.map((log, i) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600/20">
                            <Bot size={16} className="text-violet-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Auto-Pilot Run</p>
                            <p className="text-[11px] text-zinc-500">
                              {triggeredByLabel(log.triggered_by)} ·{' '}
                              {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <CheckCircle2 size={11} className="text-emerald-400" />
                            <p className="text-[10px] text-zinc-500">Executadas</p>
                          </div>
                          <p className="text-lg font-bold text-emerald-400">{log.actions_executed}</p>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <XCircle size={11} className="text-red-400" />
                            <p className="text-[10px] text-zinc-500">Falhas</p>
                          </div>
                          <p className="text-lg font-bold text-red-400">{log.actions_failed}</p>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <Sparkles size={11} className="text-violet-400" />
                            <p className="text-[10px] text-zinc-500">Insights</p>
                          </div>
                          <p className="text-lg font-bold text-violet-400">{log.new_insights}</p>
                        </div>
                      </div>

                      {log.ai_summary && (
                        <div className="rounded-lg border border-violet-800/30 bg-violet-950/20 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Zap size={11} className="text-violet-400" />
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400">Resumo da IA</p>
                          </div>
                          <p className="text-xs leading-relaxed text-zinc-300">{log.ai_summary}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
