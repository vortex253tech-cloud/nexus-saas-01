'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  TrendingUp,
  Zap,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  Clock,
  Target,
  BarChart3,
  DollarSign,
  Activity,
} from 'lucide-react'
import { gerarDiagnostico, type Diagnostico } from '@/lib/diagnostico'
import type { Perfil } from '@/lib/types'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────

interface ResultadoData {
  perfil: Perfil | null
  nomeEmpresa?: string
  setor?: string
  metaMensal?: number | null
  principalDesafio?: string
  leadId?: string | null
  nome?: string
  email?: string
  stage?: string
  revenueRange?: string
  teamSize?: string
}

// ─── Score ring ───────────────────────────────────────────────

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const [animated, setAnimated] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 1400
    const start = Date.now()
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setAnimated(Math.round(ease * score))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, score])

  const dash = (animated / 100) * circ
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444'
  const label = score >= 70 ? 'Bom' : score >= 45 ? 'Atenção' : 'Crítico'

  return (
    <div ref={ref} className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}60)`, transition: 'none' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-extrabold text-white">{animated}</span>
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      </div>
    </div>
  )
}

// ─── Mini bar chart ───────────────────────────────────────────

function GanhoChart({ problemas, oportunidades }: { problemas: Diagnostico['problemas']; oportunidades: Diagnostico['oportunidades'] }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const max = Math.max(...[...problemas.map(p => p.perdaEstimada), ...oportunidades.map(o => o.ganhoEstimado)])

  return (
    <div ref={ref} className="space-y-2">
      {problemas.slice(0, 3).map((p, i) => (
        <div key={p.id} className="flex items-center gap-3">
          <span className="w-28 truncate text-right text-xs text-zinc-500">{p.categoria}</span>
          <div className="flex-1 overflow-hidden rounded-full bg-zinc-800 h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: `${(p.perdaEstimada / max) * 100}%` } : {}}
              transition={{ duration: 0.7, delay: i * 0.1, ease: 'easeOut' }}
              className="h-full rounded-full bg-red-500/70"
            />
          </div>
          <span className="w-20 text-xs text-red-400">-R$ {(p.perdaEstimada / 1000).toFixed(1)}k</span>
        </div>
      ))}
      <div className="my-2 h-px bg-zinc-800" />
      {oportunidades.slice(0, 3).map((o, i) => (
        <div key={o.id} className="flex items-center gap-3">
          <span className="w-28 truncate text-right text-xs text-zinc-500">{o.prazo}</span>
          <div className="flex-1 overflow-hidden rounded-full bg-zinc-800 h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: `${(o.ganhoEstimado / max) * 100}%` } : {}}
              transition={{ duration: 0.7, delay: i * 0.1 + 0.4, ease: 'easeOut' }}
              className="h-full rounded-full bg-emerald-500/70"
            />
          </div>
          <span className="w-20 text-xs text-emerald-400">+R$ {(o.ganhoEstimado / 1000).toFixed(1)}k</span>
        </div>
      ))}
    </div>
  )
}

// ─── Loading screen ───────────────────────────────────────────

const LOADING_STEPS = [
  'Analisando perfil do negócio…',
  'Comparando com benchmarks do setor…',
  'Identificando perdas invisíveis…',
  'Calculando oportunidades de ganho…',
  'Gerando diagnóstico personalizado…',
]

function LoadingScreen() {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    LOADING_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setStep(i), i * 600))
    })
    timers.push(setTimeout(() => setDone(true), LOADING_STEPS.length * 600 + 200))
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex w-full max-w-sm flex-col items-center gap-8"
      >
        {/* Animated logo pulse */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-violet-600/20" />
          <div className="absolute inset-2 animate-pulse rounded-full bg-violet-600/30" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 shadow-[0_0_32px_rgba(124,58,237,0.5)]">
            <Activity className="h-7 w-7 text-white" />
          </div>
        </div>

        <div className="w-full space-y-3">
          {LOADING_STEPS.map((label, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: i <= step ? 1 : 0.2, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex items-center gap-3"
            >
              {i < step || (done && i === step) ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : i === step ? (
                <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400" />
              ) : (
                <div className="h-4 w-4 shrink-0 rounded-full border border-zinc-700" />
              )}
              <span className={cn('text-sm', i <= step ? 'text-zinc-300' : 'text-zinc-600')}>
                {label}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────

export default function ResultadoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ResultadoData | null>(null)
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null)
  const [activeTab, setActiveTab] = useState<'problemas' | 'oportunidades'>('problemas')

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('nexus_resultado')
      if (raw) {
        const parsed: ResultadoData = JSON.parse(raw)
        setData(parsed)
        setDiagnostico(gerarDiagnostico(parsed))
      } else {
        // No data — redirect back
        router.replace('/start')
        return
      }
    } catch {
      router.replace('/start')
      return
    }

    // Artificial analysis delay for UX
    const t = setTimeout(() => setLoading(false), LOADING_STEPS.length * 600 + 600)
    return () => clearTimeout(t)
  }, [router])

  if (loading) return <LoadingScreen />
  if (!diagnostico || !data) return null

  const { score, problemas, oportunidades, perdaTotalEstimada, ganhoTotalEstimado, resumo, benchmarkLabel, benchmarkPct } = diagnostico
  const empresa = data.nomeEmpresa || 'Seu negócio'
  const perdaFmt = `R$ ${(perdaTotalEstimada / 1000).toFixed(0)}k`
  const ganhoFmt = `R$ ${(ganhoTotalEstimado / 1000).toFixed(0)}k`

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-64 top-0 h-[500px] w-[500px] rounded-full bg-violet-700/8 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-700/6 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <span className="text-lg font-bold tracking-tight text-white">
          <span className="text-violet-400">N</span>EXUS
        </span>
        <span className="rounded-full border border-violet-800/50 bg-violet-950/40 px-3 py-1 text-xs font-medium text-violet-300">
          Diagnóstico Gratuito
        </span>
      </nav>

      <div className="relative z-10 mx-auto max-w-4xl px-4 md:px-8">

        {/* ── Hero do diagnóstico ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-violet-400">
            Diagnóstico concluído
          </p>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            {empresa}, identificamos{' '}
            <span style={{
              background: 'linear-gradient(135deg, #fca5a5 0%, #ef4444 60%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {perdaFmt}/mês
            </span>{' '}
            em perdas
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">{resumo}</p>
        </motion.div>

        {/* ── Score + resumo financeiro ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {/* Score */}
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
            <ScoreRing score={score} />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-300">Saúde financeira</p>
              <p className="text-xs text-zinc-500">vs {benchmarkLabel}</p>
            </div>
          </div>

          {/* Perda total */}
          <div className="relative overflow-hidden rounded-2xl border border-red-900/40 bg-red-950/20 p-6">
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-red-500/10 blur-xl" />
            <AlertTriangle className="mb-3 h-5 w-5 text-red-400" />
            <p className="text-3xl font-extrabold text-red-300">{perdaFmt}</p>
            <p className="mt-1 text-sm font-medium text-zinc-300">perdidos por mês</p>
            <p className="mt-1 text-xs text-zinc-500">
              {problemas.length} problemas identificados
            </p>
          </div>

          {/* Oportunidade */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-6">
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-500/10 blur-xl" />
            <TrendingUp className="mb-3 h-5 w-5 text-emerald-400" />
            <p className="text-3xl font-extrabold text-emerald-300">{ganhoFmt}</p>
            <p className="mt-1 text-sm font-medium text-zinc-300">de ganho potencial/mês</p>
            <p className="mt-1 text-xs text-zinc-500">
              {oportunidades.length} oportunidades mapeadas
            </p>
          </div>
        </motion.div>

        {/* ── Gráfico ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">Impacto por categoria</h2>
              <p className="text-xs text-zinc-500">perdas vs oportunidades estimadas (R$/mês)</p>
            </div>
            <BarChart3 className="h-4 w-4 text-zinc-600" />
          </div>
          <GanhoChart problemas={problemas} oportunidades={oportunidades} />
          <div className="mt-4 flex items-center gap-6 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500/70" />Perda atual</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500/70" />Ganho potencial</span>
          </div>
        </motion.div>

        {/* ── Tabs problemas / oportunidades ─────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mb-6"
        >
          {/* Tab bar */}
          <div className="mb-4 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            {(['problemas', 'oportunidades'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 rounded-lg py-2.5 text-sm font-medium transition-all',
                  activeTab === tab
                    ? tab === 'problemas'
                      ? 'bg-red-950/60 text-red-300'
                      : 'bg-emerald-950/60 text-emerald-300'
                    : 'text-zinc-500 hover:text-zinc-300',
                )}
              >
                {tab === 'problemas' ? (
                  <span className="flex items-center justify-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {problemas.length} Problemas
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {oportunidades.length} Oportunidades
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Cards */}
          <AnimatePresence mode="wait">
            {activeTab === 'problemas' ? (
              <motion.div
                key="problemas"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {problemas.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
                  >
                    <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-red-500/5 blur-2xl" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-semibold',
                            p.impacto === 'alto' ? 'bg-red-950/60 text-red-400' :
                            p.impacto === 'medio' ? 'bg-amber-950/60 text-amber-400' :
                            'bg-zinc-800 text-zinc-400',
                          )}>
                            {p.impacto === 'alto' ? '🔴 Alto impacto' : p.impacto === 'medio' ? '🟡 Médio impacto' : '⚪ Baixo impacto'}
                          </span>
                          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                            {p.categoria}
                          </span>
                        </div>
                        <h3 className="mb-1 font-semibold text-white">{p.titulo}</h3>
                        <p className="text-sm leading-relaxed text-zinc-400">{p.descricao}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-red-400">
                          -R$ {(p.perdaEstimada / 1000).toFixed(1)}k
                        </p>
                        <p className="text-xs text-zinc-600">por mês</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="oportunidades"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {oportunidades.map((o, i) => (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
                  >
                    <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-semibold',
                            o.dificuldade === 'facil' ? 'bg-emerald-950/60 text-emerald-400' :
                            o.dificuldade === 'medio' ? 'bg-blue-950/60 text-blue-400' :
                            'bg-violet-950/60 text-violet-400',
                          )}>
                            {o.dificuldade === 'facil' ? '✅ Fácil de implementar' : o.dificuldade === 'medio' ? '⚡ Médio esforço' : '🔧 Requer planejamento'}
                          </span>
                          <span className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                            <Clock className="h-2.5 w-2.5" />
                            {o.prazo}
                          </span>
                        </div>
                        <h3 className="mb-1 font-semibold text-white">{o.titulo}</h3>
                        <p className="text-sm leading-relaxed text-zinc-400">{o.descricao}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-emerald-400">
                          +R$ {(o.ganhoEstimado / 1000).toFixed(1)}k
                        </p>
                        <p className="text-xs text-zinc-600">por mês</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Benchmark ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-400" />
            <h2 className="font-semibold text-white">Sua posição vs o setor</h2>
          </div>
          <p className="mb-4 text-sm text-zinc-400">
            Comparado com {benchmarkLabel.toLowerCase()}, você está no percentil{' '}
            <span className="font-semibold text-white">{benchmarkPct}%</span>. Com o NEXUS, empresas similares chegaram ao top 25% em 90 dias.
          </p>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${benchmarkPct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-violet-500"
            />
            {/* Top 25% marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-white/30"
              style={{ left: '75%' }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-zinc-600">
            <span>Abaixo da média</span>
            <span className="text-zinc-400">Top 25% →</span>
          </div>
        </motion.div>

        {/* ── CTA principal ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-violet-800/30 bg-gradient-to-br from-violet-950/60 via-zinc-950 to-zinc-950 p-8 text-center"
        >
          <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="pointer-events-none absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

          <div className="relative">
            <div className="mb-2 flex items-center justify-center gap-2">
              <DollarSign className="h-5 w-5 text-violet-400" />
              <span className="text-sm font-medium text-violet-300">
                Potencial de recuperação imediata
              </span>
            </div>
            <p className="mb-1 text-4xl font-extrabold text-white">
              {ganhoFmt}
              <span className="text-xl text-zinc-400">/mês</span>
            </p>
            <p className="mb-8 text-sm text-zinc-500">
              Estimativa conservadora com as primeiras 3 ações implementadas
            </p>

            <Link
              href="/planos"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-xl bg-violet-600 px-8 py-4 text-base font-bold text-white shadow-[0_0_40px_rgba(124,58,237,0.4)] transition-all hover:bg-violet-500 hover:shadow-[0_0_56px_rgba(124,58,237,0.55)] active:scale-[0.98]"
            >
              <Zap className="relative z-10 h-5 w-5" />
              <span className="relative z-10">Ativar meu NEXUS agora</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-zinc-600" />7 dias grátis</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-zinc-600" />Cancele quando quiser</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-zinc-600" />Diagnóstico salvo</span>
            </div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <div className="mt-6 flex justify-center">
          <motion.button
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            Voltar ao topo
          </motion.button>
        </div>
      </div>
    </div>
  )
}
