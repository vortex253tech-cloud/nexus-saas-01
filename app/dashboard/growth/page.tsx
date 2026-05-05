'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, RefreshCw, Loader2, Flame, Thermometer, Snowflake,
  DollarSign, Users, Zap, BarChart3, Target, ArrowUp, ArrowDown,
  AlertTriangle, CheckCircle2, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  total_leads:      number
  conversions:      number
  conversion_rate:  number
  revenue:          number
  avg_ticket:       number
  hot_leads:        number
  warm_leads:       number
  cold_leads:       number
}

interface DayData {
  date:        string
  leads:       number
  conversions: number
  revenue:     number
}

interface ChannelData {
  channel:         string
  leads:           number
  conversions:     number
  revenue:         number
  hot:             number
  conversion_rate: number
}

interface Funnel {
  captured:         number
  auto_replied:     number
  messages_sent:    number
  offers_generated: number
  payments_started: number
  payments_done:    number
  followups_sent:   number
}

interface Pipeline {
  new: number; qualified: number; proposal: number
  won: number; lost: number; nurture: number
}

interface Optimization {
  best_channel:        string | null
  worst_channel:       string | null
  recommendation:      string
  avg_conversion_rate: number
  flags:               string[]
}

interface AnalyticsData {
  summary:      Summary
  pipeline:     Pipeline
  tiers:        { HOT: number; WARM: number; COLD: number }
  by_day:       DayData[]
  by_channel:   ChannelData[]
  funnel:       Funnel
  campaigns:    Record<string, unknown>[]
  optimization: Optimization
  period_days:  number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp:  'WhatsApp',
  instagram: 'Instagram',
  site:      'Site',
  manual:    'Manual',
  other:     'Outro',
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n)
}

function fmtBrl(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// ─── Sparkline (CSS bars) ─────────────────────────────────────────────────────

function Sparkline({ data, field, color }: { data: DayData[]; field: 'leads' | 'conversions'; color: string }) {
  const values = data.map(d => d[field])
  const max    = Math.max(...values, 1)

  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.slice(-30).map((d, i) => {
        const h = Math.max((d[field] / max) * 100, 2)
        return (
          <div
            key={d.date}
            title={`${fmtDate(d.date)}: ${d[field]} ${field === 'leads' ? 'leads' : 'conversões'}`}
            className={cn('flex-1 rounded-t-sm transition-all', color)}
            style={{ height: `${h}%`, opacity: 0.4 + (i / data.length) * 0.6 }}
          />
        )
      })}
    </div>
  )
}

// ─── Funnel Viz ───────────────────────────────────────────────────────────────

function FunnelViz({ funnel }: { funnel: Funnel }) {
  const steps = [
    { label: 'Capturados',        value: funnel.captured,         color: 'bg-violet-500' },
    { label: 'Respondidos (IA)',   value: funnel.auto_replied,     color: 'bg-blue-500' },
    { label: 'Engajados',          value: funnel.messages_sent,    color: 'bg-sky-500' },
    { label: 'Follow-ups',         value: funnel.followups_sent,   color: 'bg-amber-500' },
    { label: 'Pagamento iniciado', value: funnel.payments_started, color: 'bg-orange-500' },
    { label: 'Convertidos',        value: funnel.payments_done,    color: 'bg-emerald-500' },
  ]
  const maxVal = Math.max(...steps.map(s => s.value), 1)

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const width = Math.max((step.value / maxVal) * 100, 2)
        const rate  = i > 0 ? (steps[i - 1].value > 0 ? Math.round((step.value / steps[i - 1].value) * 100) : 0) : 100
        return (
          <div key={step.label}>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>{step.label}</span>
              <div className="flex items-center gap-3">
                {i > 0 && (
                  <span className={cn('text-[10px]', rate >= 50 ? 'text-emerald-400' : rate >= 20 ? 'text-amber-400' : 'text-red-400')}>
                    {rate}% →
                  </span>
                )}
                <span className="font-medium text-white">{fmt(step.value)}</span>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-800">
              <motion.div
                className={cn('h-2.5 rounded-full', step.color)}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState(30)
  const [error,   setError]   = useState('')

  const fetchData = useCallback(async (days: number) => {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/sales/analytics?days=${days}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao carregar analytics'); return }
      setData(json)
    } catch {
      setError('Erro de conexão')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(period) }, [fetchData, period])

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 size={22} className="text-violet-400" />
            <h1 className="text-2xl font-bold text-white">Growth Engine</h1>
          </div>
          <p className="text-zinc-500 text-sm">
            Análise completa do funil — captura, conversão, receita e otimização
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                period === d ? 'bg-violet-600 text-white' : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white',
              )}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={() => fetchData(period)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      ) : data ? (
        <div className="space-y-6">

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total de Leads',      value: fmt(data.summary.total_leads),      icon: <Users size={14} />,        color: 'text-white' },
              { label: 'Conversões',           value: fmt(data.summary.conversions),       icon: <CheckCircle2 size={14} />, color: 'text-emerald-400', glow: 'rgba(52,211,153,0.5)' },
              { label: 'Taxa de Conversão',    value: `${data.summary.conversion_rate}%`, icon: <Target size={14} />,       color: 'text-violet-400', glow: 'rgba(124,58,237,0.4)' },
              { label: 'Receita',              value: fmtBrl(data.summary.revenue),        icon: <DollarSign size={14} />,   color: 'text-emerald-400', glow: 'rgba(52,211,153,0.5)' },
              { label: 'Ticket Médio',         value: fmtBrl(data.summary.avg_ticket),     icon: <TrendingUp size={14} />,   color: 'text-white' },
              { label: 'Leads HOT 🔥',         value: fmt(data.summary.hot_leads),         icon: <Flame size={14} />,        color: 'text-red-400',    glow: 'rgba(248,113,113,0.5)' },
              { label: 'Leads WARM',           value: fmt(data.summary.warm_leads),        icon: <Thermometer size={14} />,  color: 'text-amber-400' },
              { label: 'Leads COLD',           value: fmt(data.summary.cold_leads),        icon: <Snowflake size={14} />,    color: 'text-sky-400' },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ y: -2 }}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 nexus-card"
              >
                <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                  {card.icon}
                  <p className="text-[10px]">{card.label}</p>
                </div>
                <p
                  className={cn('text-xl font-bold tabular-nums', card.color)}
                  style={(card as typeof card & { glow?: string }).glow
                    ? { textShadow: `0 0 12px ${(card as typeof card & { glow?: string }).glow}` }
                    : {}}
                >
                  {card.value}
                </p>
              </motion.div>
            ))}
          </div>

          {/* ── Trend Chart + Funnel ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Trend */}
            <motion.div
              className="lg:col-span-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Leads por Dia ({period}d)</h2>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" /> Leads</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Conversões</span>
                </div>
              </div>
              {data.by_day.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-zinc-600 text-sm">Sem dados para o período</div>
              ) : (
                <>
                  <Sparkline data={data.by_day} field="leads" color="bg-violet-500" />
                  <div className="mt-2">
                    <Sparkline data={data.by_day} field="conversions" color="bg-emerald-500" />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-600">
                    <span>{fmtDate(data.by_day[0]?.date ?? '')}</span>
                    <span>{fmtDate(data.by_day[data.by_day.length - 1]?.date ?? '')}</span>
                  </div>
                </>
              )}
            </motion.div>

            {/* Funnel */}
            <motion.div
              className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            >
              <h2 className="text-sm font-semibold text-white mb-4">Funil de Conversão</h2>
              <FunnelViz funnel={data.funnel} />
            </motion.div>
          </div>

          {/* ── Channel Table + Pipeline ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Channel Breakdown */}
            <motion.div
              className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            >
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Performance por Canal</h2>
              </div>
              <div className="grid grid-cols-[1fr_56px_68px_80px_68px] text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-5 py-2.5 border-b border-zinc-800">
                <span>Canal</span>
                <span className="text-center">Leads</span>
                <span className="text-center">HOT</span>
                <span className="text-center">Conversões</span>
                <span className="text-right">Taxa</span>
              </div>
              {data.by_channel.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 text-sm">Sem dados</div>
              ) : (
                data.by_channel.map((ch, i) => (
                  <motion.div
                    key={ch.channel}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                    className="grid grid-cols-[1fr_56px_68px_80px_68px] items-center px-5 py-3 border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/20 transition-colors"
                  >
                    <span className="text-sm font-medium text-white">{CHANNEL_LABELS[ch.channel] ?? ch.channel}</span>
                    <span className="text-xs text-zinc-400 text-center">{fmt(ch.leads)}</span>
                    <span className="text-xs text-red-400 text-center">{fmt(ch.hot)}</span>
                    <span className="text-xs text-emerald-400 text-center">{fmt(ch.conversions)}</span>
                    <span className={cn(
                      'text-xs text-right font-bold',
                      ch.conversion_rate >= 10 ? 'text-emerald-400' : ch.conversion_rate >= 5 ? 'text-amber-400' : 'text-zinc-500',
                    )}>
                      {ch.conversion_rate}%
                    </span>
                  </motion.div>
                ))
              )}
            </motion.div>

            {/* Pipeline */}
            <motion.div
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            >
              <h2 className="text-sm font-semibold text-white mb-4">Pipeline</h2>
              {([
                ['new',       'Novos',    'text-zinc-400',    'bg-zinc-700'],
                ['qualified', 'Qualif.',  'text-blue-400',    'bg-blue-500'],
                ['proposal',  'Proposta', 'text-violet-400',  'bg-violet-500'],
                ['nurture',   'Nutrir',   'text-amber-400',   'bg-amber-500'],
                ['won',       'Ganhos',   'text-emerald-400', 'bg-emerald-500'],
                ['lost',      'Perdidos', 'text-red-400',     'bg-red-500'],
              ] as const).map(([key, label, textColor, barColor]) => {
                const count = data.pipeline[key as keyof Pipeline]
                const total = data.summary.total_leads || 1
                const pct   = Math.round((count / total) * 100)
                return (
                  <div key={key} className="mb-2.5 last:mb-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={textColor}>{label}</span>
                      <span className="text-zinc-400 font-medium">{fmt(count)} <span className="text-zinc-600 text-[10px]">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800">
                      <motion.div
                        className={cn('h-1.5 rounded-full', barColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                      />
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </div>

          {/* ── Auto-Optimization Engine ── */}
          <motion.div
            className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-violet-400" />
              <h2 className="text-sm font-semibold text-white">Auto-Optimization Engine</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Recommendation */}
              <div className="sm:col-span-2 rounded-xl border border-violet-500/20 bg-zinc-900/60 p-4">
                <p className="text-[10px] text-violet-400 font-medium uppercase tracking-wider mb-1">Recomendação</p>
                <p className="text-sm text-zinc-200">{data.optimization.recommendation}</p>
                {data.optimization.best_channel && (
                  <div className="mt-3 flex items-center gap-2">
                    <ArrowUp size={12} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-medium">
                      Melhor canal: {CHANNEL_LABELS[data.optimization.best_channel] ?? data.optimization.best_channel}
                    </span>
                  </div>
                )}
                {data.optimization.worst_channel && data.optimization.worst_channel !== data.optimization.best_channel && (
                  <div className="mt-1 flex items-center gap-2">
                    <ArrowDown size={12} className="text-red-400" />
                    <span className="text-xs text-red-400">
                      Pior canal: {CHANNEL_LABELS[data.optimization.worst_channel] ?? data.optimization.worst_channel}
                    </span>
                  </div>
                )}
              </div>
              {/* Flags */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <p className="text-[10px] text-amber-400 font-medium uppercase tracking-wider mb-2">
                  Alertas ({data.optimization.flags.length})
                </p>
                {data.optimization.flags.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 size={12} />
                    <span className="text-xs">Sistema saudável</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {data.optimization.flags.slice(0, 3).map((flag, i) => (
                      <p key={i} className="text-xs text-amber-300">{flag}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Campaigns ── */}
          {data.campaigns.length > 0 && (
            <motion.div
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            >
              <div className="px-5 py-3 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-white">Campanhas Ativas</h2>
              </div>
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px_96px] text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-5 py-2.5 border-b border-zinc-800">
                <span>Campanha</span>
                <span className="text-center">Plataforma</span>
                <span className="text-center">Leads</span>
                <span className="text-center">Conversões</span>
                <span className="text-center">Investido</span>
                <span className="text-right">ROI</span>
              </div>
              {data.campaigns.map((c: Record<string, unknown>, i) => {
                const spend   = Number(c.total_spend  ?? 0)
                const revenue = Number(c.revenue      ?? 0)
                const roi     = spend > 0 ? Math.round(((revenue - spend) / spend) * 100) : null

                return (
                  <motion.div
                    key={String(c.id)}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.04 }}
                    className="grid grid-cols-[1fr_80px_80px_80px_80px_96px] items-center px-5 py-3 border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/20 transition-colors"
                  >
                    <span className="text-sm font-medium text-white truncate">{String(c.name ?? '')}</span>
                    <span className="text-xs text-zinc-400 text-center capitalize">{String(c.platform ?? '')}</span>
                    <span className="text-xs text-zinc-300 text-center">{fmt(Number(c.leads_count ?? 0))}</span>
                    <span className="text-xs text-emerald-400 text-center">{fmt(Number(c.conversions ?? 0))}</span>
                    <span className="text-xs text-zinc-400 text-center">{fmtBrl(spend)}</span>
                    <span className={cn(
                      'text-xs text-right font-bold',
                      roi === null ? 'text-zinc-600' : roi > 0 ? 'text-emerald-400' : 'text-red-400',
                    )}>
                      {roi === null ? '—' : `${roi > 0 ? '+' : ''}${roi}%`}
                    </span>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

        </div>
      ) : null}
    </div>
  )
}
