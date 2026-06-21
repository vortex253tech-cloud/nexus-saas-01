'use client'

import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Zap, ArrowRight, Check,
  BarChart3, Users, MessageSquare, Bot,
  Workflow, DollarSign, Brain,
  Play, Sparkles, Globe,
} from 'lucide-react'

// ─── Ambient background ──────────────────────────────────────────────────────

function Mesh() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#0A0E16]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(3,3,5,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/50">
          <Zap className="w-4 h-4 text-white" fill="currentColor" />
        </div>
        <span className="text-[15px] font-black text-white tracking-tight">NEXUS</span>
        <span className="hidden md:block text-[9px] font-black text-violet-400/80 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5 tracking-widest">OS</span>
      </Link>

      <div className="hidden md:flex items-center gap-8">
        {['Produto', 'Planos', 'Empresas', 'API'].map(l => (
          <a key={l} href="#" className="text-[13px] text-zinc-500 hover:text-white transition-colors">{l}</a>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Link href="/login" className="hidden md:block text-[13px] text-zinc-500 hover:text-white transition-colors">
          Entrar
        </Link>
        <Link
          href="/signup"
          className="text-[13px] font-bold text-white px-5 py-2 rounded-xl transition-all duration-200 hover:scale-[1.02]"
          style={{ background: '#1E40AF' }}
        >
          Começar grátis
        </Link>
      </div>
    </motion.nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const { scrollY } = useScroll()
  const heroY       = useTransform(scrollY, [0, 500], [0, 120])
  const heroOpacity = useTransform(scrollY, [0, 380], [1, 0])

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-6 pt-16 overflow-hidden">
      <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 flex flex-col items-center gap-8 max-w-5xl w-full">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2.5 rounded-full border border-violet-500/25 bg-violet-500/6 px-5 py-2 text-[13px] text-violet-300"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          Nexus OS · Inteligência Operacional em Tempo Real
          <span className="text-violet-500">→</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.2, ease: [0.21, 0.45, 0.15, 1] }}
          className="text-[clamp(40px,8vw,88px)] font-black tracking-[-0.03em] leading-[0.9] text-white"
        >
          <span className="block">Seu COO de IA que</span>
          <span className="block mt-1 text-violet-400">
            opera sua empresa
          </span>
          <span className="block mt-1">em tempo real.</span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.38 }}
          className="max-w-2xl text-[17px] md:text-xl text-zinc-400 leading-relaxed"
        >
          Vendas, projetos, tarefas, automações e decisões executadas por uma
          inteligência operacional ativa 24 horas por dia.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.52 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2.5 text-[15px] font-black text-white px-9 py-4 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: '#1E40AF',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}
          >
            <Zap className="w-4 h-4" fill="currentColor" />
            COMEÇAR AGORA
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#demo"
            className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-zinc-300 border border-zinc-700/80 hover:border-zinc-500 px-9 py-4 rounded-2xl transition-all duration-200 hover:bg-white/4"
          >
            <Play className="w-4 h-4" />
            VER DEMONSTRAÇÃO
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-[12px] text-zinc-700"
        >
          7 dias grátis · Sem cartão de crédito · Cancele quando quiser
        </motion.p>
      </motion.div>

      {/* Dashboard mockup */}
      <motion.div
        initial={{ opacity: 0, y: 70, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.75, ease: [0.21, 0.45, 0.15, 1] }}
        className="relative z-10 mt-20 w-full max-w-4xl mx-auto px-4"
      >
        <div
          className="relative rounded-[20px] overflow-hidden border border-white/8"
          style={{
            background: 'rgba(10,14,22,0.97)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
          }}
        >
          {/* Chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/4" style={{ background: 'rgba(255,255,255,0.025)' }}>
            {['bg-red-500/70', 'bg-amber-500/70', 'bg-emerald-500/70'].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${c}`} />
            ))}
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-1.5 bg-white/4 rounded-lg px-3 py-1.5">
                <Globe className="w-3 h-3 text-zinc-600" />
                <span className="text-[11px] text-zinc-600 font-mono">nexusaas.com.br/dashboard</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 grid grid-cols-3 gap-3">
            {[
              { label: 'Receita ativa',    value: 'R$ 48.320', delta: '+23% este mês',   color: '#22c55e' },
              { label: 'Leads quentes',    value: '247',        delta: '+17 hoje',         color: '#f59e0b' },
              { label: 'IA executou hoje', value: '1.847',      delta: 'ações automáticas', color: '#3b82f6' },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 + i * 0.1 }}
                className="rounded-xl p-4 border border-white/4"
                style={{ background: 'rgba(255,255,255,0.025)' }}
              >
                <p className="text-[11px] text-zinc-600 mb-1">{m.label}</p>
                <p className="text-xl font-black text-white">{m.value}</p>
                <p className="text-[11px] mt-1 font-medium" style={{ color: m.color }}>{m.delta}</p>
              </motion.div>
            ))}

            {/* Activity */}
            <div className="col-span-2 rounded-xl p-4 border border-white/4" style={{ background: 'rgba(255,255,255,0.015)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Atividade IA · ao vivo</p>
              </div>
              <div className="space-y-2.5">
                {[
                  { e: '⚡', t: 'Cobrança enviada para 23 clientes em atraso — R$ 18.420',  ts: 'há 30s' },
                  { e: '✅', t: 'Tarefa criada: revisar proposta cliente Omega · 09h amanhã', ts: 'há 1min' },
                  { e: '📊', t: 'Relatório financeiro mensal gerado automaticamente',          ts: 'há 2min' },
                ].map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.4 + i * 0.12 }}
                    className="flex items-center gap-2.5"
                  >
                    <span className="text-sm shrink-0">{a.e}</span>
                    <span className="text-[11px] text-zinc-400 flex-1 truncate">{a.t}</span>
                    <span className="text-[10px] text-zinc-700 shrink-0">{a.ts}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="rounded-xl p-4 border border-emerald-500/15" style={{ background: 'rgba(34,197,94,0.04)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">NEXUS ativo</p>
              </div>
              <p className="text-[11px] text-zinc-600">Operando há</p>
              <p className="text-2xl font-black text-white mt-0.5">47 dias</p>
              <p className="text-[10px] text-zinc-700">sem interrupção</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

// ─── Live Demo ────────────────────────────────────────────────────────────────

const EXCHANGES = [
  { u: 'Crie uma tarefa para amanhã: revisar proposta do cliente Omega',    n: '✅ Tarefa criada. "Revisar proposta — Omega" · 09h00 de amanhã' },
  { u: 'Abra o CRM e mostre meus leads mais quentes',                       n: '🔥 17 leads quentes encontrados. Ordenados por score e temperatura.' },
  { u: 'Envie cobrança para todos os clientes em atraso agora',             n: '⚡ 23 cobranças enviadas. R$ 18.420 em recuperação ativa.' },
  { u: 'Gere um relatório de receita do mês com análise de crescimento',    n: '📊 Relatório gerado. MRR: R$ 48.320 · Crescimento: +23%.' },
]

function LiveDemo() {
  const ref      = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const [step,  setStep]  = useState(-1)
  const [phase, setPhase] = useState<'idle' | 'typing' | 'waiting' | 'nexus'>('idle')
  const [typed, setTyped]  = useState('')

  useEffect(() => {
    if (!isInView) return
    let t: ReturnType<typeof setTimeout>

    const run = (s: number) => {
      if (s >= EXCHANGES.length) return
      setStep(s)
      setPhase('typing')
      setTyped('')
      const msg = EXCHANGES[s].u
      let i = 0
      const type = () => {
        i++
        setTyped(msg.slice(0, i))
        if (i < msg.length) t = setTimeout(type, 26)
        else {
          t = setTimeout(() => {
            setPhase('waiting')
            t = setTimeout(() => {
              setPhase('nexus')
              t = setTimeout(() => run(s + 1), 2200)
            }, 900)
          }, 300)
        }
      }
      t = setTimeout(type, s === 0 ? 600 : 300)
    }

    t = setTimeout(() => run(0), 400)
    return () => clearTimeout(t)
  }, [isInView])

  return (
    <section id="demo" className="relative py-32 px-6" ref={ref}>
      <div className="max-w-3xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-4">Demonstração ao vivo</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Veja o Nexus em ação</h2>
          <p className="text-zinc-400 text-lg">Fale com sua empresa. Ela executa.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="rounded-[22px] overflow-hidden border border-white/8"
          style={{
            background: 'rgba(10,14,22,0.98)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/25 flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-400" fill="currentColor" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white">NEXUS OS</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[11px] text-emerald-400">Operacional</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="p-6 space-y-4 min-h-[340px]">
            {step >= 0 && EXCHANGES.slice(0, step + 1).map((ex, i) => {
              const isCurrent = i === step
              return (
                <div key={i} className="space-y-3">
                  {/* User */}
                  <div className="flex justify-end">
                    <div className="max-w-[82%] bg-zinc-800/80 border border-zinc-700/40 rounded-2xl rounded-tr-sm px-4 py-3">
                      <p className="text-[13px] text-zinc-200 leading-relaxed">
                        {isCurrent && phase === 'typing' ? (
                          <>{typed}<span className="opacity-50">|</span></>
                        ) : ex.u}
                      </p>
                    </div>
                  </div>

                  {/* Nexus */}
                  {(i < step || (isCurrent && (phase === 'waiting' || phase === 'nexus'))) && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                      className="flex justify-start"
                    >
                      <div
                        className="max-w-[82%] rounded-2xl rounded-tl-sm px-4 py-3 border border-violet-500/15"
                        style={{ background: 'rgba(30,64,175,0.12)' }}
                      >
                        {isCurrent && phase === 'waiting' ? (
                          <div className="flex items-center gap-2">
                            {[0, 1, 2].map(d => (
                              <motion.div key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                                animate={{ opacity: [0.2, 1, 0.2] }}
                                transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.2 }}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-[13px] text-violet-100 leading-relaxed">{ex.n}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Input bar */}
          <div className="px-6 pb-6">
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800/80 px-4 py-3" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <span className="text-[12px] text-zinc-700 flex-1 select-none">Fale com o Nexus...</span>
              <div className="w-8 h-8 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-violet-400" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const EARLY_ACCESS = [
  { icon: Users,      label: 'Onboarding direto com o time', desc: 'Sem suporte terceirizado — você fala com quem construiu o NEXUS.' },
  { icon: DollarSign, label: 'Preço de fundador travado',     desc: 'O valor que você ativa agora não sobe nos próximos reajustes.' },
  { icon: Workflow,   label: 'Prioridade nas próximas features', desc: 'O que você pedir entra na fila de desenvolvimento primeiro.' },
  { icon: Check,      label: 'Sem contrato de fidelidade',    desc: '7 dias grátis, cancele quando quiser, sem multa.' },
]

function EarlyAccess() {
  const ref      = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12"
        >
          <p className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-4">Fase de acesso antecipado</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Entrar agora vale mais que entrar depois</h2>
          <p className="text-zinc-400 text-lg">NEXUS está em lançamento. Quem ativa agora trava condições que não voltam.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-2xl overflow-hidden border border-white/5 bg-white/5">
          {EARLY_ACCESS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="flex flex-col items-start gap-3 p-7"
              style={{ background: 'rgba(10,14,22,0.97)' }}
            >
              <div className="w-9 h-9 rounded-lg bg-violet-600/15 border border-violet-500/25 flex items-center justify-center">
                <s.icon className="w-4 h-4 text-violet-400" />
              </div>
              <p className="text-[15px] font-bold text-white leading-tight">{s.label}</p>
              <p className="text-[13px] text-zinc-500 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── COO vs Chatbot ────────────────────────────────────────────────────────────

function CooVsChat() {
  const ref      = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const chatbotItems = ['Responde perguntas', 'Espera instruções', 'Não executa ações', 'Sem memória operacional', 'Reativo, nunca proativo']
  const nexusItems   = ['Executa ações reais', 'Controla projetos automaticamente', 'Gerencia equipe e tarefas', 'Organiza vendas e CRM', 'Opera toda sua empresa', 'Proativo 24h por dia', 'Aprende e evolui com o tempo']

  return (
    <section className="py-32 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <p className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-4">Diferencial</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Nexus não é um chatbot.</h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            É uma inteligência operacional que executa, decide e age dentro da sua empresa.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Chatbot */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="rounded-2xl border border-zinc-800/80 p-8"
            style={{ background: 'rgba(16,16,22,0.7)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-[12px] font-black text-zinc-500 uppercase tracking-widest">Chatbot comum</p>
                <p className="text-[11px] text-zinc-700">Responde. Não executa.</p>
              </div>
            </div>
            <ul className="space-y-3">
              {chatbotItems.map((item, i) => (
                <motion.li key={item} initial={{ opacity: 0, x: -8 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.25 + i * 0.07 }} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border border-zinc-800 flex items-center justify-center shrink-0">
                    <span className="text-zinc-700 text-[10px] font-bold">—</span>
                  </div>
                  <span className="text-[13px] text-zinc-600">{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Nexus */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative rounded-2xl border border-violet-500/25 p-8 overflow-hidden"
            style={{
              background: 'rgba(10,14,22,0.97)',
            }}
          >
            <div className="absolute top-5 right-5">
              <span className="text-[10px] font-black text-violet-400 bg-violet-500/12 border border-violet-500/25 rounded-full px-2.5 py-1 tracking-widest">NEXUS OS</span>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/25 flex items-center justify-center">
                <Zap className="w-5 h-5 text-violet-400" fill="currentColor" />
              </div>
              <div>
                <p className="text-[12px] font-black text-white uppercase tracking-widest">Nexus OS</p>
                <p className="text-[11px] text-violet-400">Opera. Decide. Executa.</p>
              </div>
            </div>
            <ul className="space-y-3">
              {nexusItems.map((item, i) => (
                <motion.li key={item} initial={{ opacity: 0, x: 8 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.3 + i * 0.07 }} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-violet-500/15 border border-violet-500/35 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-violet-400" />
                  </div>
                  <span className="text-[13px] text-zinc-200">{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── OS Modules ───────────────────────────────────────────────────────────────

const MODULES = [
  { icon: Users,         label: 'CRM',         desc: 'Leads, pipeline, clientes',          color: '#3b82f6' },
  { icon: BarChart3,     label: 'Projetos',     desc: 'Tarefas, times, entregas',           color: '#2563eb' },
  { icon: MessageSquare, label: 'WhatsApp',     desc: 'Atendimento e cobrança com IA',      color: '#22c55e' },
  { icon: Workflow,      label: 'Automações',   desc: 'Fluxos inteligentes 24/7',           color: '#C9A227' },
  { icon: Bot,           label: 'Agentes',      desc: 'IA especialista por departamento',   color: '#60a5fa' },
  { icon: DollarSign,    label: 'Financeiro',   desc: 'DRE, fluxo de caixa, receita',      color: '#0891b2' },
  { icon: Brain,         label: 'CEO Mode',     desc: 'Dashboard executivo em tempo real',  color: '#64748b' },
  { icon: Sparkles,      label: 'NEXUS OS',     desc: 'Voz, comandos, orquestração total', color: '#1e40af' },
]

function OSModules() {
  const ref      = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section className="py-24 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <p className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-4">Sistema Operacional</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Um OS. Toda sua empresa.</h2>
          <p className="text-zinc-400 text-lg">Cada módulo é um departamento inteligente.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="rounded-[20px] overflow-hidden border border-white/6"
          style={{ background: 'rgba(7,7,16,0.98)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}
        >
          {/* OS bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/4" style={{ background: 'rgba(255,255,255,0.018)' }}>
            {['bg-red-500/60','bg-amber-500/60','bg-emerald-500/60'].map((c,i) => <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
            <span className="text-[10px] text-zinc-700 ml-3 font-mono">NEXUS OS v4.0 · 8 módulos ativos</span>
            <div className="ml-auto flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-500">live</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/4">
            {MODULES.map((mod, i) => (
              <motion.div
                key={mod.label}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.06 }}
                className="group relative p-5 transition-all duration-300 cursor-default"
                style={{ background: 'rgba(8,8,18,0.99)' }}
                whileHover={{ backgroundColor: 'rgba(16,16,28,1)' }}
              >
                {/* Hover glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                  style={{ background: `radial-gradient(ellipse at 30% 30%, ${mod.color}18 0%, transparent 65%)` }}
                />
                <div className="relative">
                  <div
                    className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center"
                    style={{ background: `${mod.color}18`, border: `1px solid ${mod.color}28` }}
                  >
                    <mod.icon className="w-4.5 h-4.5" style={{ color: mod.color, width: 18, height: 18 }} />
                  </div>
                  <p className="text-[13px] font-bold text-white mb-0.5">{mod.label}</p>
                  <p className="text-[11px] text-zinc-600 leading-snug">{mod.desc}</p>
                </div>
                <div className="absolute top-3.5 right-3.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: mod.color, boxShadow: `0 0 5px ${mod.color}` }} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Founder's note ───────────────────────────────────────────────────────────
// Deliberately no fabricated logos/testimonials/usage stats here. NEXUS is
// pre-scale — an honest "why trust something new" framing converts better
// with this audience than invented social proof, and doesn't blow up the
// moment a prospect asks to talk to "Ricardo Melo da AgênciaPrime".

const SELF_SELECT = [
  { fit: true,  text: 'Sua empresa já fatura e você quer ver onde a IA recupera receita ou corta custo — com números, não promessa.' },
  { fit: true,  text: 'Você toma a decisão de comprar (sócio, CEO, diretor) e quer testar antes de comprometer o time todo.' },
  { fit: false, text: 'Sua empresa ainda não tem faturamento recorrente, ou você só está pesquisando IA por curiosidade.' },
]

function FounderNote() {
  const ref      = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section className="py-24 px-6" ref={ref}>
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12"
        >
          <p className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-4">Direto ao ponto</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">NEXUS é novo. É por isso que vale entrar agora.</h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Não vamos inventar 1.000 clientes que não existem. NEXUS está em fase de
            acesso antecipado — quem entra agora ajuda a moldar o produto e trava
            condições que não vão existir depois.
          </p>
        </motion.div>

        <div className="space-y-3">
          {SELF_SELECT.map((s, i) => (
            <motion.div
              key={s.text}
              initial={{ opacity: 0, x: -12 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              className="flex items-start gap-3 rounded-xl border border-white/5 p-4"
              style={{ background: 'rgba(10,14,22,0.97)' }}
            >
              <span className={`mt-0.5 text-[13px] font-black ${s.fit ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {s.fit ? 'É pra você ·' : 'Não é pra você ·'}
              </span>
              <span className="text-[13px] text-zinc-400 leading-relaxed">{s.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Starter', price: 'R$ 197', sub: '/mês',
    desc: 'Para quem está começando',
    features: ['CRM básico', 'Pipeline de vendas', 'Projetos e tarefas', '1 agente IA', '500 msgs IA/mês'],
    cta: 'Começar grátis', href: '/signup?plan=starter', hot: false,
  },
  {
    name: 'Pro', price: 'R$ 397', sub: '/mês',
    desc: 'Para negócios em crescimento',
    badge: 'Mais popular',
    features: ['Tudo do Starter', 'WhatsApp IA completo', 'Automações ilimitadas', '5 agentes IA', 'Analytics avançado', 'Exportar relatórios'],
    cta: 'Começar grátis', href: '/signup?plan=pro', hot: true,
  },
  {
    name: 'Business', price: 'R$ 797', sub: '/mês',
    desc: 'Para equipes completas',
    features: ['Tudo do Pro', 'Nexus COO', 'IA Executiva', '20 usuários', 'API access', 'Dashboard avançado'],
    cta: 'Falar com equipe', href: '/signup?plan=business', hot: false,
  },
  {
    name: 'Enterprise', price: 'Consulta', sub: '',
    desc: 'Para grandes operações',
    features: ['Tudo desbloqueado', 'White label', 'Múltiplas empresas', 'API avançada', 'Suporte dedicado', 'SLA garantido'],
    cta: 'Falar com equipe', href: '/signup?plan=enterprise', hot: false,
  },
]

function Pricing() {
  const ref      = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section className="py-32 px-6" ref={ref} id="precos">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <p className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-4">Planos</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Escolha o poder certo</h2>
          <p className="text-zinc-400 text-lg">7 dias grátis em todos os planos.</p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-4">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="relative rounded-2xl p-6 border"
              style={{
                background: plan.hot
                  ? 'rgba(30,64,175,0.08)'
                  : 'rgba(10,14,22,0.97)',
                border: plan.hot ? '1px solid rgba(30,64,175,0.5)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: plan.hot ? '0 20px 40px rgba(0,0,0,0.4)' : undefined,
              }}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black text-white tracking-wider"
                  style={{ background: '#1E40AF' }}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-5">
                <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <p className={`text-[clamp(22px,3vw,28px)] font-black ${plan.hot ? 'text-white' : 'text-zinc-300'}`}>{plan.price}</p>
                  {plan.sub && <p className="text-[12px] text-zinc-600">{plan.sub}</p>}
                </div>
                <p className="text-[12px] text-zinc-600 mt-1">{plan.desc}</p>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className={`w-3.5 h-3.5 shrink-0 ${plan.hot ? 'text-violet-400' : 'text-zinc-700'}`} />
                    <span className="text-[12px] text-zinc-500">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`block w-full text-center text-[13px] font-bold py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] ${
                  plan.hot ? 'text-white' : 'text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
                }`}
                style={plan.hot ? {
                  background: '#1E40AF',
                } : {}}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  const ref      = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section className="py-32 px-6" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.9 }}
        className="max-w-4xl mx-auto relative rounded-3xl overflow-hidden text-center"
        style={{
          background: 'rgba(13,20,33,0.98)',
          border: '1px solid rgba(30,64,175,0.35)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
        }}
      >
        <div className="relative px-8 py-24">
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.2 }}
            className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-6"
          >
            Resultado no caixa, não promessa
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="text-4xl md:text-[56px] font-black text-white leading-[0.95] tracking-tight mb-6"
          >
            Sua empresa ainda depende<br />de humanos para tudo?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.45 }}
            className="text-lg text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Ative o Nexus OS e coloque uma IA operando seu negócio hoje.
            7 dias grátis, sem cartão de crédito.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.55 }}
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-3 text-[17px] font-black text-white px-14 py-5 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: '#1E40AF',
                boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
              }}
            >
              <Zap className="w-5 h-5" fill="currentColor" />
              ATIVAR NEXUS
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ delay: 0.65 }}
            className="text-[12px] text-zinc-700 mt-6">
            Configuração em menos de 5 minutos · Suporte humano 24/7
          </motion.p>
        </div>
      </motion.div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/4 py-12 px-6">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" fill="currentColor" />
          </div>
          <span className="text-[13px] font-black text-white tracking-tight">NEXUS OS</span>
        </Link>
        <div className="flex items-center gap-7">
          {['Produto', 'Planos', 'API', 'Termos', 'Privacidade'].map(l => (
            <a key={l} href="#" className="text-[12px] text-zinc-700 hover:text-zinc-400 transition-colors">{l}</a>
          ))}
        </div>
        <p className="text-[11px] text-zinc-800">© 2026 Nexus OS · Feito no Brasil 🇧🇷</p>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="relative bg-[#0A0E16] text-white antialiased scroll-smooth">
      <Mesh />
      <div className="relative z-10">
        <Nav />
        <Hero />
        <LiveDemo />
        <EarlyAccess />
        <CooVsChat />
        <OSModules />
        <FounderNote />
        <Pricing />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  )
}
