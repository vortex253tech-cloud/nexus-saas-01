'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Zap, Brain, TrendingUp, Users, CheckCircle2,
  Bot, Rocket, BarChart3, Shield, Target, Activity,
  DollarSign, RefreshCw, Layers, Sparkles, Play,
  AlertTriangle, Clock, GitBranch, Loader2, CheckCircle,
  Copy, Share2, Gift, Award,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface WaitlistForm {
  name: string
  email: string
  company: string
  teamSize: string
}

// ─── Static data ───────────────────────────────────────────────────────────

const PAIN_POINTS = [
  { icon: AlertTriangle, label: 'Excesso de ferramentas', desc: '14 apps diferentes, zero visibilidade unificada', color: '#ef4444' },
  { icon: Clock,         label: 'Operação lenta',         desc: 'Tarefas manuais que deveriam ser automáticas',  color: '#f59e0b' },
  { icon: Layers,        label: 'Processos fragmentados', desc: 'Dados em silos, decisões tomadas no escuro',    color: '#f97316' },
  { icon: Users,         label: 'Equipe sobrecarregada',  desc: 'Pessoas fazendo o trabalho que a máquina faria', color: '#8b5cf6' },
  { icon: BarChart3,     label: 'Baixa eficiência',       desc: 'Crescimento limitado pela capacidade humana',   color: '#06b6d4' },
  { icon: GitBranch,     label: 'Caos operacional',       desc: 'Sem sistema, sem controle, sem escala possível', color: '#ec4899' },
]

const DEMO_CARDS = [
  {
    icon: DollarSign, badge: 'Cobrança IA', glow: '#8b5cf6',
    title: 'Cobranças automáticas',
    desc: 'A IA identifica inadimplentes, redige mensagens personalizadas e faz follow-up — sem você mover um dedo.',
    metric: '+67%', metricLabel: 'taxa de recuperação',
  },
  {
    icon: Rocket, badge: 'Campanhas IA', glow: '#06b6d4',
    title: 'Campanhas criadas em segundos',
    desc: 'Segmenta clientes, cria copies, dispara e-mails e mede resultados. Tudo com inteligência artificial.',
    metric: '3×', metricLabel: 'mais velocidade',
  },
  {
    icon: BarChart3, badge: 'Insights IA', glow: '#10b981',
    title: 'Diagnóstico financeiro diário',
    desc: 'Analisa DRE, fluxo de caixa e métricas. Entrega recomendações acionáveis todo dia, sem você pedir.',
    metric: '+43%', metricLabel: 'decisões corretas',
  },
  {
    icon: Bot, badge: 'Automações', glow: '#f59e0b',
    title: 'Operações no piloto automático',
    desc: 'Defina regras, o NEXUS executa. Alertas, ações e processos rodando 24h por dia, 7 dias por semana.',
    metric: '80%', metricLabel: 'menos trabalho manual',
  },
]

const TRANSFORMATIONS = [
  { icon: Zap,        title: 'Velocidade operacional 10×', desc: 'Processos que levavam dias acontecem em minutos.' },
  { icon: Target,     title: 'Decisões baseadas em dados', desc: 'IA analisa, você decide com informação real e precisa.' },
  { icon: RefreshCw,  title: 'Crescimento contínuo',       desc: 'Sistema que aprende e melhora com o tempo.' },
  { icon: Shield,     title: 'Zero caos operacional',      desc: 'Tudo organizado, monitorado e em ordem absoluta.' },
  { icon: Activity,   title: 'Execução sem parar',         desc: 'A IA trabalha enquanto você dorme.' },
  { icon: TrendingUp, title: 'Faturamento em escala',      desc: 'Automações que diretamente aumentam sua receita.' },
]

const STATS = [
  { value: '127+',     label: 'empresas na waitlist',        sub: 'e crescendo todo dia' },
  { value: 'R$ 2.4M',  label: 'em operações automatizadas',  sub: 'só no beta fechado' },
  { value: '+43%',     label: 'aumento operacional médio',    sub: 'dos early adopters' },
  { value: '89%',      label: 'redução de tarefas manuais',  sub: 'no primeiro mês' },
]

const AI_ACTIONS = [
  { time: '09:14', text: 'Cobrança enviada para 12 clientes inadimplentes',  color: '#8b5cf6' },
  { time: '09:15', text: 'Campanha de reativação disparada — 847 contatos',   color: '#06b6d4' },
  { time: '09:16', text: 'Alerta: margem bruta caiu 3.2% — investigando...', color: '#f59e0b' },
  { time: '09:17', text: 'Relatório executivo gerado e enviado ao CEO',       color: '#10b981' },
  { time: '09:18', text: 'Follow-up automático para 23 leads quentes',        color: '#8b5cf6' },
]

const TEAM_SIZES = ['Só eu', '2–10', '11–50', '51–200', '200+']

// Fixed particle positions — no Math.random() to avoid hydration mismatch
const PARTICLES = [
  { x: 8,  y: 12, s: 2,   d: 9,  dl: 0.0, o: 0.25 },
  { x: 23, y: 38, s: 1.5, d: 7,  dl: 1.2, o: 0.18 },
  { x: 45, y: 8,  s: 3,   d: 11, dl: 0.5, o: 0.30 },
  { x: 67, y: 25, s: 1,   d: 8,  dl: 2.1, o: 0.20 },
  { x: 82, y: 15, s: 2.5, d: 10, dl: 0.8, o: 0.22 },
  { x: 12, y: 65, s: 2,   d: 6,  dl: 3.0, o: 0.15 },
  { x: 34, y: 72, s: 1.5, d: 9,  dl: 1.5, o: 0.18 },
  { x: 56, y: 58, s: 2,   d: 7,  dl: 0.3, o: 0.25 },
  { x: 78, y: 80, s: 1,   d: 8,  dl: 2.5, o: 0.12 },
  { x: 91, y: 45, s: 3,   d: 12, dl: 0.7, o: 0.28 },
  { x: 19, y: 90, s: 1.5, d: 6,  dl: 1.8, o: 0.16 },
  { x: 63, y: 88, s: 2.5, d: 10, dl: 0.4, o: 0.20 },
  { x: 87, y: 62, s: 2,   d: 7,  dl: 3.2, o: 0.22 },
  { x: 42, y: 45, s: 1,   d: 9,  dl: 1.1, o: 0.14 },
  { x: 6,  y: 52, s: 2,   d: 8,  dl: 2.8, o: 0.19 },
]

const CHART_BARS = [38, 52, 44, 68, 55, 78, 65, 82, 70, 90, 80, 100]

const NEURAL_NODES = [
  { label: 'Cobranças',  color: '#8b5cf6', angle: 0   },
  { label: 'Campanhas',  color: '#06b6d4', angle: 72  },
  { label: 'Métricas',   color: '#10b981', angle: 144 },
  { label: 'Automações', color: '#f59e0b', angle: 216 },
  { label: 'Relatórios', color: '#ec4899', angle: 288 },
]

// ─── Particle Field ────────────────────────────────────────────────────────

function ParticleField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-violet-400"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, opacity: p.o }}
          animate={{ y: [-15, 15, -15], opacity: [p.o, p.o * 0.3, p.o] }}
          transition={{ duration: p.d, delay: p.dl, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <motion.div
        className="absolute top-1/4 left-1/3 h-[480px] w-[480px] rounded-full bg-violet-700/10 blur-[110px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/3 right-1/4 h-72 w-72 rounded-full bg-cyan-700/7 blur-3xl"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.38, 0.2] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

// ─── Dashboard Mockup ──────────────────────────────────────────────────────

function DashboardMockup() {
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActiveIdx(i => (i + 1) % AI_ACTIONS.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative w-full">
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-600/22 via-cyan-600/12 to-violet-600/22 blur-xl" />
      <div className="relative rounded-2xl border border-white/8 bg-[#08080f] overflow-hidden shadow-2xl">

        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/75" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/75" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]/75" />
            </div>
            <span className="ml-2 text-[11px] text-white/28 font-mono tracking-wide">nexus — centro operacional</span>
          </div>
          <div className="flex items-center gap-1.5">
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[10px] text-emerald-400/65 font-mono">IA operando</span>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3 p-4">
          {[
            { label: 'Faturamento',   value: 'R$ 94.2k', trend: '↑ 12% vs mês ant.', color: '#10b981' },
            { label: 'Inadimplência', value: 'R$ 8.1k',  trend: '↓ 34% recuperado',  color: '#8b5cf6' },
            { label: 'Eficiência IA', value: '94%',      trend: '↑ 7 pts este mês',  color: '#06b6d4' },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.12 }}
              className="rounded-xl border border-white/4 bg-white/[0.02] p-3"
            >
              <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1">{m.label}</p>
              <p className="text-sm font-bold text-white">{m.value}</p>
              <p className="text-[9px] mt-0.5" style={{ color: m.color }}>{m.trend}</p>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        <div className="mx-4 mb-3 rounded-xl border border-white/4 bg-white/[0.012] p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] text-white/28 uppercase tracking-wider">Receita — últimos 12 meses</span>
            <span className="text-[9px] text-violet-400 font-semibold">↑ 43%</span>
          </div>
          <div className="flex items-end gap-1 h-14">
            {CHART_BARS.map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-[2px]"
                style={{ background: `linear-gradient(to top, rgba(124,58,237,0.8), rgba(6,182,212,0.5))`, opacity: 0.45 + (i / CHART_BARS.length) * 0.55 }}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.7, delay: 1 + i * 0.04, ease: 'easeOut' }}
              />
            ))}
          </div>
        </div>

        {/* AI Activity */}
        <div className="mx-4 mb-4 rounded-xl border border-white/4 bg-black/25 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-violet-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-[9px] text-white/28 font-mono uppercase tracking-wider">IA em ação — ao vivo</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.22 }}
              className="flex items-center gap-2"
            >
              <span className="shrink-0 text-[9px] text-white/22 font-mono">{AI_ACTIONS[activeIdx].time}</span>
              <span className="text-[10px] leading-snug" style={{ color: AI_ACTIONS[activeIdx].color }}>
                {AI_ACTIONS[activeIdx].text}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ─── Section wrapper ───────────────────────────────────────────────────────

function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`relative px-6 py-24 md:py-32 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

// ─── Animated stat ─────────────────────────────────────────────────────────

function AnimatedStat({ stat, index }: { stat: typeof STATS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.1 }}
      className="text-center"
    >
      <motion.p
        initial={{ opacity: 0, scale: 0.85 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, delay: index * 0.1 + 0.12 }}
        className="text-4xl md:text-5xl font-bold"
        style={{ background: 'linear-gradient(135deg, #a855f7, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
      >
        {stat.value}
      </motion.p>
      <p className="mt-2 text-sm font-medium text-white/65">{stat.label}</p>
      <p className="mt-0.5 text-xs text-white/32">{stat.sub}</p>
    </motion.div>
  )
}

// ─── HERO ──────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#04040a] flex flex-col">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full bg-violet-600/11 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#04040a] to-transparent" />
      </div>

      <ParticleField />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-900/50" />
          <span className="text-lg font-bold text-white tracking-tight">NEXUS</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/38">
          {([['#problema','Problema'],['#solucao','Solução'],['#demo','Demo'],['#waitlist','Waitlist']] as [string,string][]).map(([href, label]) => (
            <a key={href} href={href} className="hover:text-white/75 transition-colors">{label}</a>
          ))}
        </div>
        <Link href="/login" className="rounded-full border border-white/10 bg-white/3 px-4 py-1.5 text-sm text-white/50 hover:text-white hover:border-white/22 hover:bg-white/7 transition-all">
          Entrar
        </Link>
      </nav>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-8 pb-16 text-center">

        {/* Live badge */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-500/22 bg-violet-500/7 px-4 py-1.5 backdrop-blur-sm"
        >
          <motion.div className="h-1.5 w-1.5 rounded-full bg-violet-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          <span className="text-xs font-medium text-violet-300 tracking-wide">Beta limitado — vagas quase esgotadas</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-[82px] font-bold tracking-tight text-white leading-[1.04] max-w-4xl"
        >
          Sua empresa
          <br />
          <span style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 35%, #06b6d4 75%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            operada por IA.
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24 }}
          className="mt-6 max-w-2xl text-lg md:text-xl text-white/42 leading-relaxed"
        >
          O primeiro sistema operacional empresarial com inteligência artificial capaz de{' '}
          <span className="text-white/72">executar tarefas, automatizar operações</span> e aumentar
          seu faturamento — sem aumentar sua equipe.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.36 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4"
        >
          <a
            href="#waitlist"
            className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-900/40 hover:shadow-violet-700/50 hover:from-violet-500 hover:to-violet-400 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
          >
            Entrar na lista de espera
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </a>
          <a
            href="#demo"
            className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/3 px-8 py-3.5 text-sm font-semibold text-white/55 hover:text-white hover:border-white/22 hover:bg-white/7 transition-all duration-200"
          >
            <Play size={13} className="fill-current" />
            Ver demonstração
          </a>
        </motion.div>

        {/* Social row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.58 }}
          className="mt-7 flex items-center gap-2.5 text-xs text-white/25"
        >
          <div className="flex -space-x-2">
            {['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899'].map((c, i) => (
              <div key={i} className="h-6 w-6 rounded-full border-2 border-[#04040a]" style={{ background: c }} />
            ))}
          </div>
          <span>+127 empresas já garantiram acesso antecipado</span>
        </motion.div>

        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.52, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 w-full max-w-3xl"
        >
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  )
}

// ─── PROBLEM ───────────────────────────────────────────────────────────────

function ProblemSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <Section id="problema" className="bg-[#04040a] border-t border-white/[0.035]">
      <div ref={ref}>
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-5 inline-block rounded-full border border-red-500/16 bg-red-500/5 px-3 py-1 text-xs font-medium text-red-400/75"
          >
            O problema real
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.08 }}
            className="text-4xl md:text-5xl font-bold text-white"
          >
            Empresas ainda{' '}
            <span className="text-white/28">operam manualmente.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.18 }}
            className="mt-4 text-white/38 max-w-lg mx-auto leading-relaxed"
          >
            Enquanto a tecnologia evoluiu, a forma de operar empresas ficou presa no passado.
            Você está deixando dinheiro na mesa todo dia.
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PAIN_POINTS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 18 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.08 + i * 0.07 }}
              className="group relative rounded-2xl border border-white/[0.045] bg-white/[0.016] p-6 overflow-hidden hover:border-white/9 transition-all duration-300"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(circle at 0% 0%, ${p.color}0b, transparent 65%)` }}
              />
              <div className="relative">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border" style={{ borderColor: `${p.color}24`, background: `${p.color}0b` }}>
                  <p.icon size={17} style={{ color: p.color }} />
                </div>
                <h3 className="font-semibold text-white mb-1.5 text-[15px]">{p.label}</h3>
                <p className="text-sm text-white/36">{p.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── NEW ERA ───────────────────────────────────────────────────────────────

function NewEraSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const capabilities = [
    'Entende suas operações em profundidade',
    'Executa tarefas complexas automaticamente',
    'Cobra clientes e recupera receita perdida',
    'Cria e dispara campanhas de marketing',
    'Monitora métricas e gera alertas inteligentes',
    'Aumenta seu faturamento no piloto automático',
    'Gera estratégias baseadas em dados reais',
    'Opera 24 horas por dia, 7 dias por semana',
  ]

  return (
    <Section id="solucao" className="bg-gradient-to-b from-[#04040a] via-[#060410] to-[#04040a] border-t border-white/[0.035]">
      <div ref={ref} className="grid md:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-5 inline-block rounded-full border border-violet-500/18 bg-violet-500/6 px-3 py-1 text-xs font-medium text-violet-400"
          >
            A nova era chegou
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.08 }}
            className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6"
          >
            O futuro das empresas{' '}
            <span style={{ background: 'linear-gradient(135deg, #a855f7, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              é autônomo.
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.18 }}
            className="text-white/40 leading-relaxed mb-9"
          >
            NEXUS não é um software. É um sistema operacional vivo que compreende seu negócio,
            aprende com seus dados e age em seu nome — com ou sem você presente.
          </motion.p>

          <div className="space-y-3">
            {capabilities.map((cap, i) => (
              <motion.div
                key={cap}
                initial={{ opacity: 0, x: -14 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.22 + i * 0.05 }}
                className="flex items-center gap-3"
              >
                <div className="flex-shrink-0 h-[18px] w-[18px] rounded-full bg-violet-500/12 border border-violet-500/25 flex items-center justify-center">
                  <CheckCircle2 size={10} className="text-violet-400" />
                </div>
                <span className="text-sm text-white/55">{cap}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right — neural visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.28 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/12 to-cyan-600/10 rounded-3xl blur-3xl" />
          <div className="relative rounded-2xl border border-white/6 bg-[#07070e] p-8 overflow-hidden">
            <div className="relative h-72 flex items-center justify-center">
              {/* Rotating rings */}
              <motion.div className="absolute h-52 w-52 rounded-full border border-violet-500/8" animate={{ rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }} />
              <motion.div className="absolute h-36 w-36 rounded-full border border-cyan-500/6" animate={{ rotate: -360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} />

              {/* Center node */}
              <motion.div
                className="relative z-10 h-[58px] w-[58px] rounded-full border border-violet-500/38 bg-violet-600/12 flex items-center justify-center"
                animate={{ boxShadow: ['0 0 18px rgba(139,92,246,0.22)', '0 0 42px rgba(139,92,246,0.52)', '0 0 18px rgba(139,92,246,0.22)'] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <Brain size={22} className="text-violet-300" />
              </motion.div>

              {/* Orbit nodes */}
              {NEURAL_NODES.map((n, i) => {
                const rad = (n.angle * Math.PI) / 180
                const x = Math.cos(rad) * 92
                const y = Math.sin(rad) * 92
                return (
                  <motion.div
                    key={n.label}
                    className="absolute"
                    style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%,-50%)' }}
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.55 + i * 0.1 }}
                  >
                    <motion.div
                      className="h-10 w-10 rounded-full border flex items-center justify-center"
                      style={{ borderColor: `${n.color}30`, background: `${n.color}10`, color: n.color }}
                      animate={{ scale: [1, 1.12, 1] }}
                      transition={{ duration: 3.2, delay: i * 0.55, repeat: Infinity }}
                    >
                      <span className="text-[8px] font-semibold">{n.label.slice(0, 3)}</span>
                    </motion.div>
                  </motion.div>
                )
              })}

              {/* SVG lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.13 }}>
                {NEURAL_NODES.map((n, i) => {
                  const rad = (n.angle * Math.PI) / 180
                  const x = 50 + Math.cos(rad) * 34
                  const y = 50 + Math.sin(rad) * 34
                  return <line key={i} x1="50%" y1="50%" x2={`${x}%`} y2={`${y}%`} stroke="#8b5cf6" strokeWidth="1" strokeDasharray="3,5" />
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between text-[10px] text-white/22 mt-2">
              <span className="font-mono">NEXUS OS v2.1</span>
              <div className="flex items-center gap-1.5">
                <motion.div className="h-1.5 w-1.5 rounded-full bg-emerald-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                <span className="text-emerald-400/55">Todos sistemas ativos</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  )
}

// ─── DEMO ──────────────────────────────────────────────────────────────────

function DemoSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <Section id="demo" className="bg-[#04040a] border-t border-white/[0.035]">
      <div ref={ref}>
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-5 inline-block rounded-full border border-cyan-500/16 bg-cyan-500/5 px-3 py-1 text-xs font-medium text-cyan-400/75"
          >
            IA em ação
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.08 }}
            className="text-4xl md:text-5xl font-bold text-white"
          >
            Veja o NEXUS{' '}
            <span className="text-white/26">trabalhando.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.18 }}
            className="mt-4 text-white/36 max-w-sm mx-auto"
          >
            Casos de uso reais. Resultados reais. Tudo automatizado pela IA.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {DEMO_CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 22 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.08 + i * 0.09 }}
              className="group relative rounded-2xl border border-white/[0.045] bg-[#07070e] p-7 overflow-hidden cursor-default"
              whileHover={{ scale: 1.018, transition: { duration: 0.18 } }}
            >
              {/* Hover glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                style={{ background: `radial-gradient(circle at 25% 25%, ${card.glow}11, transparent 60%)` }}
              />
              {/* Bottom line */}
              <div
                className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(to right, transparent, ${card.glow}45, transparent)` }}
              />

              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${card.glow}11`, border: `1px solid ${card.glow}22` }}>
                    <card.icon size={16} style={{ color: card.glow }} />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border" style={{ borderColor: `${card.glow}25`, color: card.glow, background: `${card.glow}0a` }}>
                    {card.badge}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
                <p className="text-sm text-white/38 leading-relaxed mb-7">{card.desc}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" style={{ color: card.glow }}>{card.metric}</span>
                  <span className="text-sm text-white/32">{card.metricLabel}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── BENEFITS ──────────────────────────────────────────────────────────────

function BenefitsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <Section className="bg-gradient-to-b from-[#04040a] via-[#060410] to-[#04040a] border-t border-white/[0.035]">
      <div ref={ref}>
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="text-4xl md:text-5xl font-bold text-white"
          >
            O que muda na{' '}
            <span style={{ background: 'linear-gradient(135deg, #a855f7, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              sua empresa.
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.14 }}
            className="mt-4 text-white/36 max-w-md mx-auto"
          >
            Não são funcionalidades. São transformações reais no dia a dia da sua operação.
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRANSFORMATIONS.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.07 + i * 0.07 }}
              className="group rounded-2xl border border-white/[0.045] bg-white/[0.015] p-6 hover:border-white/9 hover:bg-white/[0.025] transition-all duration-300"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/16 bg-violet-500/7">
                <t.icon size={17} className="text-violet-400" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-[15px]">{t.title}</h3>
              <p className="text-sm text-white/36">{t.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── SOCIAL PROOF ──────────────────────────────────────────────────────────

function SocialProofSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <Section className="bg-[#04040a] border-t border-white/[0.035]">
      <div ref={ref}>
        <div className="relative rounded-3xl border border-white/6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/16 via-[#07070e] to-cyan-950/8" />
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-violet-600/7 blur-[75px]" />

          <div className="relative px-8 py-14 md:px-16 md:py-16">
            <div className="text-center mb-14">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                className="text-3xl md:text-4xl font-bold text-white"
              >
                Empresas do futuro já usam NEXUS.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: 0.14 }}
                className="mt-3 text-white/32"
              >
                Números reais do beta fechado.
              </motion.p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
              {STATS.map((s, i) => <AnimatedStat key={s.label} stat={s} index={i} />)}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.65 }}
              className="mt-12 flex items-center justify-center gap-3 text-xs text-white/26"
            >
              <motion.div
                className="h-2 w-2 rounded-full bg-emerald-400"
                animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              />
              <span>Atualizando em tempo real · Última empresa entrou há 4 minutos</span>
            </motion.div>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── WAITLIST ──────────────────────────────────────────────────────────────

// ─── Referral tiers ───────────────────────────────────────────────────────
const REFERRAL_TIERS = [
  { count: 1,  label: 'Sobe 10 posições',     icon: TrendingUp, color: '#a855f7' },
  { count: 3,  label: 'Beta garantido',        icon: Award,      color: '#06b6d4' },
  { count: 10, label: 'Acesso imediato',       icon: Gift,       color: '#10b981' },
]

interface WaitlistResult {
  position: number
  referral_code: string
  referrals_count: number
  name: string
}

// ─── Referral success card ─────────────────────────────────────────────────
function ReferralSuccess({ result }: { result: WaitlistResult }) {
  const [copied, setCopied] = useState(false)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const referralUrl = `${baseUrl}/v1?ref=${result.referral_code}`

  function copyLink() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(
      `Entrei na waitlist do NEXUS — o Sistema Operacional Empresarial com IA. Automatiza operações inteiras, decide e executa sozinho. Use meu link para entrar antes:\n${referralUrl}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  function shareLinkedIn() {
    const url = encodeURIComponent(referralUrl)
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank')
  }

  const nextTier = REFERRAL_TIERS.find(t => t.count > result.referrals_count)
  const progressPct = nextTier
    ? Math.min(100, (result.referrals_count / nextTier.count) * 100)
    : 100

  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="p-8 space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}
          className="mx-auto mb-4 h-14 w-14 rounded-full bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center"
        >
          <CheckCircle size={26} className="text-emerald-400" />
        </motion.div>
        <h3 className="text-xl font-bold text-white mb-1">
          {result.name.split(' ')[0]}, você está na lista!
        </h3>
        <p className="text-white/40 text-sm">Posição confirmada. Agora acelere seu acesso.</p>
      </div>

      {/* Position badge */}
      <div className="flex items-center justify-center">
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/6 px-8 py-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Sua posição atual</p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-5xl font-black"
            style={{ background: 'linear-gradient(135deg, #a855f7, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            #{result.position}
          </motion.p>
          <p className="text-[10px] text-white/25 mt-1">de {result.position + 43} na lista</p>
        </div>
      </div>

      {/* Tier progress */}
      {nextTier && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">
              {result.referrals_count}/{nextTier.count} indicações para <span className="text-violet-300">{nextTier.label}</span>
            </span>
            <span className="text-white/25">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Tiers list */}
      <div className="space-y-2">
        {REFERRAL_TIERS.map((tier, i) => {
          const done = result.referrals_count >= tier.count
          const Icon = tier.icon
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-all ${
                done
                  ? 'border-emerald-500/25 bg-emerald-500/6'
                  : 'border-white/5 bg-white/[0.015]'
              }`}
            >
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: done ? `${tier.color}18` : 'transparent', border: `1px solid ${tier.color}30` }}
              >
                <Icon size={13} style={{ color: done ? tier.color : '#ffffff40' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${done ? 'text-white' : 'text-white/40'}`}>
                  {tier.count} indicaç{tier.count === 1 ? 'ão' : 'ões'} — {tier.label}
                </p>
              </div>
              {done && <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* Referral link */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-white/30">Seu link de indicação</p>
        <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
          <p className="flex-1 truncate text-xs text-white/50 font-mono">{referralUrl}</p>
          <button
            onClick={copyLink}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition-all hover:bg-violet-500/20 active:scale-95"
          >
            {copied ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Share buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={shareWhatsApp}
          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600/25 bg-emerald-600/8 py-3 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-600/15 active:scale-[0.98]"
        >
          <Share2 size={13} />
          Compartilhar no WhatsApp
        </button>
        <button
          onClick={shareLinkedIn}
          className="flex items-center justify-center gap-2 rounded-xl border border-blue-600/25 bg-blue-600/8 py-3 text-xs font-semibold text-blue-400 transition-all hover:bg-blue-600/15 active:scale-[0.98]"
        >
          <Share2 size={13} />
          Compartilhar no LinkedIn
        </button>
      </div>

      <p className="text-center text-xs text-white/18">
        Cada indicação sobe você 10 posições na fila.
      </p>
    </motion.div>
  )
}

// ─── WaitlistSection ───────────────────────────────────────────────────────

function WaitlistSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const [form, setForm]     = useState<WaitlistForm>({ name: '', email: '', company: '', teamSize: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [result, setResult] = useState<WaitlistResult | null>(null)
  const [refCode, setRefCode] = useState<string>('')

  // Read ?ref= from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const r = params.get('ref')
    if (r) setRefCode(r.toUpperCase())
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.company || !form.teamSize) {
      setErrMsg('Preencha todos os campos para continuar.')
      return
    }
    setStatus('loading')
    setErrMsg('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company,
          team_size: form.teamSize,
          ref: refCode || undefined,
          source: refCode ? 'referral' : 'organic',
        }),
      })
      const json = await res.json() as {
        error?: string
        success?: boolean
        already_registered?: boolean
        data?: WaitlistResult
      }

      if (!res.ok) {
        // If already registered, show their referral card anyway
        if (json.already_registered && json.data) {
          setResult(json.data)
          setStatus('success')
          return
        }
        setStatus('error')
        setErrMsg(json.error ?? 'Erro ao cadastrar.')
        return
      }

      if (json.data) setResult(json.data)
      setStatus('success')
    } catch {
      setStatus('error')
      setErrMsg('Erro de conexão. Tente novamente.')
    }
  }

  return (
    <Section id="waitlist" className="bg-gradient-to-b from-[#04040a] via-[#060410] to-[#04040a] border-t border-white/[0.035]">
      <div ref={ref} className="max-w-xl mx-auto">

        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/6 px-4 py-1.5"
          >
            <motion.div className="h-1.5 w-1.5 rounded-full bg-violet-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span className="text-xs font-medium text-violet-300">Acesso antecipado</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.08 }}
            className="text-4xl md:text-5xl font-bold text-white"
          >
            Garanta seu acesso
            <br />
            <span style={{ background: 'linear-gradient(135deg, #a855f7, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ao NEXUS.
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.18 }}
            className="mt-4 text-white/38 max-w-sm mx-auto"
          >
            O beta será liberado para um grupo limitado de empresas. Não fique de fora.
          </motion.p>
        </div>

        {/* Scarcity */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.28 }}
          className="mb-7 flex items-center justify-center gap-5 text-xs text-white/35"
        >
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span>Vagas restantes: <span className="text-amber-400 font-semibold">23</span></span>
          </div>
          <div className="h-3 w-px bg-white/8" />
          <div className="flex items-center gap-1.5">
            <motion.div className="h-1.5 w-1.5 rounded-full bg-emerald-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span>Na lista: <span className="text-emerald-400 font-semibold">127</span> empresas</span>
          </div>
          {refCode && (
            <>
              <div className="h-3 w-px bg-white/8" />
              <div className="flex items-center gap-1.5">
                <Gift size={10} className="text-violet-400" />
                <span className="text-violet-400">Indicado por alguém da lista</span>
              </div>
            </>
          )}
        </motion.div>

        {/* Form / Success card */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="relative rounded-2xl border border-white/6 bg-white/[0.022] backdrop-blur-sm overflow-hidden"
        >
          <div className="pointer-events-none absolute top-0 right-0 h-40 w-40 rounded-full bg-violet-600/7 blur-3xl" />

          <AnimatePresence mode="wait">
            {status === 'success' && result ? (
              <ReferralSuccess key="success" result={result} />
            ) : (
              <motion.form key="form" onSubmit={handleSubmit} className="p-8 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-white/35 mb-1.5 uppercase tracking-wider">Seu nome</label>
                    <input
                      type="text" placeholder="João Silva" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl border border-white/6 bg-white/[0.025] px-4 py-3 text-sm text-white placeholder-white/20 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/22 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/35 mb-1.5 uppercase tracking-wider">E-mail</label>
                    <input
                      type="email" placeholder="joao@empresa.com" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl border border-white/6 bg-white/[0.025] px-4 py-3 text-sm text-white placeholder-white/20 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/22 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-white/35 mb-1.5 uppercase tracking-wider">Empresa</label>
                  <input
                    type="text" placeholder="Minha Empresa LTDA" value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    className="w-full rounded-xl border border-white/6 bg-white/[0.025] px-4 py-3 text-sm text-white placeholder-white/20 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/22 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-white/35 mb-2 uppercase tracking-wider">Tamanho da equipe</label>
                  <div className="flex gap-2 flex-wrap">
                    {TEAM_SIZES.map(size => (
                      <button
                        key={size} type="button"
                        onClick={() => setForm(f => ({ ...f, teamSize: size }))}
                        className={`rounded-xl border px-4 py-2 text-xs font-medium transition-all duration-150 ${
                          form.teamSize === size
                            ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                            : 'border-white/6 bg-white/[0.025] text-white/38 hover:border-white/15 hover:text-white/60'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {errMsg && <p className="text-xs text-red-400/85">{errMsg}</p>}

                <button
                  type="submit" disabled={status === 'loading'}
                  className="mt-1 w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 py-4 text-sm font-semibold text-white shadow-lg shadow-violet-900/35 hover:shadow-violet-700/45 hover:from-violet-500 hover:to-violet-400 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {status === 'loading'
                    ? <><Loader2 size={15} className="animate-spin" />Garantindo acesso...</>
                    : <>Garantir acesso antecipado <ArrowRight size={15} /></>
                  }
                </button>

                <p className="text-center text-xs text-white/20">
                  Sem spam. Sem cartão de crédito. Você será o primeiro a saber.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </Section>
  )
}

// ─── FOOTER ────────────────────────────────────────────────────────────────

function FooterSection() {
  const links: [string, string][] = [
    ['#', 'Privacidade'],
    ['#', 'Termos'],
    ['/login', 'Login'],
    ['mailto:contato@nexusaas.com.br', 'Contato'],
  ]

  return (
    <footer className="border-t border-white/[0.035] bg-[#04040a] px-6 py-12 md:px-12">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-violet-500 to-cyan-400" />
          <span className="text-base font-bold text-white/75 tracking-tight">NEXUS</span>
          <span className="text-xs text-white/18 ml-1">Sistema Operacional IA</span>
        </div>

        <div className="flex items-center gap-7 text-sm text-white/26">
          {links.map(([href, label]) =>
            href.startsWith('/') || href.startsWith('mailto') ? (
              <Link key={label} href={href} className="hover:text-white/52 transition-colors">{label}</Link>
            ) : (
              <a key={label} href={href} className="hover:text-white/52 transition-colors">{label}</a>
            )
          )}
        </div>

        <p className="text-xs text-white/16">© 2025 NEXUS. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}

// ─── PAGE ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#04040a]" style={{ scrollBehavior: 'smooth' }}>
      <HeroSection />
      <ProblemSection />
      <NewEraSection />
      <DemoSection />
      <BenefitsSection />
      <SocialProofSection />
      <WaitlistSection />
      <FooterSection />
    </main>
  )
}
