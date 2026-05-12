'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  Brain, Zap, TrendingUp, Users, MessageSquare, BarChart3,
  ArrowRight, Check, Shield, Activity, Sparkles, Target,
  DollarSign, Clock, Rocket, X, CheckCircle2,
  Bot, Megaphone, Wallet, Settings, Layout, ShoppingCart,
  GitBranch, FileText, ChevronUp, Cpu, Globe, Layers,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WaitlistEntry { name: string; company: string; ago: string }

// ─── Static Data ──────────────────────────────────────────────────────────────

const NAV_LINKS = ['Produto', 'Solução', 'Como funciona', 'Casos', 'Empresa', 'Recursos']

const AI_ACTIVITIES = [
  { icon: '⚠️', text: 'Cobrança enviada para 23 clientes', time: 'há 1 min', color: '#F59E0B' },
  { icon: '✅', text: 'Campanha de reativação criada', time: 'há 2 min', color: '#22C55E' },
  { icon: '👤', text: 'Novo lead qualificado encontrado', time: 'há 5 min', color: '#6C5CE7' },
  { icon: '📊', text: 'Análise financeira concluída', time: 'há 7 min', color: '#3B82F6' },
  { icon: '⚠️', text: 'Alerta de fluxo de caixa gerado', time: 'há 9 min', color: '#F59E0B' },
]

const TICKER_CARDS = [
  { icon: '💬', color: '#22C55E', label: 'Cobrança enviada', value: 'R$ 4.820 recuperados', time: 'há 1 min' },
  { icon: '📣', color: '#7C3AED', label: 'Campanha criada', value: '12.430 pessoas alcançadas', time: 'há 2 min' },
  { icon: '👤', color: '#06B6D4', label: 'Novo cliente detectado', value: 'Lead qualificado automaticamente', time: 'há 3 min' },
  { icon: '📈', color: '#F59E0B', label: 'Oportunidade encontrada', value: 'R$ 18.400 identificados', time: 'há 4 min' },
]

const LOGOS = ['AGÊNCIA X', 'PRIME CO.', 'DOCTORS+', 'FIT CLUB', 'DELIVERY KING', 'SHOP TECH', 'CONTABILIZA+']

const STATS = [
  { label: 'Empresas na waitlist', value: '127+', sub: 'e crescendo rápido', spark: [20, 28, 22, 35, 30, 45, 38, 55, 50, 62, 58, 75, 70, 85, 80, 95], color: '#7C3AED', extra: true },
  { label: 'Dinheiro recuperado', value: 'R$ 2.4M+', sub: 'em cobranças automáticas', spark: [15, 22, 18, 30, 25, 38, 45, 40, 55, 50, 65, 60, 72, 80, 76, 90], color: '#7C3AED' },
  { label: 'Tarefas executadas', value: '89.431+', sub: 'pela IA nas últimas 24h', spark: [30, 25, 35, 30, 42, 38, 50, 45, 60, 55, 65, 62, 70, 75, 72, 85], color: '#7C3AED' },
  { label: 'Tempo economizado', value: '12.843h+', sub: 'de trabalho manual', spark: [10, 18, 14, 25, 20, 32, 28, 40, 35, 48, 44, 55, 50, 62, 58, 70], color: '#00F5D4' },
  { label: 'Aumento médio', value: '+43%', sub: 'de eficiência operacional', spark: [20, 15, 25, 20, 30, 28, 38, 34, 44, 40, 50, 46, 55, 52, 60, 68], color: '#00F5D4' },
]

const PAIN_POINTS = ['Processos manuais e lentos', 'Falta de visibilidade dos dados', 'Perda de vendas todos os dias', 'Equipes sobrecarregadas', 'Decisões baseadas em achismos', 'Ferramentas desconectadas']
const SOLUTIONS = ['IA executa tarefas críticas 24/7', 'Decisões com base em dados reais', 'Mais vendas, menos esforço', 'Equipes focadas no que importa', 'Previsões, análises e estratégias', 'Todo sistema conectado']

const FEATURES = [
  { icon: MessageSquare, color: '#22C55E', bg: 'rgba(34,197,94,0.1)', title: 'Atendimento e Cobrança', desc: 'Analisa fluxo de caixa, responde e cobra clientes automaticamente pelo WhatsApp.' },
  { icon: Megaphone, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', title: 'Marketing e Campanhas', desc: 'Cria campanhas, textos, copies e anúncios de forma autônoma.' },
  { icon: BarChart3, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', title: 'Análise Financeira', desc: 'Analisa fluxo de caixa, inadimplência, DRE e gera alertas inteligentes.' },
  { icon: Users, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', title: 'Vendas e Leads', desc: 'Qualifica leads, faz follow-up e aumenta conversão de vendas automaticamente.' },
  { icon: Bot, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', title: 'Agentes IA', desc: 'Agentes especializados executam operações complexas por você.' },
  { icon: Zap, color: '#EAB308', bg: 'rgba(234,179,8,0.1)', title: 'Automações', desc: 'Automatiza processos repetitivos e integra todos os setores.' },
]

const WAITLIST_FEED: WaitlistEntry[] = [
  { name: 'Agência Growth', company: 'Marketing', ago: 'há 1 minuto' },
  { name: 'Clínica Vitalis', company: 'Saúde', ago: 'há 2 minutos' },
  { name: 'Loja Tech Plus', company: 'E-commerce', ago: 'há 3 minutos' },
  { name: 'Consult Contábil', company: 'Contabilidade', ago: 'há 3 minutos' },
  { name: 'Delivery Fast', company: 'Logística', ago: 'há 4 minutos' },
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
      {/* Glow bar top */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.6), rgba(0,245,212,0.3), transparent)' }} />

      {/* Title Bar */}
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

      {/* Body */}
      <div className="flex" style={{ height: 420 }}>
        {/* Sidebar */}
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

        {/* Main */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
          <div className="flex items-center justify-between shrink-0">
            <p className="text-xs font-bold text-white/70">Centro Operacional</p>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }}>SISTEMA ONLINE</span>
          </div>

          {/* 4 KPI Cards */}
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

          {/* Bottom: Chart + Activity */}
          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
            {/* Chart */}
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

            {/* Activity Feed */}
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

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2"
        style={{ background: 'rgba(4,6,14,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)' }}>NEXUS IA está operando sua empresa agora</span>
        </div>
        <span className="font-black" style={{ fontSize: '9px', color: '#22C55E', letterSpacing: '0.05em' }}>100% ONLINE</span>
      </div>

      {/* Glow bar bottom */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.3), rgba(124,58,237,0.5), transparent)' }} />
    </div>
  )
}

// ─── Holographic Brain (Autonomous Section) ───────────────────────────────────

function HolographicBrain() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 360, height: 360 }}>
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', filter: 'blur(30px)' }} />

      {/* Orbit ring 1 */}
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

      {/* Orbit ring 2 */}
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

      {/* Center brain */}
      <div className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(91,33,182,0.5))', border: '1px solid rgba(124,58,237,0.5)', boxShadow: '0 0 40px rgba(124,58,237,0.4), 0 0 80px rgba(124,58,237,0.15)' }}>
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
          <Brain size={40} color="#A78BFA" />
        </motion.div>
      </div>

      {/* Pulsing rings */}
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

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [count, setCount] = useState(127)
  const [feedIdx, setFeedIdx] = useState(0)

  useEffect(() => {
    const t1 = setInterval(() => setCount(v => v + (Math.random() > 0.75 ? 1 : 0)), 5000)
    const t2 = setInterval(() => setFeedIdx(i => (i + 1) % WAITLIST_FEED.length), 3500)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !name) return
    setSubmitting(true)
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company }),
      })
    } catch { /* silent */ }
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <div style={{ background: '#05070E', color: '#EAEAF0', minHeight: '100vh', overflowX: 'hidden' }}>

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
          <Link href="/login" className="text-sm text-white/45 hover:text-white/80 transition-colors px-3 py-2 rounded-lg hidden md:block"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            Entrar
          </Link>
          <a href="#waitlist"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:scale-105 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}>
            Entrar na lista de espera <ArrowRight size={14} />
          </a>
        </div>
      </motion.nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-8 px-6 lg:px-12 overflow-hidden">
        <GridBackground />
        <GlowBg />
        <Particles />

        {/* Animated gradient sweep */}
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.04) 0%, transparent 50%, rgba(0,245,212,0.03) 100%)' }}
          animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />

        <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          {/* Left */}
          <div>
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)' }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
            >
              <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: '#7C3AED' }}
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <span className="text-xs font-black tracking-widest" style={{ color: '#A78BFA' }}>BETA LIMITADO</span>
            </motion.div>

            <motion.h1
              className="text-4xl md:text-5xl font-black leading-[1.05] mb-5"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}
            >
              <span className="text-white">O primeiro sistema<br />operacional empresarial<br />com </span>
              <span style={{ background: 'linear-gradient(90deg,#7C3AED,#A78BFA,#00F5D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% 100%' }}>
                IA executiva.
              </span>
            </motion.h1>

            <motion.p
              className="text-base leading-relaxed mb-8"
              style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 440 }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            >
              O NEXUS entende, decide e executa operações críticas da sua empresa em tempo real. Mais vendas, menos trabalho manual, mais resultados.
            </motion.p>

            <motion.div
              className="flex flex-wrap items-center gap-3 mb-8"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}
            >
              <a href="#waitlist"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', boxShadow: '0 0 32px rgba(124,58,237,0.5), 0 4px 24px rgba(0,0,0,0.3)' }}>
                Entrar na lista de espera <ArrowRight size={15} />
              </a>
              <a href="#features"
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
                <span className="text-white font-semibold">+{count} empresas</span> já garantiram acesso antecipado
              </span>
            </motion.div>

            <motion.div className="flex flex-wrap gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
              {[
                { icon: '🤖', label: 'IA 24/7 Operando' },
                { icon: '🔒', label: 'Dados 100% Seguros' },
                { icon: '⚡', label: 'Setup em Minutos' },
                { icon: '💳', label: 'Sem cartão de crédito' },
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
            {/* Dashboard glow aura */}
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all"
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
          EMPRESAS QUE ACREDITAM NO FUTURO
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
                  {s.extra && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex -space-x-1.5">
                        {['#7C3AED', '#06B6D4', '#22C55E'].map((c, idx) => (
                          <div key={idx} className="w-5 h-5 rounded-full border-2 text-[8px] font-bold text-white flex items-center justify-center"
                            style={{ background: c, borderColor: '#05070E' }}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>+12 hoje</span>
                    </div>
                  )}
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
          {/* Left: Holographic brain */}
          <Reveal>
            <div className="flex justify-center lg:justify-start">
              <HolographicBrain />
            </div>
          </Reveal>

          {/* Right: content */}
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
                O NEXUS não é mais uma ferramenta. É o sistema operacional da sua empresa — com IA que entende, decide, executa e aprende sozinha.
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
            <p className="text-xs font-black tracking-widest" style={{ color: '#7C3AED' }}>O QUE O NEXUS EXECUTA NA SUA EMPRESA</p>
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
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300"
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
            <p className="text-xs font-black tracking-widest mb-3" style={{ color: '#00F5D4' }}>RESULTADOS REAIS EM TEMPO REAL</p>
            <h2 className="text-3xl font-black text-white">Números que provam o impacto.</h2>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Empresas na waitlist', num: 127, suffix: '+', color: '#7C3AED', spark: STATS[0].spark },
              { label: 'Receita recuperada', prefix: 'R$ ', num: 2400000, suffix: '+', display: 'R$ 2.4M+', color: '#7C3AED', spark: STATS[1].spark },
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

      {/* ── WAITLIST ─────────────────────────────────────────────────────────── */}
      <section id="waitlist" className="px-6 lg:px-12 py-20 relative overflow-hidden">
        <GlowBg />
        <GridBackground />

        {/* Neon border glow */}
        <div className="absolute inset-4 rounded-3xl pointer-events-none" style={{ border: '1px solid rgba(124,58,237,0.2)', boxShadow: '0 0 60px rgba(124,58,237,0.08) inset' }} />

        <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-3 gap-10 items-start">
          {/* Left copy */}
          <Reveal>
            <div>
              <motion.div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
                animate={{ boxShadow: ['0 0 12px rgba(239,68,68,0.2)', '0 0 24px rgba(239,68,68,0.35)', '0 0 12px rgba(239,68,68,0.2)'] } as any}
                transition={{ duration: 2, repeat: Infinity }}>
                <motion.span className="w-1.5 h-1.5 rounded-full bg-red-400"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                <span className="text-xs font-black tracking-widest" style={{ color: '#F87171' }}>VAGAS LIMITADAS</span>
              </motion.div>

              <h2 className="text-3xl font-black leading-tight mb-4 text-white">
                Junte-se ao grupo seleto que está{' '}
                <span style={{ background: 'linear-gradient(90deg,#7C3AED,#00F5D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  construindo o futuro.
                </span>
              </h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
                O beta é limitado. Garanta seu acesso antecipado antes que as vagas acabem.
              </p>

              {/* FOMO counter */}
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <motion.span className="w-2 h-2 rounded-full bg-violet-400"
                    animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                  <span className="text-xs font-black text-violet-300 tracking-wider">AO VIVO AGORA</span>
                </div>
                <p className="text-2xl font-black text-white mb-0.5">{count} <span className="text-sm font-normal text-white/50">empresas na fila</span></p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>+12 entraram nas últimas 2 horas</p>
              </div>
            </div>
          </Reveal>

          {/* Center form */}
          <Reveal delay={0.1}>
            <div className="p-6 rounded-2xl relative"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(124,58,237,0.3)' }}>
              {/* Neon top line */}
              <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.8), transparent)' }} />

              <p className="font-black text-white text-sm mb-5">Garanta seu acesso antecipado ao NEXUS.</p>

              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8">
                    <div className="text-5xl mb-4">🎉</div>
                    <p className="font-black text-white text-lg mb-1">Você está na lista!</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Enviaremos seu acesso em breve.</p>
                  </motion.div>
                ) : (
                  <motion.form key="form" onSubmit={handleSubmit} className="space-y-3" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {[
                      { ph: 'Seu nome', val: name, set: setName, type: 'text', req: true },
                      { ph: 'Seu e-mail', val: email, set: setEmail, type: 'email', req: true },
                      { ph: 'Nome da sua empresa', val: company, set: setCompany, type: 'text', req: false },
                    ].map(field => (
                      <input key={field.ph} type={field.type} placeholder={field.ph} value={field.val}
                        onChange={e => field.set(e.target.value)} required={field.req}
                        className="w-full px-3.5 py-3 rounded-xl text-sm text-white outline-none transition-all"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.5)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                      />
                    ))}
                    <motion.button type="submit" disabled={submitting}
                      className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
                      style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', boxShadow: '0 0 28px rgba(124,58,237,0.45)' }}
                      whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(124,58,237,0.6)' }}
                      whileTap={{ scale: 0.98 }}>
                      {submitting ? (
                        <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
                      ) : (
                        <>Quero garantir meu acesso <ArrowRight size={14} /></>
                      )}
                    </motion.button>
                    <div className="flex items-center justify-center gap-4 text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      <span>✓ Sem spam</span>
                      <span>✓ Sem cartão de crédito</span>
                      <span>✓ Cancelamento fácil</span>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>

          {/* Right live feed */}
          <Reveal delay={0.2}>
            <div className="p-5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-4">
                <motion.span className="w-1.5 h-1.5 rounded-full bg-red-400"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                <span className="text-[10px] font-black tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>ENTRADAS EM TEMPO REAL</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {WAITLIST_FEED.map((entry, i) => (
                    <motion.div key={`${feedIdx}-${i}`}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                      initial={{ opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.35 }}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                        style={{ background: `hsl(${i * 65},60%,42%)`, boxShadow: `0 0 10px hsl(${i * 65},60%,42%)40` }}>
                        {entry.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{entry.name}</p>
                        <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          entrou na waitlist {entry.ago}
                        </p>
                      </div>
                      <CheckCircle2 size={12} color="#22C55E" className="shrink-0" />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Bottom FOMO bar */}
              <div className="mt-4 p-3 rounded-xl text-center" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <p className="text-xs font-black" style={{ color: '#22C55E' }}>🔥 Alta demanda hoje</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Não perca sua vaga no beta</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="px-6 lg:px-12 py-12" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(3,4,10,0.95)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-5 gap-10 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', boxShadow: '0 0 12px rgba(124,58,237,0.35)' }}>
                  <Brain size={15} color="#fff" />
                </div>
                <span className="font-black text-white">NEXUS</span>
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.3)', maxWidth: 220 }}>
                O primeiro sistema operacional empresarial com IA executiva.
              </p>
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.3, repeat: Infinity }} />
                <span className="text-[10px] font-black" style={{ color: '#22C55E' }}>NEXUS IA OPERANDO 24/7</span>
              </div>
              <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>Todos os sistemas funcionando perfeitamente</p>
            </div>

            {[
              { title: 'Produto', links: ['Recursos', 'Preços', 'Integrações'] },
              { title: 'Solução', links: ['Por Segmento', 'Casos de Uso', 'Benefícios'] },
              { title: 'Empresa', links: ['Sobre nós', 'Carreiras', 'Contato'] },
              { title: 'Legal', links: ['Privacidade', 'Termos', 'Segurança'] },
            ].map(col => (
              <div key={col.title}>
                <p className="text-xs font-black text-white/40 mb-3 uppercase tracking-wider">{col.title}</p>
                <ul className="space-y-2">
                  {col.links.map(l => (
                    <li key={l}><a href="#" className="text-xs text-white/22 hover:text-white/55 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 text-[11px]"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.18)' }}>
            <p>© 2026 NEXUS IA. Todos os direitos reservados.</p>
            <div className="flex gap-4">
              <span>🔒 SSL Secured</span>
              <span>🇧🇷 LGPD Compliant</span>
              <span>Feito no Brasil</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
