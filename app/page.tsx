'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  X,
  BarChart3,
  Zap,
  Shield,
  Target,
  ChevronRight,
  Eye,
  DollarSign,
  Activity,
} from 'lucide-react'

// ─── Login Modal ───────────────────────────────────────────────

function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl"
        >
          {/* Glow */}
          <div className="pointer-events-none absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-6">
            <span className="text-lg font-semibold tracking-tight text-white">
              <span className="text-violet-400">N</span>EXUS
            </span>
            <h2 className="mt-4 text-xl font-semibold text-white">Entrar na sua conta</h2>
            <p className="mt-1 text-sm text-zinc-400">Continue de onde parou</p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
            <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-medium text-white transition hover:bg-violet-500 active:scale-[0.98]">
              Entrar
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-5 text-center text-xs text-zinc-500">
            Não tem conta?{' '}
            <Link href="/start" className="text-violet-400 hover:underline" onClick={onClose}>
              Criar diagnóstico gratuito
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Animated counter ─────────────────────────────────────────

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 1600
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(ease * to))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, to])

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  )
}

// ─── Dashboard mockup ─────────────────────────────────────────

function DashboardMockup() {
  const bars = [42, 68, 55, 82, 71, 94, 87, 103, 91, 118, 108, 132]

  return (
    <div className="relative w-full max-w-lg select-none">
      {/* Outer glow */}
      <div className="pointer-events-none absolute -inset-8 rounded-3xl bg-violet-600/8 blur-3xl" />
      <div className="pointer-events-none absolute -inset-4 rounded-2xl bg-violet-600/5 blur-xl" />

      {/* Main card */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/90 shadow-2xl backdrop-blur-sm">
        {/* Top bar glow */}
        <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              <span className="text-violet-400">N</span>EXUS
            </span>
            <span className="rounded-md bg-violet-600/20 px-2 py-0.5 text-xs font-medium text-violet-400">
              Painel IA
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
            <span className="text-xs text-zinc-500">Monitorando</span>
          </div>
        </div>

        <div className="p-5">
          {/* KPI row */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              { label: 'Faturamento', value: 'R$ 127k', change: '+18%', up: true, icon: TrendingUp },
              { label: 'Lucro Líquido', value: 'R$ 23k', change: '+7%', up: true, icon: DollarSign },
              { label: 'Alertas', value: '3', change: '2 críticos', up: false, icon: AlertTriangle },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{kpi.label}</span>
                  <kpi.icon
                    className={`h-3 w-3 ${kpi.up ? 'text-emerald-500' : 'text-amber-500'}`}
                  />
                </div>
                <p className="text-base font-bold text-white">{kpi.value}</p>
                <span
                  className={`text-xs font-medium ${kpi.up ? 'text-emerald-400' : 'text-amber-400'}`}
                >
                  {kpi.change}
                </span>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-400">Receita — últimos 12 meses</p>
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                +32% vs ano anterior
              </span>
            </div>
            <div className="flex h-20 items-end gap-1">
              {bars.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${(h / 132) * 100}%` }}
                  transition={{ delay: i * 0.05 + 0.3, duration: 0.5, ease: 'easeOut' }}
                  className={`flex-1 rounded-sm ${
                    i === bars.length - 1
                      ? 'bg-violet-500 shadow-[0_0_8px_#7c3aed60]'
                      : i >= bars.length - 3
                      ? 'bg-violet-600/70'
                      : 'bg-zinc-700/80'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* AI insight card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="rounded-xl border border-violet-800/40 bg-violet-950/30 p-3.5"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-600/20">
                <Zap className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-violet-300">IA detectou oportunidade</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                  Seu custo com fornecedores está 23% acima do benchmark do setor. Renegociar pode liberar{' '}
                  <span className="font-medium text-white">R$ 4.800/mês</span>.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating alert badge */}
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.6, duration: 0.4, ease: 'easeOut' }}
        className="absolute -right-4 top-20 hidden rounded-xl border border-red-900/50 bg-zinc-950 px-3 py-2 shadow-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-400" />
          <div>
            <p className="text-xs font-semibold text-red-300">Lucro caiu 18%</p>
            <p className="text-xs text-zinc-500">últimos 7 dias</p>
          </div>
        </div>
      </motion.div>

      {/* Floating success badge */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.9, duration: 0.4, ease: 'easeOut' }}
        className="absolute -left-4 bottom-16 hidden rounded-xl border border-emerald-900/50 bg-zinc-950 px-3 py-2 shadow-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-xs font-semibold text-emerald-300">Diagnóstico pronto</p>
            <p className="text-xs text-zinc-500">3 ações identificadas</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Features section ─────────────────────────────────────────

const FEATURES = [
  {
    icon: Eye,
    title: 'Visibilidade Total',
    desc: 'Veja em tempo real onde seu dinheiro entra, sai e o que está sendo desperdiçado.',
  },
  {
    icon: Zap,
    title: 'IA Proativa',
    desc: 'O NEXUS detecta anomalias e oportunidades antes que se tornem problemas críticos.',
  },
  {
    icon: Target,
    title: 'Ações Concretas',
    desc: 'Não apenas análise — recomendações específicas com impacto financeiro estimado.',
  },
  {
    icon: Shield,
    title: 'Alertas Antecipados',
    desc: 'Receba avisos quando seu lucro cair, despesa subir ou fluxo de caixa apertar.',
  },
  {
    icon: Activity,
    title: 'Benchmarking do Setor',
    desc: 'Compare suas métricas com negócios similares e saiba onde você está perdendo.',
  },
  {
    icon: BarChart3,
    title: 'Relatório Executivo',
    desc: 'Dashboard limpo e direto — sem ruído, só o que importa para tomar decisões.',
  },
]

// ─── Social proof ticker ───────────────────────────────────────

const COMPANIES = [
  'Loja Online', 'Agência Digital', 'SaaS B2B', 'Consultoria',
  'Varejo', 'Tech Startup', 'E-commerce', 'Indústria',
]

// ─── Main page ────────────────────────────────────────────────

export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false)
  const featuresRef = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-80px' })

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">
      {/* ── Background decorations ──────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Top-left violet orb */}
        <div className="absolute -left-64 -top-64 h-[600px] w-[600px] rounded-full bg-violet-700/10 blur-[120px]" />
        {/* Right side blue orb */}
        <div className="absolute -right-32 top-1/4 h-[500px] w-[500px] rounded-full bg-blue-700/8 blur-[100px]" />
        {/* Center subtle glow */}
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-900/5 blur-[80px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 shadow-[0_0_16px_rgba(124,58,237,0.5)]">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-violet-400">N</span>EXUS
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="hidden items-center gap-8 text-sm text-zinc-400 md:flex"
        >
          <a href="#recursos" className="transition hover:text-white">Recursos</a>
          <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
          <a href="#prova" className="transition hover:text-white">Resultados</a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={() => setLoginOpen(true)}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Já tenho conta
          </button>
          <Link
            href="/start"
            className="hidden rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(124,58,237,0.3)] transition hover:bg-violet-500 hover:shadow-[0_0_24px_rgba(124,58,237,0.4)] sm:block"
          >
            Começar grátis
          </Link>
        </motion.div>
      </nav>

      {/* ── Hero section ────────────────────────────────────── */}
      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-20 px-6 pb-24 pt-16 md:flex-row md:items-center md:px-12 md:pt-20 lg:gap-16">
        {/* Left content */}
        <div className="flex flex-1 flex-col items-start">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 flex items-center gap-2 rounded-full border border-violet-800/50 bg-violet-950/40 px-4 py-1.5 backdrop-blur-sm"
          >
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            <span className="text-xs font-medium text-violet-300">
              COO de IA para empresas que querem crescer
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Seu negócio pode estar{' '}
            <span className="relative inline-block">
              <span
                className="relative z-10"
                style={{
                  background: 'linear-gradient(135deg, #c4b5fd 0%, #7c3aed 60%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                perdendo dinheiro
              </span>
              <span className="pointer-events-none absolute -inset-1 rounded-lg bg-violet-600/10 blur-md" />
            </span>{' '}
            — e você nem percebeu.
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mb-10 max-w-xl text-lg leading-relaxed text-zinc-400"
          >
            O NEXUS analisa sua empresa com IA e mostra exatamente onde aumentar seu lucro —
            com recomendações práticas, não só gráficos.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center"
          >
            <Link
              href="/start"
              className="group relative flex items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-violet-600 px-7 py-4 text-base font-semibold text-white shadow-[0_0_32px_rgba(124,58,237,0.35)] transition-all hover:bg-violet-500 hover:shadow-[0_0_48px_rgba(124,58,237,0.5)] active:scale-[0.98]"
            >
              <span className="relative z-10">Descobrir meu diagnóstico agora</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
              {/* Button shimmer */}
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>

            <button
              onClick={() => setLoginOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              Já tenho conta
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>

          {/* Trust signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.75 }}
            className="mt-10 flex flex-wrap items-center gap-5 text-sm text-zinc-500"
          >
            {[
              { icon: Shield, text: 'Sem cartão de crédito' },
              { icon: Zap, text: 'Diagnóstico em 2 minutos' },
              { icon: CheckCircle, text: 'Cancele quando quiser' },
            ].map((item) => (
              <span key={item.text} className="flex items-center gap-1.5">
                <item.icon className="h-3.5 w-3.5 text-violet-500" />
                {item.text}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right — dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, x: 32, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="flex w-full flex-1 justify-center lg:justify-end"
        >
          <DashboardMockup />
        </motion.div>
      </section>

      {/* ── Social proof ticker ─────────────────────────────── */}
      <div className="relative z-10 border-y border-zinc-800/60 bg-zinc-950/80 py-4 backdrop-blur-sm">
        <div className="flex overflow-hidden">
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 24, ease: 'linear', repeat: Infinity }}
            className="flex shrink-0 gap-12 pr-12"
          >
            {[...COMPANIES, ...COMPANIES].map((name, i) => (
              <span key={i} className="whitespace-nowrap text-sm font-medium text-zinc-600">
                {name}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Stats section ───────────────────────────────────── */}
      <section id="prova" className="relative z-10 mx-auto max-w-5xl px-6 py-24 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-violet-400">
            Os números falam
          </p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Perda invisível é o maior inimigo do crescimento
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Antes de crescer receita, você precisa parar de vazar lucro.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            {
              number: 90,
              suffix: '%',
              label: 'dos negócios têm perdas invisíveis',
              sub: 'custos ocultos, precificação errada, capital parado',
              color: 'text-violet-400',
            },
            {
              number: 2,
              suffix: ' min',
              label: 'para ter seu primeiro diagnóstico',
              sub: 'conecte seus dados e a IA cuida do resto',
              color: 'text-emerald-400',
            },
            {
              number: 23,
              suffix: '%',
              label: 'de aumento médio de lucro líquido',
              sub: 'nos primeiros 90 dias de uso',
              color: 'text-blue-400',
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-7"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-600/5 blur-2xl" />
              <p className={`mb-2 text-5xl font-extrabold tracking-tight ${stat.color}`}>
                <Counter to={stat.number} suffix={stat.suffix} />
              </p>
              <p className="mb-1 font-semibold text-white">{stat.label}</p>
              <p className="text-sm text-zinc-500">{stat.sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section id="como-funciona" className="relative z-10 mx-auto max-w-5xl px-6 py-12 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-violet-400">
            Como funciona
          </p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Do zero ao diagnóstico em 3 passos
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-[27px] top-10 hidden h-[calc(100%-80px)] w-px bg-gradient-to-b from-violet-600/40 via-violet-600/20 to-transparent md:block" />

          <div className="flex flex-col gap-8">
            {[
              {
                step: '01',
                title: 'Conte sobre seu negócio',
                desc: 'Responda 4 perguntas rápidas sobre seu setor, metas e principais desafios. Leva menos de 2 minutos.',
                tag: 'Personalizado para você',
              },
              {
                step: '02',
                title: 'A IA mapeia suas perdas',
                desc: 'O NEXUS analisa padrões do seu setor, compara com benchmarks e identifica onde você está perdendo dinheiro.',
                tag: 'IA proprietária',
              },
              {
                step: '03',
                title: 'Receba ações concretas',
                desc: 'Não só alertas — você recebe o que fazer, em que ordem, e qual o impacto financeiro estimado de cada ação.',
                tag: 'Resultados em dias, não meses',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="flex gap-6"
              >
                <div className="flex shrink-0 flex-col items-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-violet-700/50 bg-violet-950/60 text-sm font-bold text-violet-400 shadow-[0_0_20px_rgba(124,58,237,0.2)]">
                    {item.step}
                  </div>
                </div>
                <div className="pb-4 pt-2">
                  <div className="mb-1 flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <span className="rounded-md bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-zinc-400">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────── */}
      <section id="recursos" ref={featuresRef} className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={featuresInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-violet-400">
            Recursos
          </p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Tudo que um CFO faria — automatizado
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Grandes empresas pagam CFOs para isso. Agora você tem IA fazendo o mesmo trabalho.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={featuresInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-violet-800/60 hover:bg-zinc-900"
            >
              {/* Hover glow */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-600/0 blur-xl transition-all duration-500 group-hover:bg-violet-600/10" />

              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 transition-colors group-hover:border-violet-700/50 group-hover:bg-violet-950/60">
                <feat.icon className="h-4.5 w-4.5 h-5 w-5 text-violet-400" />
              </div>
              <h3 className="mb-2 font-semibold text-white">{feat.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-violet-800/30 bg-gradient-to-br from-violet-950/60 via-zinc-950 to-zinc-950 px-8 py-16 text-center shadow-2xl"
        >
          {/* Decorative orb */}
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />
          {/* Top line */}
          <div className="pointer-events-none absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="relative mb-6 inline-flex items-center justify-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 shadow-[0_0_40px_rgba(124,58,237,0.5)]">
              <Activity className="h-8 w-8 text-white" />
            </div>
          </motion.div>

          <h2 className="relative mb-4 text-3xl font-extrabold text-white sm:text-4xl">
            Você está a 2 minutos de{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #c4b5fd 0%, #7c3aed 60%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              ver onde está perdendo
            </span>
          </h2>
          <p className="relative mb-10 mx-auto max-w-md text-zinc-400">
            Mais de 90% dos negócios têm perdas que não aparecem no extrato. O diagnóstico é gratuito e leva menos de 2 minutos.
          </p>

          <Link
            href="/start"
            className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(124,58,237,0.4)] transition-all hover:bg-violet-500 hover:shadow-[0_0_56px_rgba(124,58,237,0.55)] active:scale-[0.98]"
          >
            <span className="relative z-10">Descobrir meu diagnóstico agora</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Link>

          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-zinc-600" />
              Grátis para começar
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-zinc-600" />
              Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-zinc-600" />
              Resultado imediato
            </span>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-800/60 px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-zinc-600 sm:flex-row">
          <span className="font-semibold text-zinc-500">
            <span className="text-violet-500">N</span>EXUS
          </span>
          <span>© {new Date().getFullYear()} NEXUS — Inteligência financeira com IA</span>
          <div className="flex gap-6">
            <a href="#" className="transition hover:text-zinc-400">Privacidade</a>
            <a href="#" className="transition hover:text-zinc-400">Termos</a>
            <button onClick={() => setLoginOpen(true)} className="transition hover:text-zinc-400">
              Login
            </button>
          </div>
        </div>
      </footer>

      {/* ── Login modal ─────────────────────────────────────── */}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  )
}
