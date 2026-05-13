'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  Brain, Zap, TrendingUp, Users, MessageSquare, BarChart3,
  ArrowRight, Shield, Activity, Sparkles, Target,
  DollarSign, Clock, Rocket, X, CheckCircle2,
  Bot, Megaphone, Wallet, Settings, Layout, ShoppingCart,
  GitBranch, FileText, ChevronUp, Cpu, Globe, Layers,
  LogIn, Eye, EyeOff, Lock, Mail, Check,
} from 'lucide-react'

// ─── Static Data ──────────────────────────────────────────────────────────────

const NAV_LINKS = ['Produto', 'Soluções', 'Integrações', 'Casos', 'Segurança', 'Preços']

const AI_ACTIVITIES = [
  { icon: '⚠️', text: 'Cobrança enviada para 23 clientes', time: 'há 1 min', color: '#F59E0B' },
  { icon: '✅', text: 'Campanha de reativação criada', time: 'há 2 min', color: '#22C55E' },
  { icon: '👤', text: 'Novo lead qualificado encontrado', time: 'há 5 min', color: '#6C5CE7' },
  { icon: '📊', text: 'Análise financeira concluída', time: 'há 7 min', color: '#3B82F6' },
  { icon: '⚡', text: 'Automação executada com sucesso', time: 'há 9 min', color: '#F59E0B' },
]

const TICKER_CARDS = [
  { icon: '💬', color: '#22C55E', label: 'Cobrança enviada', value: 'R$ 4.820 recuperados', time: 'há 1 min' },
  { icon: '📣', color: '#7C3AED', label: 'Campanha criada', value: '12.430 pessoas alcançadas', time: 'há 2 min' },
  { icon: '👤', color: '#06B6D4', label: 'Lead qualificado', value: 'Detectado automaticamente', time: 'há 3 min' },
  { icon: '📈', color: '#F59E0B', label: 'Oportunidade encontrada', value: 'R$ 18.400 identificados', time: 'há 4 min' },
]

const LOGOS = ['AGÊNCIA X', 'PRIME CO.', 'DOCTORS+', 'FIT CLUB', 'DELIVERY KING', 'SHOP TECH', 'CONTABILIZA+']

const STATS = [
  { label: 'Empresas ativas', value: '340+', sub: 'operando com NEXUS', spark: [20, 28, 22, 35, 30, 45, 38, 55, 50, 62, 58, 75, 70, 85, 80, 95], color: '#7C3AED' },
  { label: 'Receita recuperada', value: 'R$ 2.4M+', sub: 'em cobranças automáticas', spark: [15, 22, 18, 30, 25, 38, 45, 40, 55, 50, 65, 60, 72, 80, 76, 90], color: '#7C3AED' },
  { label: 'Tarefas executadas', value: '89.431+', sub: 'pela IA nas últimas 24h', spark: [30, 25, 35, 30, 42, 38, 50, 45, 60, 55, 65, 62, 70, 75, 72, 85], color: '#7C3AED' },
  { label: 'Horas economizadas', value: '12.843h+', sub: 'de trabalho manual', spark: [10, 18, 14, 25, 20, 32, 28, 40, 35, 48, 44, 55, 50, 62, 58, 70], color: '#00F5D4' },
  { label: 'Aumento médio', value: '+43%', sub: 'de eficiência operacional', spark: [20, 15, 25, 20, 30, 28, 38, 34, 44, 40, 50, 46, 55, 52, 60, 68], color: '#00F5D4' },
]

const FEATURES = [
  { icon: MessageSquare, color: '#22C55E', bg: 'rgba(34,197,94,0.1)', title: 'Atendimento e Cobrança', desc: 'Analisa fluxo de caixa, responde e cobra clientes automaticamente pelo WhatsApp.' },
  { icon: Megaphone, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', title: 'Marketing e Campanhas', desc: 'Cria campanhas, textos, copies e anúncios de forma autônoma.' },
  { icon: BarChart3, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', title: 'Análise Financeira', desc: 'Analisa fluxo de caixa, inadimplência, DRE e gera alertas inteligentes.' },
  { icon: Users, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', title: 'Vendas e Leads', desc: 'Qualifica leads, faz follow-up e aumenta conversão de vendas automaticamente.' },
  { icon: Bot, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', title: 'Agentes IA', desc: 'Agentes especializados executam operações complexas por você.' },
  { icon: Zap, color: '#EAB308', bg: 'rgba(234,179,8,0.1)', title: 'Automações', desc: 'Automatiza processos repetitivos e integra todos os setores.' },
]

const FLOAT_NOTIFS = [
  { icon: '💬', text: 'Cobrança enviada — R$ 1.840', color: '#22C55E' },
  { icon: '🎯', text: 'Novo lead identificado', color: '#7C3AED' },
  { icon: '⚡', text: 'Fluxo automatizado com sucesso', color: '#06B6D4' },
  { icon: '📣', text: 'Campanha criada — 8.200 alcançados', color: '#F59E0B' },
]

const AUTONOMOUS_BULLETS = [
  { icon: '🧠', text: 'Entende o contexto da sua empresa' },
  { icon: '⚡', text: 'Decide e executa sem intervenção humana' },
  { icon: '🔄', text: 'Aprende e melhora com cada operação' },
  { icon: '📊', text: 'Gera análises e relatórios automáticos' },
  { icon: '🤖', text: 'Agentes IA especializados em cada setor' },
  { icon: '🌐', text: 'Opera 24/7 sem parar ou cansar' },
]

const ORBIT_ICONS = [
  { Icon: Bot, color: '#7C3AED', label: 'Agentes IA' },
  { Icon: Zap, color: '#F59E0B', label: 'Automações' },
  { Icon: BarChart3, color: '#3B82F6', label: 'Análises' },
  { Icon: Megaphone, color: '#22C55E', label: 'Campanhas' },
  { Icon: Users, color: '#06B6D4', label: 'Clientes' },
  { Icon: Globe, color: '#EC4899', label: 'Integrações' },
]

const LIVE_FEED = [
  { icon: '💰', text: 'Fatura recuperada — R$ 3.200', time: 'agora mesmo', color: '#22C55E', company: 'Clínica Vitalis' },
  { icon: '🎯', text: 'Lead qualificado — score 94', time: 'há 12s', color: '#7C3AED', company: 'Agência Growth' },
  { icon: '📣', text: 'Campanha lançada — 9.400 contatos', time: 'há 28s', color: '#F59E0B', company: 'Delivery Fast' },
  { icon: '⚡', text: 'Automação executada — 340 tarefas', time: 'há 45s', color: '#06B6D4', company: 'Tech Plus' },
  { icon: '📊', text: 'Alerta financeiro gerado', time: 'há 1 min', color: '#EC4899', company: 'Prime Co.' },
]

const TRUST_ITEMS = [
  { icon: Activity, label: 'IA Operando 24/7', desc: 'Sistemas ativos ininterruptamente', color: '#22C55E' },
  { icon: Shield, label: 'Infraestrutura Segura', desc: 'Criptografia de ponta a ponta', color: '#3B82F6' },
  { icon: Cpu, label: 'Inteligência em Tempo Real', desc: 'Decisões em milissegundos', color: '#7C3AED' },
  { icon: Globe, label: 'Integrado a Tudo', desc: '+120 integrações nativas', color: '#F59E0B' },
]

const CHART_BASE = [18, 22, 19, 28, 24, 32, 27, 38, 34, 45, 40, 52, 47, 60, 55, 68, 62, 75, 70, 82, 76, 85, 80, 90, 85, 95, 88, 98, 92, 100]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkLinePath(data: number[], w: number, h: number) {
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * h * 0.88 - 2,
  }))
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${d} L ${pts[pts.length - 1].x} ${h} L 0 ${h} Z`
  return { line: d, area, pts }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const { line } = mkLinePath(data, 80, 28)
  return (
    <svg viewBox="0 0 80 28" width="80" height="28" style={{ overflow: 'visible' }}>
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DashboardChart({ data }: { data: number[] }) {
  const { line, area } = mkLinePath(data, 280, 90)
  return (
    <svg viewBox="0 0 280 90" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </linearGradient>
        <filter id="lineGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={area} fill="url(#areaGrad)" />
      <path d={line} fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" filter="url(#lineGlow)" />
    </svg>
  )
}

function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.025 }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid-sm" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid-lg" width="200" height="200" patternUnits="userSpaceOnUse">
            <rect width="200" height="200" fill="url(#grid-sm)" />
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-lg)" />
      </svg>
    </div>
  )
}

function GlowBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 65%)', top: '-15%', left: '-8%', filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,245,212,0.1) 0%, transparent 65%)', top: '25%', right: '0%', filter: 'blur(90px)' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 65%)', bottom: '10%', left: '30%', filter: 'blur(60px)' }} />
    </div>
  )
}

function Particles() {
  const pts = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i, x: (i * 43 + 7) % 100, y: (i * 61 + 11) % 100,
    s: 1 + (i % 3) * 0.5, dur: 4 + (i % 4) * 2, delay: -(i * 0.4),
  })), [])
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pts.map(p => (
        <motion.div key={p.id} className="absolute rounded-full bg-violet-400"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, opacity: 0.12 }}
          animate={{ y: [0, -18, 0], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

function FloatingNotification() {
  const [idx, setIdx] = useState(0)
  const [vis, setVis] = useState(false)

  useEffect(() => {
    const start = setTimeout(() => setVis(true), 2000)
    return () => clearTimeout(start)
  }, [])

  useEffect(() => {
    if (!vis) return
    const t = setInterval(() => {
      setVis(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % FLOAT_NOTIFS.length)
        setVis(true)
      }, 600)
    }, 3200)
    return () => clearInterval(t)
  }, [vis])

  const n = FLOAT_NOTIFS[idx]

  return (
    <AnimatePresence mode="wait">
      {vis && (
        <motion.div
          key={idx}
          className="absolute flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl z-30 select-none"
          style={{
            top: '-14px',
            right: '-10px',
            background: 'rgba(6,8,18,0.95)',
            border: `1px solid ${n.color}55`,
            backdropFilter: 'blur(20px)',
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 24px ${n.color}20`,
          }}
          initial={{ opacity: 0, x: 20, scale: 0.88 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 16, scale: 0.9 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <span style={{ fontSize: 14 }}>{n.icon}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap', fontWeight: 600 }}>{n.text}</span>
          <motion.span
            style={{ width: 5, height: 5, borderRadius: '50%', background: n.color, display: 'inline-block', marginLeft: 2, flexShrink: 0 }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedNumber({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView) return
    const dur = 1800
    const fps = 60
    const step = dur / fps
    const inc = to / fps
    let cur = 0
    const t = setInterval(() => {
      cur += inc
      if (cur >= to) { setVal(to); clearInterval(t) }
      else setVal(Math.floor(cur))
    }, step)
    return () => clearInterval(t)
  }, [inView, to])

  return <span ref={ref}>{prefix}{val.toLocaleString('pt-BR')}{suffix}</span>
}

// ─── NEXUS OS Dashboard ────────────────────────────────────────────────────────

function NexusOS() {
  const [chartData, setChartData] = useState(CHART_BASE)
  const [faturamento, setFaturamento] = useState(94200)
  const [receita, setReceita] = useState(8100)
  const [eficiencia, setEficiencia] = useState(94)
  const [tarefas, setTarefas] = useState(2431)
  const [actIdx, setActIdx] = useState(0)

  useEffect(() => {
    const t1 = setInterval(() => {
      setFaturamento(v => v + Math.floor(Math.random() * 800 + 100))
      setReceita(v => v + Math.floor(Math.random() * 300 + 50))
      setTarefas(v => v + Math.floor(Math.random() * 3 + 1))
      setEficiencia(v => Math.min(99, Math.max(88, +(v + (Math.random() - 0.4) * 0.5).toFixed(1))))
      setChartData(prev => {
        const last = prev[prev.length - 1]
        const next = Math.min(100, Math.max(15, last + (Math.random() - 0.38) * 8))
        return [...prev.slice(1), +next.toFixed(1)]
      })
    }, 2800)
    const t2 = setInterval(() => setActIdx(i => (i + 1) % AI_ACTIVITIES.length), 3200)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [])

  const fmtBRL = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`
  const SIDEBAR_NAV = ['Visão Geral', 'Operações', 'Clientes', 'Vendas', 'Financeiro', 'Marketing', 'Automações', 'Integrações', 'Relatórios', 'Configurações']

  return (
    <div
      className="rounded-2xl overflow-hidden select-none"
      style={{
        background: '#080B16',
        border: '1px solid rgba(124,58,237,0.3)',
        boxShadow: '0 0 0 1px rgba(124,58,237,0.12), 0 40px 120px rgba(0,0,0,0.85), 0 0 80px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.6), rgba(0,245,212,0.3), transparent)' }} />

      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ background: 'rgba(4,6,14,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', boxShadow: '0 0 10px rgba(124,58,237,0.5)' }}>
            <Brain size={11} color="#fff" />
          </div>
          <span className="text-xs font-black text-white/80 tracking-wide">NEXUS OS</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.3, 1], boxShadow: ['0 0 4px #22C55E', '0 0 0px #22C55E', '0 0 4px #22C55E'] } as any}
            transition={{ duration: 1.2, repeat: Infinity }} />
          <span className="text-[10px] font-bold text-green-400 tracking-wider">IA ATIVA</span>
        </div>
      </div>

      <div className="flex" style={{ height: 420 }}>
        <div className="w-36 shrink-0 py-3 flex flex-col"
          style={{ background: 'rgba(4,6,14,0.5)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          {SIDEBAR_NAV.map((item, i) => (
            <div key={item} className="px-3 py-[7px] mx-2 rounded-lg text-[10px] cursor-pointer mb-0.5 transition-all"
              style={{
                background: i === 0 ? 'rgba(124,58,237,0.2)' : 'transparent',
                color: i === 0 ? '#A78BFA' : 'rgba(255,255,255,0.28)',
                fontWeight: i === 0 ? 700 : 400,
                borderLeft: i === 0 ? '2px solid #7C3AED' : '2px solid transparent',
              }}>
              {item}
            </div>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
          <div className="flex items-center justify-between shrink-0">
            <p className="text-xs font-bold text-white/70">Centro Operacional</p>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }}>SISTEMA ONLINE</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'FATURAMENTO', value: fmtBRL(faturamento), delta: '+12% vs mês ant.', up: true },
              { label: 'RECEITA RECUPERADA', value: fmtBRL(receita), delta: '+34% recuperado', up: true },
              { label: 'EFICIÊNCIA IA', value: `${eficiencia}%`, delta: '+7.1% este mês', up: true },
              { label: 'TAREFAS EXECUTADAS', value: tarefas.toLocaleString('pt-BR'), delta: '+16% este mês', up: true },
            ].map((k, i) => (
              <div key={i} className="rounded-xl p-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <p style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em', fontWeight: 700 }}>{k.label}</p>
                <motion.p key={k.value} className="font-black text-white" style={{ fontSize: '14px', lineHeight: 1 }}
                  initial={{ opacity: 0.6, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  {k.value}
                </motion.p>
                <div className="flex items-center gap-0.5 mt-1">
                  <ChevronUp size={8} color="#22C55E" />
                  <span style={{ fontSize: '8px', color: '#22C55E', fontWeight: 600 }}>{k.delta}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
            <div className="rounded-xl p-3 flex flex-col"
              style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', fontWeight: 700 }}>RECEITA – ÚLTIMOS 30 DIAS</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>+23%</span>
              </div>
              <div className="flex-1 relative">
                <DashboardChart data={chartData} />
              </div>
              <div className="flex justify-between mt-1 shrink-0">
                {['01/05', '05/05', '10/05', '15/05', '20/05', '25/05', '30/05'].map(d => (
                  <span key={d} style={{ fontSize: '7px', color: 'rgba(255,255,255,0.18)' }}>{d}</span>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-3 flex flex-col"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Atividades da IA</span>
                <motion.span style={{ fontSize: '8px', color: '#7C3AED', cursor: 'pointer', fontWeight: 700 }}
                  animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }}>AO VIVO</motion.span>
              </div>
              <div className="space-y-2 flex-1 overflow-hidden">
                {AI_ACTIVITIES.map((act, i) => (
                  <motion.div key={`${actIdx}-${i}`} className="flex items-start justify-between gap-2"
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}>
                    <div className="flex items-start gap-1.5">
                      <span style={{ fontSize: '9px' }}>{act.icon}</span>
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{act.text}</span>
                    </div>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap', flexShrink: 0 }}>{act.time}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2"
        style={{ background: 'rgba(4,6,14,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)' }}>NEXUS IA está operando sua empresa agora</span>
        </div>
        <span className="font-black" style={{ fontSize: '9px', color: '#22C55E', letterSpacing: '0.05em' }}>100% ONLINE</span>
      </div>

      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.3), rgba(124,58,237,0.5), transparent)' }} />
    </div>
  )
}

// ─── Holographic Brain ────────────────────────────────────────────────────────

function HolographicBrain() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 360, height: 360 }}>
      <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', filter: 'blur(30px)' }} />

      <motion.div className="absolute rounded-full"
        style={{ width: 300, height: 300, border: '1px solid rgba(124,58,237,0.2)', top: '50%', left: '50%', marginTop: -150, marginLeft: -150 }}
        animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}>
        {ORBIT_ICONS.slice(0, 3).map((item, i) => {
          const angle = i * 120
          const rad = (angle * Math.PI) / 180
          const r = 150
          const x = r + Math.cos(rad) * r - 18
          const y = r + Math.sin(rad) * r - 18
          return (
            <motion.div key={i} className="absolute w-9 h-9 rounded-full flex items-center justify-center"
              style={{ left: x, top: y, background: `${item.color}18`, border: `1px solid ${item.color}40` }}
              animate={{ rotate: -360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}>
              <item.Icon size={14} style={{ color: item.color }} />
            </motion.div>
          )
        })}
      </motion.div>

      <motion.div className="absolute rounded-full"
        style={{ width: 200, height: 200, border: '1px solid rgba(0,245,212,0.15)', top: '50%', left: '50%', marginTop: -100, marginLeft: -100 }}
        animate={{ rotate: -360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}>
        {ORBIT_ICONS.slice(3, 6).map((item, i) => {
          const angle = i * 120 + 60
          const rad = (angle * Math.PI) / 180
          const r = 100
          const x = r + Math.cos(rad) * r - 14
          const y = r + Math.sin(rad) * r - 14
          return (
            <motion.div key={i} className="absolute w-7 h-7 rounded-full flex items-center justify-center"
              style={{ left: x, top: y, background: `${item.color}20`, border: `1px solid ${item.color}50` }}
              animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}>
              <item.Icon size={11} style={{ color: item.color }} />
            </motion.div>
          )
        })}
      </motion.div>

      <div className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(91,33,182,0.5))', border: '1px solid rgba(124,58,237,0.5)', boxShadow: '0 0 40px rgba(124,58,237,0.4), 0 0 80px rgba(124,58,237,0.15)' }}>
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
          <Brain size={40} color="#A78BFA" />
        </motion.div>
      </div>

      {[1, 2, 3].map(i => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ border: '1px solid rgba(124,58,237,0.15)', top: '50%', left: '50%' }}
          animate={{ width: [50, 320], height: [50, 320], marginTop: [-25, -160], marginLeft: [-25, -160], opacity: [0.5, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: i * 1.15, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

// ─── Login Modal ──────────────────────────────────────────────────────────────

function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    window.location.href = '/login'
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      >
        <motion.div
          className="relative w-full max-w-sm"
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'rgba(8,11,22,0.98)',
            border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: 24,
            boxShadow: '0 0 0 1px rgba(124,58,237,0.1), 0 40px 100px rgba(0,0,0,0.9), 0 0 80px rgba(124,58,237,0.15)',
            overflow: 'hidden',
          }}
        >
          {/* Top glow line */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.8), rgba(0,245,212,0.4), transparent)' }} />

          <div className="p-8">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
            >
              <X size={14} />
            </button>

            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', boxShadow: '0 0 28px rgba(124,58,237,0.5)' }}>
                <Brain size={22} color="#fff" />
              </div>
              <h2 className="text-xl font-black text-white mb-1">Entrar no NEXUS</h2>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>Acesse seu sistema operacional de IA</p>
            </div>

            {/* OAuth buttons */}
            <div className="space-y-2.5 mb-6">
              <Link href="/api/auth/google" onClick={onClose}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuar com Google
              </Link>

              <Link href="/api/auth/microsoft" onClick={onClose}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <svg width="18" height="18" viewBox="0 0 23 23" fill="none">
                  <path d="M1 1h10v10H1z" fill="#F25022"/>
                  <path d="M12 1h10v10H12z" fill="#7FBA00"/>
                  <path d="M1 12h10v10H1z" fill="#00A4EF"/>
                  <path d="M12 12h10v10H12z" fill="#FFB900"/>
                </svg>
                Continuar com Microsoft
              </Link>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>ou acesse com email</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.28)' }} />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none transition-all placeholder:text-white/25"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.6)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>

              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.28)' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-white outline-none transition-all placeholder:text-white/25"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.6)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <div className="flex justify-end">
                <Link href="/login#forgot" onClick={onClose} className="text-xs transition-colors hover:opacity-80" style={{ color: '#A78BFA' }}>
                  Esqueci minha senha
                </Link>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', boxShadow: '0 0 28px rgba(124,58,237,0.45)' }}
                whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(124,58,237,0.6)' }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
                ) : (
                  <><LogIn size={14} /> Entrar no NEXUS</>
                )}
              </motion.button>
            </form>

            {/* Footer */}
            <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Não tem conta?{' '}
              <Link href="/signup" onClick={onClose} className="font-semibold transition-colors hover:opacity-80" style={{ color: '#A78BFA' }}>
                Criar conta
              </Link>
            </p>

            {/* Security badge */}
            <div className="flex items-center justify-center gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Shield size={11} style={{ color: 'rgba(255,255,255,0.22)' }} />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>Conexão criptografada · SSL · LGPD Compliant</span>
            </div>
          </div>

          {/* Bottom glow line */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.3), rgba(124,58,237,0.5), transparent)' }} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [liveFeedIdx, setLiveFeedIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setLiveFeedIdx(i => (i + 1) % LIVE_FEED.length), 2800)
    return () => clearInterval(t)
  }, [])

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = loginOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [loginOpen])

  return (
    <div style={{ background: '#05070E', color: '#EAEAF0', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── LOGIN MODAL ───────────────────────────────────────────────────────── */}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-3.5"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        style={{ backdropFilter: 'blur(24px)', background: 'rgba(5,7,14,0.88)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}>
            <Brain size={16} color="#fff" />
          </div>
          <span className="font-black text-lg text-white tracking-tight">NEXUS</span>
        </div>

        <div className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map(l => (
            <a key={l} href="#" className="text-sm text-white/45 hover:text-white/90 transition-colors duration-200">{l}</a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLoginOpen(true)}
            className="text-sm text-white/55 hover:text-white/90 transition-all px-3.5 py-2 rounded-xl hidden md:flex items-center gap-1.5"
            style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
          >
            <LogIn size={13} />
            Entrar
          </button>
          <button
            onClick={() => setLoginOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:scale-105 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}
          >
            Entrar no Nexus <ArrowRight size={14} />
          </button>
        </div>
      </motion.nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-8 px-6 lg:px-12 overflow-hidden">
        <GridBackground />
        <GlowBg />
        <Particles />

        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.04) 0%, transparent 50%, rgba(0,245,212,0.03) 100%)' }}
          animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />

        <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          {/* Left */}
          <div>
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)' }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
            >
              <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }}
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <span className="text-xs font-black tracking-widest" style={{ color: '#4ADE80' }}>SISTEMA IA ONLINE</span>
            </motion.div>

            <motion.h1
              className="text-4xl md:text-5xl font-black leading-[1.05] mb-5"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}
            >
              <span className="text-white">O sistema operacional<br />inteligente para<br /></span>
              <span style={{ background: 'linear-gradient(90deg,#7C3AED,#A78BFA,#00F5D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% 100%' }}>
                sua empresa.
              </span>
            </motion.h1>

            <motion.p
              className="text-base leading-relaxed mb-8"
              style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 440 }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            >
              O NEXUS entende, decide e executa operações críticas da sua empresa em tempo real. IA executiva que nunca para.
            </motion.p>

            <motion.div
              className="flex flex-wrap items-center gap-3 mb-8"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}
            >
              <button
                onClick={() => setLoginOpen(true)}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', boxShadow: '0 0 32px rgba(124,58,237,0.5), 0 4px 24px rgba(0,0,0,0.3)' }}>
                <LogIn size={15} /> Acessar o NEXUS
              </button>
              <a href="#demo"
                className="flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm text-white/55 hover:text-white/90 transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>▶</span>
                Ver demonstração
              </a>
            </motion.div>

            <motion.div
              className="flex items-center gap-3 mb-6"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            >
              <div className="flex -space-x-2">
                {['#7C3AED', '#06B6D4', '#22C55E', '#F59E0B'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#05070E] flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: c, boxShadow: `0 0 8px ${c}60` }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <span className="text-white font-semibold">+340 empresas</span> já operam com NEXUS
              </span>
            </motion.div>

            <motion.div className="flex flex-wrap gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
              {[
                { icon: '🤖', label: 'IA 24/7 Operando' },
                { icon: '🔒', label: 'Dados 100% Seguros' },
                { icon: '⚡', label: 'Setup em Minutos' },
                { icon: '🌐', label: '+120 Integrações' },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <span style={{ fontSize: 13 }}>{b.icon}</span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>{b.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Dashboard */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.85, delay: 0.2, ease: 'easeOut' }}
          >
            <div className="absolute -inset-8 rounded-3xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.15) 0%, transparent 70%)', filter: 'blur(20px)' }} />
            <FloatingNotification />
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
              <NexusOS />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 py-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
          {TICKER_CARDS.map((c, i) => (
            <motion.div key={c.label}
              className="group flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02] cursor-default"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              whileHover={{ borderColor: `${c.color}40`, boxShadow: `0 0 24px ${c.color}12` }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: `${c.color}18`, border: `1px solid ${c.color}30` }}>
                {c.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold mb-0.5" style={{ color: c.color }}>{c.label}</p>
                <p className="text-sm font-bold text-white truncate">{c.value}</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{c.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── LOGO BAR ─────────────────────────────────────────────────────────── */}
      <section className="px-6 py-8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-center text-[10px] font-black tracking-widest mb-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
          EMPRESAS QUE JÁ OPERAM COM NEXUS
        </p>
        <div className="flex flex-wrap items-center justify-center gap-10">
          {LOGOS.map((l, i) => (
            <motion.span key={l} className="text-sm font-black tracking-wider"
              style={{ color: 'rgba(255,255,255,0.15)' }}
              whileHover={{ color: 'rgba(255,255,255,0.5)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
            >
              {l}
            </motion.span>
          ))}
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 py-14">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-5 gap-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.07}>
              <div className="p-4 rounded-2xl flex flex-col justify-between h-full transition-all duration-300 hover:scale-[1.02] cursor-default"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="mb-3">
                  <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.38)' }}>{s.label}</p>
                  <p className="font-black text-2xl text-white leading-none mb-1" style={{ color: s.color === '#00F5D4' ? '#00F5D4' : '#fff' }}>{s.value}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.sub}</p>
                </div>
                <Sparkline data={s.spark} color={s.color} />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PROBLEMA ─────────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 py-16 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.012)' }}>
        <GridBackground />
        <div className="relative z-10 max-w-7xl mx-auto">
          <Reveal className="mb-4">
            <p className="text-xs font-black tracking-widest" style={{ color: '#EF4444' }}>O PROBLEMA</p>
          </Reveal>
          <Reveal delay={0.05} className="mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
              Empresas ainda operam <span style={{ color: 'rgba(255,255,255,0.3)' }}>como 10 anos atrás.</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: '⚙️', title: 'Processos manuais', desc: 'Tarefas repetitivas consomem horas que poderiam ser automatizadas.', color: '#EF4444' },
              { icon: '📉', title: 'Perda de vendas', desc: 'Leads morrem por falta de follow-up rápido e qualificado.', color: '#F59E0B' },
              { icon: '🔍', title: 'Falta de dados', desc: 'Decisões baseadas em achismos sem visibilidade real do negócio.', color: '#EF4444' },
              { icon: '🧩', title: 'Excesso de ferramentas', desc: 'Dezenas de sistemas desconectados gerando caos operacional.', color: '#F59E0B' },
              { icon: '😩', title: 'Equipes sobrecarregadas', desc: 'Times fazendo trabalho de robô em vez de gerar valor real.', color: '#EF4444' },
              { icon: '🌪️', title: 'Caos operacional', desc: 'Sem processos claros, cada dia é uma apagação de incêndio.', color: '#F59E0B' },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06}>
                <div className="group p-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] cursor-default h-full"
                  style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(239,68,68,0.28)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(239,68,68,0.12)')}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-xl"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1.5">{item.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── O FUTURO É AUTÔNOMO ───────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 py-20 relative overflow-hidden">
        <GlowBg />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.08) 0%, transparent 65%)' }} />
        <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <Reveal>
            <div className="flex justify-center lg:justify-start">
              <HolographicBrain />
            </div>
          </Reveal>

          <div>
            <Reveal>
              <p className="text-xs font-black tracking-widest mb-4" style={{ color: '#7C3AED' }}>A NOVA ERA</p>
              <h2 className="text-3xl md:text-4xl font-black leading-tight mb-6">
                <span className="text-white">O futuro das empresas</span><br />
                <span style={{ background: 'linear-gradient(90deg,#7C3AED,#00F5D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  é autônomo.
                </span>
              </h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 420 }}>
                O NEXUS não é uma ferramenta. É o sistema operacional da sua empresa — com IA que entende, decide, executa e aprende sozinha.
              </p>
            </Reveal>

            <div className="space-y-3">
              {AUTONOMOUS_BULLETS.map((b, i) => (
                <Reveal key={b.text} delay={i * 0.07}>
                  <div className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.01]"
                    style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                    <span className="text-lg shrink-0">{b.icon}</span>
                    <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>{b.text}</span>
                    <motion.div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#7C3AED' }}
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="features" className="px-6 lg:px-12 py-16 relative" style={{ background: 'rgba(255,255,255,0.012)' }}>
        <GridBackground />
        <div className="relative z-10 max-w-7xl mx-auto">
          <Reveal className="mb-3">
            <p className="text-xs font-black tracking-widest" style={{ color: '#7C3AED' }}>O QUE O NEXUS EXECUTA</p>
          </Reveal>
          <Reveal delay={0.05} className="mb-10">
            <h2 className="text-3xl font-black text-white">Módulos de IA para cada setor.</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.07}>
                <div
                  className="group p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] cursor-default h-full"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${f.color}40`
                    e.currentTarget.style.boxShadow = `0 0 32px ${f.color}12`
                    e.currentTarget.style.background = `${f.bg}`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  }}
                >
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: f.bg, boxShadow: `0 0 16px ${f.color}20` }}>
                    <f.icon size={18} style={{ color: f.color }} />
                  </div>
                  <h3 className="font-bold text-white mb-2 text-sm">{f.title}</h3>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.42)' }}>{f.desc}</p>
                  <a href="#" className="flex items-center gap-1 text-xs font-semibold transition-all" style={{ color: f.color }}>
                    Saiba mais <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTADOS EM TEMPO REAL ──────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 py-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at bottom, rgba(0,245,212,0.05) 0%, transparent 60%)' }} />
        <div className="relative z-10 max-w-7xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-black tracking-widest mb-3" style={{ color: '#00F5D4' }}>INTELIGÊNCIA OPERACIONAL</p>
            <h2 className="text-3xl font-black text-white">Números que provam o impacto.</h2>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Empresas ativas', num: 340, suffix: '+', color: '#7C3AED', spark: STATS[0].spark },
              { label: 'Receita recuperada', num: 2400000, display: 'R$ 2.4M+', color: '#7C3AED', spark: STATS[1].spark },
              { label: 'Tarefas pela IA /24h', num: 89431, suffix: '+', color: '#7C3AED', spark: STATS[2].spark },
              { label: 'Horas economizadas', num: 12843, suffix: 'h+', color: '#00F5D4', spark: STATS[3].spark },
              { label: 'Eficiência média', prefix: '+', num: 43, suffix: '%', color: '#00F5D4', spark: STATS[4].spark },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.07}>
                <div className="p-5 rounded-2xl text-center transition-all duration-300 hover:scale-[1.03]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.38)' }}>{s.label}</p>
                  <p className="font-black text-2xl mb-2 leading-none" style={{ color: s.color }}>
                    {s.display ?? (
                      <AnimatedNumber to={s.num} prefix={s.prefix ?? ''} suffix={s.suffix ?? ''} />
                    )}
                  </p>
                  <div className="flex justify-center">
                    <Sparkline data={s.spark} color={s.color} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE OPERATIONAL SYSTEM ──────────────────────────────────────────── */}
      <section id="demo" className="px-6 lg:px-12 py-20 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.012)' }}>
        <GridBackground />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(124,58,237,0.07) 0%, transparent 60%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <p className="text-xs font-black tracking-widest mb-3" style={{ color: '#7C3AED' }}>SISTEMA AO VIVO</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">A IA operando agora.</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto' }}>
              Em tempo real, o NEXUS está executando tarefas, gerando insights e operando empresas ao redor do Brasil.
            </p>
          </Reveal>

          <div className="grid lg:grid-cols-3 gap-6 items-start">
            {/* Left: Live feed */}
            <Reveal className="lg:col-span-2">
              <div className="rounded-2xl overflow-hidden"
                style={{ background: '#080B16', border: '1px solid rgba(124,58,237,0.2)', boxShadow: '0 0 60px rgba(124,58,237,0.08)' }}>
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.6), transparent)' }} />

                <div className="flex items-center justify-between px-5 py-3.5"
                  style={{ background: 'rgba(4,6,14,0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2">
                    <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400"
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                    <span className="text-xs font-black text-white/70 tracking-wider">FEED OPERACIONAL — AO VIVO</span>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(124,58,237,0.15)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.3)' }}>
                    {LIVE_FEED.length} eventos agora
                  </span>
                </div>

                <div className="p-5 space-y-3">
                  <AnimatePresence>
                    {LIVE_FEED.map((item, i) => (
                      <motion.div
                        key={`${liveFeedIdx}-${i}`}
                        className="flex items-center gap-4 p-4 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${item.color}18` }}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.09, duration: 0.4 }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ background: `${item.color}12`, border: `1px solid ${item.color}25` }}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold text-white truncate">{item.text}</span>
                          </div>
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.company}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1.5 justify-end">
                            <motion.span className="w-1.5 h-1.5 rounded-full"
                              style={{ background: item.color }}
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                            <span style={{ fontSize: '9px', color: item.color, fontWeight: 700 }}>{item.time}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.3), transparent)' }} />
              </div>
            </Reveal>

            {/* Right: Operational stats */}
            <Reveal delay={0.1}>
              <div className="space-y-4">
                {[
                  { label: 'Tarefas executadas agora', value: '2.431', unit: 'esta sessão', color: '#7C3AED', icon: Cpu },
                  { label: 'Receita gerada hoje', value: 'R$ 94.200', unit: 'em tempo real', color: '#22C55E', icon: TrendingUp },
                  { label: 'Clientes atendidos', value: '1.847', unit: 'nas últimas 2h', color: '#06B6D4', icon: Users },
                  { label: 'Automações rodando', value: '340', unit: 'empresas ativas', color: '#F59E0B', icon: Zap },
                ].map((item, i) => (
                  <Reveal key={item.label} delay={i * 0.08}>
                    <div className="p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${item.color}20` }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = `${item.color}45`)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = `${item.color}20`)}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}>
                          <item.icon size={16} style={{ color: item.color }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', marginBottom: 2 }}>{item.label}</p>
                          <p className="font-black text-xl text-white leading-none">{item.value}</p>
                          <p style={{ fontSize: '10px', color: item.color, marginTop: 2, fontWeight: 600 }}>{item.unit}</p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                ))}

                <Reveal delay={0.35}>
                  <button
                    onClick={() => setLoginOpen(true)}
                    className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', boxShadow: '0 0 28px rgba(124,58,237,0.4)' }}
                  >
                    <LogIn size={14} /> Começar agora
                  </button>
                </Reveal>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── TRUST & AUTHORITY ────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 py-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.04) 0%, transparent 60%)' }} />
        <div className="relative z-10 max-w-7xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-black tracking-widest mb-3" style={{ color: '#22C55E' }}>INFRAESTRUTURA DE NÍVEL ENTERPRISE</p>
            <h2 className="text-3xl font-black text-white">Construído para operar.<br />Projetado para confiar.</h2>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {TRUST_ITEMS.map((item, i) => (
              <Reveal key={item.label} delay={i * 0.08}>
                <div className="p-6 rounded-2xl text-center transition-all duration-300 hover:scale-[1.02]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${item.color}20` }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${item.color}45`
                    e.currentTarget.style.boxShadow = `0 0 30px ${item.color}10`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = `${item.color}20`
                    e.currentTarget.style.boxShadow = 'none'
                  }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${item.color}12`, border: `1px solid ${item.color}30`, boxShadow: `0 0 20px ${item.color}15` }}>
                    <item.icon size={22} style={{ color: item.color }} />
                  </div>
                  <h3 className="font-black text-white text-sm mb-1.5">{item.label}</h3>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* System status bar */}
          <Reveal>
            <div className="p-5 rounded-2xl"
              style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <motion.span className="w-2.5 h-2.5 rounded-full bg-green-400"
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }} />
                  <span className="text-sm font-black text-white">Todos os sistemas operacionais</span>
                </div>
                <div className="flex flex-wrap gap-6">
                  {[
                    { label: 'API', value: '99.98%' },
                    { label: 'IA Engine', value: '100%' },
                    { label: 'Automações', value: '99.95%' },
                    { label: 'Dados', value: '100%' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="text-[10px] font-black" style={{ color: '#22C55E' }}>{s.value}</p>
                      <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 py-24 relative overflow-hidden">
        <GlowBg />
        <GridBackground />
        <div className="absolute inset-4 rounded-3xl pointer-events-none"
          style={{ border: '1px solid rgba(124,58,237,0.15)', boxShadow: '0 0 80px rgba(124,58,237,0.06) inset' }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
              style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)' }}>
              <motion.span className="w-1.5 h-1.5 rounded-full bg-violet-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <span className="text-xs font-black tracking-widest" style={{ color: '#A78BFA' }}>PORTAL DE ACESSO</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6">
              <span className="text-white">Sua empresa merece um<br /></span>
              <span style={{ background: 'linear-gradient(90deg,#7C3AED,#A78BFA,#00F5D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                sistema operacional inteligente.
              </span>
            </h2>

            <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.48)', maxWidth: 480, margin: '0 auto 40px' }}>
              Junte-se a centenas de empresas que já operam com inteligência artificial executiva. Comece hoje.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                onClick={() => setLoginOpen(true)}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-black text-base transition-all"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', boxShadow: '0 0 40px rgba(124,58,237,0.5)' }}
                whileHover={{ scale: 1.04, boxShadow: '0 0 60px rgba(124,58,237,0.65)' }}
                whileTap={{ scale: 0.97 }}
              >
                <LogIn size={16} /> Acessar o NEXUS
              </motion.button>

              <motion.a
                href="#"
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.03)' }}
                whileHover={{ scale: 1.03, color: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.3)' }}
              >
                Agendar uma demo <ArrowRight size={15} />
              </motion.a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
              {[
                { icon: <Shield size={13} />, label: 'SSL & LGPD' },
                { icon: <Activity size={13} />, label: 'Uptime 99.98%' },
                { icon: <Cpu size={13} />, label: 'IA 24/7' },
                { icon: <Globe size={13} />, label: '+120 integrações' },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {b.icon}
                  <span style={{ fontSize: '11px' }}>{b.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="px-6 lg:px-12 py-14" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(3,4,10,0.97)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-6 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', boxShadow: '0 0 12px rgba(124,58,237,0.35)' }}>
                  <Brain size={15} color="#fff" />
                </div>
                <span className="font-black text-white text-lg">NEXUS</span>
              </div>
              <p className="text-xs leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.3)', maxWidth: 220 }}>
                O sistema operacional inteligente para empresas que querem operar no futuro.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400"
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.3, repeat: Infinity }} />
                  <span className="text-[10px] font-black" style={{ color: '#22C55E' }}>IA OPERANDO 24/7</span>
                </div>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Todos os sistemas funcionando</p>
              </div>
            </div>

            {[
              { title: 'Produto', links: ['Visão Geral', 'Módulos', 'Preços', 'Roadmap'] },
              { title: 'Soluções', links: ['Por Segmento', 'Agências', 'Saúde', 'E-commerce'] },
              { title: 'Plataforma', links: ['API', 'Integrações', 'Documentação', 'Status'] },
              { title: 'Empresa', links: ['Sobre', 'Segurança', 'Login', 'Suporte'] },
            ].map(col => (
              <div key={col.title}>
                <p className="text-xs font-black text-white/40 mb-4 uppercase tracking-wider">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l}>
                      <a href={l === 'Login' ? '#' : '#'}
                        onClick={l === 'Login' ? (e) => { e.preventDefault(); setLoginOpen(true) } : undefined}
                        className="text-xs text-white/22 hover:text-white/60 transition-colors">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 text-[11px]"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.18)' }}>
            <p>© 2026 NEXUS IA. Todos os direitos reservados.</p>
            <div className="flex gap-5">
              <a href="#" className="hover:text-white/40 transition-colors">Privacidade</a>
              <a href="#" className="hover:text-white/40 transition-colors">Termos</a>
              <span>🔒 SSL</span>
              <span>🇧🇷 LGPD</span>
              <span>Feito no Brasil</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
