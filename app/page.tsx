'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ArrowRight, X,
  BarChart3, Zap, Shield, Target, ChevronRight, Eye, DollarSign, Activity,
  Loader2, Users, MessageSquare, FileText, Layers, Brain, Check,
  Bell, Bot, Rocket, RefreshCw, Star, GitBranch, ArrowUpRight, Sparkles,
} from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'

// ─── Login Modal ───────────────────────────────────────────────────────────

function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const router = useRouter()

  async function handleLogin() {
    if (!email || !password) { setError('Preencha e-mail e senha.'); return }
    setLoading(true); setError(null)
    const supabase = getSupabaseClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setLoading(false); setError('E-mail ou senha inválidos.'); return }
    router.push('/dashboard')
  }

  function onKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter') handleLogin() }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl"
        >
          <div className="pointer-events-none absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
          <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
          <div className="mb-6">
            <span className="text-lg font-semibold tracking-tight text-white"><span className="text-violet-400">N</span>EXUS</span>
            <h2 className="mt-4 text-xl font-semibold text-white">Você está entrando no seu sistema de crescimento</h2>
            <p className="mt-1 text-sm text-zinc-400">A IA já está pronta para analisar seus dados</p>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown}
                placeholder="voce@empresa.com" autoFocus
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKeyDown}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40" />
            </div>
            {error && (
              <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
            )}
            <button onClick={handleLogin} disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-medium text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Entrando…</> : <>Entrar <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
          <p className="mt-5 text-center text-xs text-zinc-500">
            Não tem conta?{' '}
            <Link href="/start" className="text-violet-400 hover:underline" onClick={onClose}>Criar conta gratuita</Link>
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Growth Map Visual ─────────────────────────────────────────────────────

function GrowthMapVisual() {
  const nodes = [
    { id: 'leads',     x: 12,  y: 18,  label: 'Leads',          color: '#7c3aed', pulse: true },
    { id: 'qualify',   x: 38,  y: 10,  label: 'Qualificação IA', color: '#6d28d9', pulse: false },
    { id: 'close',     x: 65,  y: 18,  label: 'Fechamento',      color: '#5b21b6', pulse: false },
    { id: 'clients',   x: 12,  y: 52,  label: 'Clientes',        color: '#0d9488', pulse: false },
    { id: 'retention', x: 38,  y: 45,  label: 'Retenção IA',     color: '#0f766e', pulse: true },
    { id: 'revenue',   x: 65,  y: 52,  label: 'Receita',         color: '#10b981', pulse: false },
    { id: 'inactive',  x: 12,  y: 78,  label: 'Inativos',        color: '#d97706', pulse: false },
    { id: 'reactivate',x: 38,  y: 72,  label: 'Reativação IA',   color: '#b45309', pulse: true },
    { id: 'growth',    x: 82,  y: 35,  label: 'Crescimento',     color: '#7c3aed', pulse: true },
  ]

  const edges = [
    { from: 'leads',    to: 'qualify'    },
    { from: 'qualify',  to: 'close'      },
    { from: 'close',    to: 'growth'     },
    { from: 'clients',  to: 'retention'  },
    { from: 'retention',to: 'revenue'    },
    { from: 'revenue',  to: 'growth'     },
    { from: 'inactive', to: 'reactivate' },
    { from: 'reactivate',to: 'revenue'  },
    { from: 'qualify',  to: 'retention'  },
  ]

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

  return (
    <div className="relative w-full max-w-lg select-none">
      <div className="pointer-events-none absolute -inset-8 rounded-3xl bg-violet-600/8 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/95 shadow-2xl backdrop-blur-sm" style={{ aspectRatio: '4/3' }}>
        <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white"><span className="text-violet-400">N</span>EXUS</span>
            <span className="rounded-md bg-violet-600/20 px-2 py-0.5 text-[10px] font-medium text-violet-400">Growth Map</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[10px] text-zinc-500">IA ativa</span>
          </div>
        </div>

        {/* Graph canvas */}
        <div className="relative" style={{ height: 'calc(100% - 45px)' }}>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 90" preserveAspectRatio="none">
            {edges.map((e, i) => {
              const from = nodeMap[e.from]; const to = nodeMap[e.to]
              if (!from || !to) return null
              return (
                <motion.line key={i}
                  x1={from.x + 6} y1={from.y + 3} x2={to.x + 6} y2={to.y + 3}
                  stroke="rgba(124,58,237,0.25)" strokeWidth="0.5"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: i * 0.08 + 0.4, duration: 0.6 }}
                />
              )
            })}
          </svg>

          {nodes.map((node, i) => (
            <motion.div key={node.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 + 0.2, type: 'spring', stiffness: 300, damping: 20 }}
              className="absolute"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <div className="relative flex flex-col items-center gap-0.5">
                <div className="relative flex h-7 w-7 items-center justify-center rounded-full border shadow-lg"
                  style={{ borderColor: `${node.color}50`, backgroundColor: `${node.color}20` }}>
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: node.color }} />
                  {node.pulse && (
                    <div className="absolute inset-0 animate-ping rounded-full opacity-30"
                      style={{ backgroundColor: node.color }} />
                  )}
                </div>
                <span className="whitespace-nowrap rounded bg-zinc-900/90 px-1 py-0.5 text-[8px] font-medium text-zinc-400">
                  {node.label}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Floating AI insight */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.5 }}
            className="absolute bottom-3 left-3 right-3 rounded-xl border border-violet-800/40 bg-violet-950/60 p-2.5"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-violet-600/30">
                <Bot className="h-3 w-3 text-violet-400" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-violet-300">IA executou ação</p>
                <p className="text-[9px] leading-relaxed text-zinc-400">
                  12 clientes inativos reativados — <span className="font-medium text-white">+R$ 8.400</span> recuperados
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10 }} animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.8, duration: 0.4 }}
        className="absolute -right-4 top-16 hidden rounded-xl border border-emerald-900/50 bg-zinc-950 px-3 py-2 shadow-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-xs font-semibold text-emerald-300">+23% faturamento</p>
            <p className="text-[10px] text-zinc-500">últimos 30 dias</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -20, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 2.1, duration: 0.4 }}
        className="absolute -left-4 bottom-20 hidden rounded-xl border border-violet-900/50 bg-zinc-950 px-3 py-2 shadow-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <div>
            <p className="text-xs font-semibold text-violet-300">Estratégia gerada</p>
            <p className="text-[10px] text-zinc-500">4 ações identificadas</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Animated counter ──────────────────────────────────────────────────────

function Counter({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useState(() => {
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
  })

  return <span ref={ref}>{prefix}{value}{suffix}</span>
}

// ─── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-sm font-medium uppercase tracking-widest text-violet-400">{children}</p>
  )
}

// ─── Features data ─────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Brain,        title: 'Decisões com IA',           desc: 'A IA analisa seus dados em tempo real, recomenda ações e você aprova. Inteligência aplicada ao seu negócio.' },
  { icon: Rocket,       title: 'Execução automática',        desc: 'Ações executadas sem intervenção manual. A IA age enquanto você foca no que realmente importa.' },
  { icon: MessageSquare,title: 'Mensagens personalizadas',   desc: 'WhatsApp e e-mails gerados e disparados pela IA com base no comportamento de cada cliente.' },
  { icon: Eye,          title: 'Análise de dados total',     desc: 'Conecte planilhas, CRM, ERP ou qualquer fonte. A IA transforma caos em clareza em segundos.' },
  { icon: FileText,     title: 'Histórico de ações',         desc: 'Log completo e auditável de tudo que a IA executou — rastreabilidade total do crescimento.' },
  { icon: Layers,       title: 'Templates por setor',        desc: 'Estratégias pré-configuradas por indústria. Ative um template e comece a crescer imediatamente.' },
]

const USE_CASES = [
  {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    title: 'Clientes inadimplentes',
    desc: 'A IA identifica quem te deve, qual é o momento certo de cobrar e automatiza toda a régua de cobrança — sem constrangimento, sem esforço.',
    result: '+R$ 47k recuperados em média por empresa',
  },
  {
    icon: BarChart3,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    title: 'Faturamento estagnado',
    desc: 'A IA mapeia o gargalo que está travando seu crescimento — seja no processo de vendas, precificação ou mix de produtos — e cria o plano de ação.',
    result: '3.2x mais oportunidades identificadas',
  },
  {
    icon: Users,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Reativar clientes inativos',
    desc: 'A IA segmenta clientes que pararam de comprar, entende o motivo e dispara uma sequência personalizada de reativação que funciona.',
    result: '68% de taxa de reativação média',
  },
  {
    icon: Target,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: 'Campanhas que convertem',
    desc: 'Nada de campanhas genéricas. A IA cria estratégias baseadas nos seus dados reais — timing certo, público certo, mensagem certa.',
    result: '4.1x mais conversão vs campanha manual',
  },
]

const PRICING = [
  {
    name: 'Diagnóstico',
    price: 'Grátis',
    desc: 'Comece agora e veja onde está perdendo dinheiro',
    cta: 'Começar grátis',
    ctaHref: '/start',
    highlight: false,
    features: [
      'Diagnóstico financeiro completo',
      '1 projeto ativo',
      'Growth Map (visualização)',
      'Alertas básicos de IA',
      'Assistente financeiro limitado',
    ],
  },
  {
    name: 'Pro',
    price: 'R$ 197',
    period: '/mês',
    desc: 'Para quem quer crescer com IA trabalhando 24h',
    cta: 'Assinar Pro',
    ctaHref: '/start?plan=pro',
    highlight: true,
    badge: 'Mais popular',
    features: [
      'Projetos ilimitados',
      'Automações de cobrança e reativação',
      'Assistente IA sem limites',
      'Growth Map completo',
      'Mensagens WhatsApp + e-mail',
      'Relatórios executivos semanais',
      'Integrações com Google Sheets e CRM',
    ],
  },
  {
    name: 'Scale',
    price: 'R$ 497',
    period: '/mês',
    desc: 'Para empresas que precisam de escala real',
    cta: 'Falar com time',
    ctaHref: '/start?plan=scale',
    highlight: false,
    features: [
      'Tudo do Pro',
      'Multi-empresa (até 5)',
      'Acesso a API',
      'Onboarding personalizado',
      'Suporte dedicado',
      'Relatórios customizados',
      'SLA garantido',
    ],
  },
]

// ─── Landing page ──────────────────────────────────────────────────────────

export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">

      {/* ── Background ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-64 -top-64 h-[600px] w-[600px] rounded-full bg-violet-700/10 blur-[120px]" />
        <div className="absolute -right-32 top-1/4 h-[500px] w-[500px] rounded-full bg-blue-700/6 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[600px] rounded-full bg-violet-900/5 blur-[80px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }} />
      </div>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
          className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 shadow-[0_0_16px_rgba(124,58,237,0.5)]">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight"><span className="text-violet-400">N</span>EXUS</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
          <a href="#casos" className="transition hover:text-white">Casos de uso</a>
          <a href="#recursos" className="transition hover:text-white">Recursos</a>
          <a href="#precos" className="transition hover:text-white">Preços</a>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-3">
          <button onClick={() => setLoginOpen(true)}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white">
            Entrar
          </button>
          <Link href="/start"
            className="hidden rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(124,58,237,0.3)] transition hover:bg-violet-500 sm:block">
            Começar grátis
          </Link>
        </motion.div>
      </nav>

      {/* ── SECTION 1: HERO ────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-16 px-6 pb-24 pt-14 md:flex-row md:items-center md:px-12 md:pt-20 lg:gap-16">
        {/* Left */}
        <div className="flex flex-1 flex-col items-start">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 flex items-center gap-2 rounded-full border border-violet-800/50 bg-violet-950/40 px-4 py-1.5 backdrop-blur-sm">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            <span className="text-xs font-medium text-violet-300">Seu COO de IA já está online</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            NEXUS —{' '}
            <span className="relative inline-block">
              <span className="relative z-10" style={{ background: 'linear-gradient(135deg, #c4b5fd 0%, #7c3aed 60%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Seu COO de IA
              </span>
              <span className="pointer-events-none absolute -inset-1 rounded-lg bg-violet-600/10 blur-md" />
            </span>{' '}
            para crescer automaticamente
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45 }}
            className="mb-10 max-w-xl text-lg leading-relaxed text-zinc-400">
            A IA analisa seus dados, cria estratégias, executa ações e aumenta seu faturamento —
            sem você precisar fazer nada.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.55 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link href="/start"
              className="group relative flex items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-violet-600 px-7 py-4 text-base font-semibold text-white shadow-[0_0_32px_rgba(124,58,237,0.35)] transition-all hover:bg-violet-500 hover:shadow-[0_0_48px_rgba(124,58,237,0.5)] active:scale-[0.98]">
              <span className="relative z-10">Começar grátis agora</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>
            <button onClick={() => setLoginOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white">
              Já tenho conta <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.75 }}
            className="mt-10 flex flex-wrap items-center gap-5 text-sm text-zinc-500">
            {[
              { icon: Shield,       text: 'Sem cartão de crédito' },
              { icon: Zap,          text: 'Estratégia em 2 minutos' },
              { icon: CheckCircle,  text: 'Cancele quando quiser' },
            ].map((item) => (
              <span key={item.text} className="flex items-center gap-1.5">
                <item.icon className="h-3.5 w-3.5 text-violet-500" />
                {item.text}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right — Growth Map */}
        <motion.div initial={{ opacity: 0, x: 32, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="flex w-full flex-1 justify-center lg:justify-end">
          <GrowthMapVisual />
        </motion.div>
      </section>

      {/* ── Ticker ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 border-y border-zinc-800/60 bg-zinc-950/80 py-3.5 backdrop-blur-sm">
        <div className="flex overflow-hidden">
          <motion.div animate={{ x: ['0%', '-50%'] }} transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
            className="flex shrink-0 gap-12 pr-12">
            {[...Array(2)].flatMap(() => [
              'Agência Digital', 'SaaS B2B', 'Consultoria', 'E-commerce', 'Varejo', 'Tech Startup', 'Indústria', 'Serviços', 'Infoprodutos', 'Clínicas',
            ]).map((name, i) => (
              <span key={i} className="whitespace-nowrap text-sm font-medium text-zinc-700">{name}</span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── SECTION 2: HOW IT WORKS ────────────────────────────────────── */}
      <section id="como-funciona" className="relative z-10 mx-auto max-w-5xl px-6 py-24 md:px-12">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="mb-16 text-center">
          <SectionLabel>Como funciona</SectionLabel>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Do zero à primeira estratégia em 4 passos</h2>
          <p className="mx-auto mt-4 max-w-lg text-zinc-400">A IA trabalha por você — você só aprova os resultados.</p>
        </motion.div>

        <div className="relative">
          <div className="absolute left-[27px] top-10 hidden h-[calc(100%-80px)] w-px bg-gradient-to-b from-violet-600/50 via-violet-600/20 to-transparent md:block" />
          <div className="flex flex-col gap-8">
            {[
              { step: '01', icon: GitBranch, title: 'Conecta seus dados', desc: 'Integre Google Sheets, CRM, planilhas ou qualquer fonte de dados. Leva menos de 2 minutos e não precisa de técnico.', tag: 'Sem código' },
              { step: '02', icon: Brain,     title: 'IA identifica oportunidades', desc: 'A IA analisa padrões, benchmarks do seu setor e comportamento dos seus clientes. Ela sabe onde está o dinheiro escondido.', tag: 'IA proprietária' },
              { step: '03', icon: Target,    title: 'Cria sua estratégia', desc: 'Um mapa de crescimento personalizado com ações priorizadas por impacto financeiro. Nada genérico — é sobre o seu negócio.', tag: 'Personalizado' },
              { step: '04', icon: Rocket,    title: 'Executa e monitora', desc: 'Automações ativas, alertas em tempo real e relatórios de resultado. A IA trabalha enquanto você fecha outros negócios.', tag: 'Automático' },
            ].map((item, i) => (
              <motion.div key={item.step} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }} className="flex gap-6">
                <div className="flex shrink-0 flex-col items-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-violet-700/50 bg-violet-950/60 text-sm font-bold text-violet-400 shadow-[0_0_20px_rgba(124,58,237,0.2)]">
                    {item.step}
                  </div>
                </div>
                <div className="pb-4 pt-2">
                  <div className="mb-1 flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <span className="rounded-md bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">{item.tag}</span>
                  </div>
                  <p className="text-zinc-400">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: PRODUCT DEMO ────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-12">
        <div className="overflow-hidden rounded-3xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/80 via-zinc-950 to-violet-950/20 p-8 md:p-14">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />

          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="mb-10 text-center">
            <SectionLabel>Produto</SectionLabel>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Você não cria campanhas…
              <br />
              <span style={{ background: 'linear-gradient(135deg, #c4b5fd 0%, #7c3aed 60%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                você cria sistemas de crescimento
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              O Growth Map é o cérebro do NEXUS — um mapa visual que mostra cada etapa do seu
              crescimento, quais ações a IA está executando e qual o impacto em tempo real.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: Eye,          title: 'Visibilidade 360°',        desc: 'Veja todo o ciclo de vida do cliente — desde o lead até a recompra.' },
              { icon: RefreshCw,    title: 'Automações em loop',        desc: 'Cada ação gera dados que melhoram a próxima execução da IA.' },
              { icon: ArrowUpRight, title: 'Crescimento mensurável',    desc: 'Cada nó do mapa tem um número. Sem achismo, só resultado real.' },
            ].map((item, i) => (
              <motion.div key={item.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800">
                  <item.icon className="h-4 w-4 text-violet-400" />
                </div>
                <h4 className="mb-1.5 font-semibold text-white">{item.title}</h4>
                <p className="text-sm leading-relaxed text-zinc-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: USE CASES ───────────────────────────────────────── */}
      <section id="casos" className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-12">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="mb-16 text-center">
          <SectionLabel>Casos de uso</SectionLabel>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">A IA que resolve os problemas reais do seu negócio</h2>
          <p className="mx-auto mt-4 max-w-lg text-zinc-400">Não é chatbot. Não é dashboard. É um sistema que age.</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {USE_CASES.map((uc, i) => (
            <motion.div key={uc.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-zinc-700">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-600/0 blur-2xl transition-all duration-500 group-hover:bg-violet-600/5" />
              <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${uc.bg} ${uc.color}`}>
                <uc.icon className="h-3 w-3" />
                {uc.title}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-zinc-400">{uc.desc}</p>
              <div className="flex items-center gap-2 rounded-xl bg-zinc-800/60 px-3 py-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="text-xs font-medium text-zinc-300">{uc.result}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── SECTION 5: FEATURES ────────────────────────────────────────── */}
      <section id="recursos" className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-12">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="mb-16 text-center">
          <SectionLabel>Recursos</SectionLabel>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Tudo que um COO faria — só que automático</h2>
          <p className="mx-auto mt-4 max-w-lg text-zinc-400">
            Grandes empresas pagam R$ 30k/mês por um COO. Agora você tem o mesmo trabalho por uma fração do preço.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feat, i) => (
            <motion.div key={feat.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-violet-800/60 hover:bg-zinc-900">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-600/0 blur-xl transition-all duration-500 group-hover:bg-violet-600/10" />
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 transition-colors group-hover:border-violet-700/50 group-hover:bg-violet-950/60">
                <feat.icon className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="mb-2 font-semibold text-white">{feat.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── SECTION 6: RESULTS ─────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-24 md:px-12">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="mb-16 text-center">
          <SectionLabel>Resultados</SectionLabel>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Números reais de quem usa o NEXUS</h2>
          <p className="mx-auto mt-4 max-w-lg text-zinc-400">Médias calculadas nos primeiros 90 dias de uso.</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[
            { value: 47, prefix: 'R$ ', suffix: 'k', label: 'Receita recuperada', sub: 'média de inadimplência resolvida', color: 'text-emerald-400' },
            { value: 3.2, prefix: '', suffix: 'x', label: 'Reativação de clientes', sub: 'vs abordagem manual', color: 'text-violet-400' },
            { value: 23, prefix: '', suffix: '%', label: 'Redução de custos', sub: 'detectado pela IA', color: 'text-blue-400' },
            { value: 2, prefix: '', suffix: ' min', label: 'Para 1ª estratégia', sub: 'do zero ao plano de ação', color: 'text-amber-400' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
              <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-violet-600/5 blur-xl" />
              <p className={`mb-2 text-4xl font-extrabold tracking-tight ${stat.color}`}>
                {stat.prefix}{stat.value}{stat.suffix}
              </p>
              <p className="mb-1 text-sm font-semibold text-white">{stat.label}</p>
              <p className="text-xs text-zinc-500">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Testimonial strip */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { name: 'Rafael M.', role: 'E-commerce', text: 'Recuperei R$ 28k em 3 semanas. A IA identificou clientes que eu nem sabia que estavam inadimplentes.' },
            { name: 'Ana C.',    role: 'Agência Digital', text: 'O Growth Map me mostrou o gargalo exato que estava travando meu crescimento. Dobrei a receita em 60 dias.' },
            { name: 'Lucas T.', role: 'SaaS B2B', text: 'Automatizei toda a régua de cobrança. Hoje o churn caiu 40% sem eu precisar fazer nada manualmente.' },
          ].map((t, i) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-zinc-300">&ldquo;{t.text}&rdquo;</p>
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-zinc-500">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── SECTION 7: PRICING ─────────────────────────────────────────── */}
      <section id="precos" className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-12">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="mb-16 text-center">
          <SectionLabel>Preços</SectionLabel>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Simples. Sem surpresas.</h2>
          <p className="mx-auto mt-4 max-w-lg text-zinc-400">Comece grátis. Escale quando sentir o resultado.</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PRICING.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative overflow-hidden rounded-2xl border p-7 ${
                plan.highlight
                  ? 'border-violet-600/60 bg-gradient-to-b from-violet-950/60 to-zinc-950 shadow-[0_0_40px_rgba(124,58,237,0.15)]'
                  : 'border-zinc-800 bg-zinc-900/50'
              }`}>
              {plan.highlight && (
                <>
                  <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
                  <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />
                </>
              )}
              {plan.badge && (
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-violet-600/20 px-3 py-1 text-xs font-medium text-violet-400 ring-1 ring-violet-500/30">
                  <Sparkles className="h-3 w-3" />
                  {plan.badge}
                </div>
              )}
              <h3 className="mb-1 text-lg font-bold text-white">{plan.name}</h3>
              <p className="mb-4 text-sm text-zinc-500">{plan.desc}</p>
              <div className="mb-6 flex items-end gap-1">
                <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-zinc-100'}`}>{plan.price}</span>
                {plan.period && <span className="mb-1 text-sm text-zinc-500">{plan.period}</span>}
              </div>
              <ul className="mb-7 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.ctaHref}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98] ${
                  plan.highlight
                    ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:bg-violet-500'
                    : 'border border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800'
                }`}>
                {plan.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 md:px-12">
        <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
          className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-violet-800/30 bg-gradient-to-br from-violet-950/60 via-zinc-950 to-zinc-950 px-8 py-16 text-center shadow-2xl">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="pointer-events-none absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

          <motion.div initial={{ scale: 0.8, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }} className="relative mb-6 inline-flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 shadow-[0_0_40px_rgba(124,58,237,0.5)]">
              <Rocket className="h-8 w-8 text-white" />
            </div>
          </motion.div>

          <h2 className="relative mb-4 text-3xl font-extrabold text-white sm:text-4xl">
            Comece agora e gere sua{' '}
            <span style={{ background: 'linear-gradient(135deg, #c4b5fd 0%, #7c3aed 60%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              primeira estratégia
            </span>
            {' '}em 2 minutos
          </h2>
          <p className="relative mx-auto mb-10 max-w-md text-zinc-400">
            Bem-vindo ao NEXUS. Vamos gerar sua primeira estratégia em segundos — e mostrar exatamente onde seu negócio pode crescer.
          </p>

          <Link href="/start"
            className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(124,58,237,0.4)] transition-all hover:bg-violet-500 hover:shadow-[0_0_56px_rgba(124,58,237,0.55)] active:scale-[0.98]">
            <span className="relative z-10">Gerar minha primeira estratégia</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Link>

          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-zinc-600" />Grátis para começar</span>
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-zinc-600" />Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-zinc-600" />Resultado imediato</span>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-800/60 px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-zinc-600 sm:flex-row">
          <span className="font-semibold text-zinc-500"><span className="text-violet-500">N</span>EXUS</span>
          <span>© {new Date().getFullYear()} NEXUS — COO de IA para negócios</span>
          <div className="flex gap-6">
            <a href="#" className="transition hover:text-zinc-400">Privacidade</a>
            <a href="#" className="transition hover:text-zinc-400">Termos</a>
            <button onClick={() => setLoginOpen(true)} className="transition hover:text-zinc-400">Login</button>
          </div>
        </div>
      </footer>

      {/* ── Login modal ─────────────────────────────────────────────────── */}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  )
}
