'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, TrendingDown, TrendingUp, AlertTriangle,
  Loader2, Zap, RefreshCw, Sparkles, MessageSquare,
  ShieldAlert, BarChart3, Users,
} from 'lucide-react'
import { resolveCompanyId } from '@/lib/get-company-id'
import { cn } from '@/lib/cn'

interface Metrics {
  total_pending: number
  total_overdue: number
  total_paid: number
  total_invoiced: number
  default_rate: string
  customer_count: number
}
interface Debtor { name: string; total_overdue: number; invoice_count: number }
interface AIAnalysis { risk_level: string; risk_reason: string; summary: string; top_actions: string[]; alert?: string }

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

const RISK_CONFIG: Record<string, { label: string; color: string; border: string; badge: string }> = {
  baixo:   { label: 'Risco Baixo',   color: 'text-emerald-400', border: 'border-emerald-500/30', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  médio:   { label: 'Risco Médio',   color: 'text-yellow-400',  border: 'border-yellow-500/30',  badge: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/30'  },
  alto:    { label: 'Risco Alto',    color: 'text-orange-400',  border: 'border-orange-500/30',  badge: 'bg-orange-500/15  text-orange-400  border-orange-500/30'  },
  crítico: { label: 'Risco Crítico', color: 'text-red-400',     border: 'border-red-500/30',     badge: 'bg-red-500/15     text-red-400     border-red-500/30'     },
}

export default function FinanceiroPage() {
  const [metrics, setMetrics]   = useState<Metrics | null>(null)
  const [debtors, setDebtors]   = useState<Debtor[]>([])
  const [ai, setAi]             = useState<AIAnalysis | null>(null)
  const [loading, setLoading]   = useState(true)
  const [running, setRunning]   = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    void resolveCompanyId().then(cid => { if (cid) setCompanyId(cid) })
  }, [])

  useEffect(() => { if (companyId) void load() }, [companyId])

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/ai/financial-insights', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ company_id: companyId }),
      })
      const data = await res.json()
      setMetrics(data.metrics)
      setDebtors(data.top_debtors ?? [])
      setAi(data.ai_analysis)
    } finally {
      setLoading(false)
    }
  }

  async function runAutopilot() {
    setRunning(true)
    try {
      const res  = await fetch('/api/cron/charge')
      const data = await res.json()
      alert(`Autopilot executado!\n${data.charges_sent as number} cobranças enviadas\n${data.marked_overdue as number} novas vencidas detectadas`)
      void load()
    } finally {
      setRunning(false)
    }
  }

  const riskCfg = RISK_CONFIG[ai?.risk_level ?? ''] ?? RISK_CONFIG.médio
  const defaultRate = parseFloat(metrics?.default_rate ?? '0')

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 size={32} className="animate-spin text-violet-400" />
            <span className="absolute inset-0 rounded-full bg-violet-500/10 animate-ping" />
          </div>
          <p className="text-zinc-400 text-sm">IA analisando finanças...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 size={24} className="text-violet-400" />
            Dashboard Financeiro
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Análise inteligente do seu fluxo financeiro</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => void runAutopilot()}
          disabled={running}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-all"
          style={{
            background: running
              ? 'rgba(124,58,237,0.4)'
              : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            boxShadow: running ? 'none' : '0 0 20px rgba(124,58,237,0.35)',
          }}
        >
          {running
            ? <><Loader2 size={14} className="animate-spin" /> Executando...</>
            : <><Zap size={14} /> Iniciar Auto-Pilot</>
          }
        </motion.button>
      </div>

      {/* AI Alert */}
      <AnimatePresence>
        {ai?.alert && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/8 p-4"
          >
            <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">Alerta Crítico</p>
              <p className="text-xs text-zinc-400 mt-0.5">{ai.alert}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'A Receber',
            value: fmt(metrics?.total_pending ?? 0),
            icon: <DollarSign size={16} />,
            color: 'text-blue-400',
            bg:   'bg-blue-500/10 border-blue-500/25',
            glow: false,
          },
          {
            label: 'Total Vencido',
            value: fmt(metrics?.total_overdue ?? 0),
            icon: <TrendingDown size={16} />,
            color: 'text-red-400',
            bg:   'bg-red-500/10 border-red-500/25',
            glow: false,
          },
          {
            label: 'Total Recebido',
            value: fmt(metrics?.total_paid ?? 0),
            icon: <TrendingUp size={16} />,
            color: 'text-emerald-400',
            bg:   'bg-emerald-500/10 border-emerald-500/25',
            glow: true,
          },
          {
            label: 'Inadimplência',
            value: metrics?.default_rate ?? '0%',
            icon: <AlertTriangle size={16} />,
            color: defaultRate > 20 ? 'text-red-400' : 'text-yellow-400',
            bg:   defaultRate > 20 ? 'bg-red-500/10 border-red-500/25' : 'bg-yellow-500/10 border-yellow-500/25',
            glow: false,
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 360, damping: 26 }}
            whileHover={{ y: -2 }}
            className={cn('rounded-xl border p-4 nexus-card', card.bg)}
          >
            <div className={cn('mb-2', card.color)}>{card.icon}</div>
            <p className="text-[10px] text-zinc-500 mb-1">{card.label}</p>
            <p
              className={cn('text-lg font-bold', card.color)}
              style={card.glow ? { textShadow: '0 0 12px rgba(52,211,153,0.5)' } : {}}
            >
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* AI Analysis */}
        {ai && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
            className={cn(
              'rounded-2xl border p-5 nexus-card bg-zinc-900',
              riskCfg.border,
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/15 border border-violet-600/20">
                  <Sparkles size={14} className="text-violet-400" />
                </div>
                <p className="font-semibold text-white text-sm">Análise IA</p>
              </div>
              <span className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                riskCfg.badge,
              )}>
                {riskCfg.label}
              </span>
            </div>

            <p className="text-sm text-zinc-400 mb-4 leading-relaxed">{ai.summary}</p>

            {ai.top_actions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
                  Ações Recomendadas
                </p>
                <ul className="space-y-2">
                  {ai.top_actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-[9px] font-bold text-violet-400 mt-0.5">
                        {i + 1}
                      </span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* Top Debtors */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 nexus-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
              <Users size={14} className="text-red-400" />
            </div>
            <p className="font-semibold text-white text-sm">Maiores Devedores</p>
          </div>

          {debtors.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <TrendingUp size={24} className="text-emerald-400 mb-2" />
              <p className="text-sm font-medium text-emerald-400">Nenhum devedor em atraso</p>
              <p className="text-xs text-zinc-600 mt-1">Sua carteira está saudável</p>
            </div>
          ) : (
            <div className="space-y-3">
              {debtors.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-800/30 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{d.name}</p>
                    <p className="text-[10px] text-zinc-500">{d.invoice_count} fatura(s)</p>
                  </div>
                  <span className="text-sm font-bold text-red-400 ml-3 shrink-0">
                    {fmt(d.total_overdue)}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-3 flex-wrap">
        <motion.a
          href="/dashboard/assistant"
          whileHover={{ y: -1 }}
          className="flex items-center gap-1.5 rounded-lg border border-violet-600/25 bg-violet-600/8 px-4 py-2 text-sm text-violet-400 hover:border-violet-500/40 transition-colors"
        >
          <MessageSquare size={13} /> Perguntar à IA
        </motion.a>
        <motion.button
          onClick={() => void load()}
          whileHover={{ y: -1 }}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw size={13} /> Atualizar
        </motion.button>
      </div>
    </div>
  )
}
