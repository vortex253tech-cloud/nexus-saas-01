'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  Zap, Users, AlertCircle, Plus, Play, Pause, Trash2,
  BarChart3, TrendingUp, CheckCircle2, Loader2, Sparkles,
  ArrowRight, Mail, Clock, Search, ChevronRight,
  Settings, Eye, Target, Activity, X, Lock, Crown,
  Brain, Bot, Workflow, Shield,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Automation {
  id:             string
  name:           string
  description:    string
  trigger_type:   'manual' | 'new_client' | 'client_overdue'
  status:         'active' | 'inactive' | 'draft'
  created_at:     string
  step_count:     number
  enrolled_count: number
}

interface Template {
  id:           string
  name:         string
  description:  string
  trigger_type: 'manual' | 'new_client' | 'client_overdue'
  badge:        string
  badgeColor:   string
  gradient:     string
  glowColor:    string
  accent:       string
  metrics:      { abertura: number; conversao: number; receita: string; roi: number }
  stepsData:    Array<{ subject: string; body_html: string; delay_days: number }>
}

// ─── Template Definitions ─────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    id: 'overdue',
    name: 'Recuperação de Inadimplentes',
    description: 'Sequência automática para clientes com cobranças em atraso. Combina urgência com empatia para maximizar recuperação.',
    trigger_type: 'client_overdue',
    badge: '🔥 Mais Popular',
    badgeColor: '#f59e0b',
    gradient: 'linear-gradient(135deg, rgba(234,88,12,0.18) 0%, rgba(220,38,38,0.08) 60%, transparent 100%)',
    glowColor: 'rgba(249,115,22,0.28)',
    accent: '#f97316',
    metrics: { abertura: 78, conversao: 34, receita: 'R$12.400', roi: 340 },
    stepsData: [
      { subject: 'Atenção: Cobrança pendente - {nome}', body_html: 'Olá {nome},\n\nIdentificamos uma cobrança em aberto em seu nome. Para evitar a suspensão dos serviços, regularize sua situação o quanto antes.\n\nAtenciosamente,\n{empresa}', delay_days: 0 },
      { subject: 'Aviso: Regularize sua situação, {nome}', body_html: 'Olá {nome},\n\nAinda não identificamos o pagamento da sua cobrança em aberto. Temos opções de parcelamento disponíveis.\n\nAtenciosamente,\n{empresa}', delay_days: 3 },
      { subject: 'Proposta especial de regularização', body_html: 'Olá {nome},\n\nQueremos ajudar você a regularizar sua situação. Temos condições especiais com parcelamento facilitado.\n\nAtenciosamente,\n{empresa}', delay_days: 7 },
      { subject: 'Última chance — Condições especiais', body_html: 'Olá {nome},\n\nEsta é nossa última tentativa. Temos condições especiais por tempo limitado.\n\nAtenciosamente,\n{empresa}', delay_days: 14 },
    ],
  },
  {
    id: 'welcome',
    name: 'Onboarding de Novo Cliente',
    description: 'Sequência de boas-vindas e ativação. Aumenta engajamento e reduz churn desde o primeiro contato.',
    trigger_type: 'new_client',
    badge: '⭐ Alta Conversão',
    badgeColor: '#10b981',
    gradient: 'linear-gradient(135deg, rgba(5,150,105,0.18) 0%, rgba(20,184,166,0.08) 60%, transparent 100%)',
    glowColor: 'rgba(16,185,129,0.28)',
    accent: '#10b981',
    metrics: { abertura: 92, conversao: 61, receita: 'R$8.200', roi: 280 },
    stepsData: [
      { subject: 'Bem-vindo(a), {nome}! 🎉', body_html: 'Olá {nome},\n\nSeja muito bem-vindo(a) à {empresa}!\n\nEquipe {empresa}', delay_days: 0 },
      { subject: 'Como está sendo sua experiência, {nome}?', body_html: 'Olá {nome},\n\nJá faz alguns dias desde que você se juntou a nós. Tudo bem?\n\nEquipe {empresa}', delay_days: 3 },
      { subject: 'Dicas exclusivas para você, {nome}', body_html: 'Olá {nome},\n\nQueremos garantir que você aproveite todos os benefícios.\n\nEquipe {empresa}', delay_days: 7 },
    ],
  },
  {
    id: 'reactivation',
    name: 'Reativação de Clientes Inativos',
    description: 'Reconquiste clientes que não interagem há mais de 30 dias. Estratégia comprovada com taxa de retorno de 28%.',
    trigger_type: 'manual',
    badge: '💎 ROI +280%',
    badgeColor: '#8b5cf6',
    gradient: 'linear-gradient(135deg, rgba(109,40,217,0.18) 0%, rgba(139,92,246,0.08) 60%, transparent 100%)',
    glowColor: 'rgba(139,92,246,0.28)',
    accent: '#8b5cf6',
    metrics: { abertura: 65, conversao: 28, receita: 'R$6.800', roi: 220 },
    stepsData: [
      { subject: 'Sentimos sua falta, {nome}!', body_html: 'Olá {nome},\n\nFaz um tempo que não nos falamos. Sentimos sua falta!\n\nEquipe {empresa}', delay_days: 0 },
      { subject: 'Uma oferta especial só para você', body_html: 'Olá {nome},\n\nPreparamos uma oferta exclusiva de retorno para você.\n\nEquipe {empresa}', delay_days: 5 },
      { subject: 'Última chance: Oferta expira hoje', body_html: 'Olá {nome},\n\nHoje é o último dia. Esperamos reencontrá-lo(a) em breve!\n\nEquipe {empresa}', delay_days: 10 },
    ],
  },
  {
    id: 'nurturing',
    name: 'Nurturing de Leads',
    description: 'Eduque e aqueça leads ao longo do funil de vendas. Aumenta a probabilidade de conversão em até 4×.',
    trigger_type: 'manual',
    badge: '🤖 IA Powered',
    badgeColor: '#06b6d4',
    gradient: 'linear-gradient(135deg, rgba(8,145,178,0.18) 0%, rgba(59,130,246,0.08) 60%, transparent 100%)',
    glowColor: 'rgba(6,182,212,0.28)',
    accent: '#06b6d4',
    metrics: { abertura: 71, conversao: 42, receita: 'R$15.600', roi: 420 },
    stepsData: [
      { subject: 'Olá {nome} — obrigado pelo interesse!', body_html: 'Olá {nome},\n\nMuito obrigado pelo interesse! Nos próximos dias enviaremos conteúdo exclusivo.\n\nEquipe {empresa}', delay_days: 0 },
      { subject: 'Guia exclusivo: Como maximizar resultados', body_html: 'Olá {nome},\n\nComo prometido, segue nosso guia exclusivo.\n\nEquipe {empresa}', delay_days: 3 },
      { subject: 'Case de sucesso: Resultados reais', body_html: 'Olá {nome},\n\nConheça como nossos clientes obtêm resultados incríveis.\n\nEquipe {empresa}', delay_days: 7 },
      { subject: '{nome}, posso tirar suas dúvidas?', body_html: 'Olá {nome},\n\nGostaríamos de saber se ficou alguma dúvida. Estou disponível.\n\nEquipe {empresa}', delay_days: 14 },
      { subject: 'Proposta personalizada para {nome}', body_html: 'Olá {nome},\n\nPreparamos uma proposta personalizada para suas necessidades.\n\nEquipe {empresa}', delay_days: 21 },
    ],
  },
]

const AI_STEPS = [
  'Analisando objetivo da automação',
  'Criando sequência de mensagens',
  'Definindo gatilhos e timing',
  'Otimizando para conversão',
  'Configurando no sistema',
]

// ─── Shared metadata ──────────────────────────────────────────────────────────

const TRIGGER_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  manual:         { label: 'Manual',       icon: Zap,         color: '#8b5cf6' },
  new_client:     { label: 'Novo cliente', icon: Users,       color: '#10b981' },
  client_overdue: { label: 'Inadimplente', icon: AlertCircle, color: '#f97316' },
}

function TriggerBadge({ type }: { type: string }) {
  const meta = TRIGGER_META[type] ?? TRIGGER_META.manual
  const Icon = meta.icon
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: meta.color, background: `${meta.color}16`, border: `1px solid ${meta.color}28` }}
    >
      <Icon size={8} />
      {meta.label}
    </span>
  )
}

// ─── Animated number ──────────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  suffix = '',
  prefix = '',
  inView,
  duration = 1100,
}: {
  value: number
  suffix?: string
  prefix?: string
  inView: boolean
  duration?: number
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    let startTime: number | null = null
    let rafId: number

    function step(ts: number) {
      if (startTime === null) startTime = ts
      const p = Math.min((ts - startTime) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setDisplay(Math.round(e * value))
      if (p < 1) rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [inView, value, duration])

  return <>{prefix}{display}{suffix}</>
}

// ─── Flow timeline ────────────────────────────────────────────────────────────

function FlowTimeline({ count, accent, inView }: { count: number; accent: string; inView: boolean }) {
  return (
    <div>
      {/* Nodes + connectors */}
      <div className="flex items-center">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center" style={{ flex: i < count - 1 ? '1' : 'none' }}>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 450, damping: 22 }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${accent}18`, border: `1px solid ${accent}38` }}
            >
              <Mail size={10} style={{ color: accent }} />
            </motion.div>
            {i < count - 1 && (
              <motion.div
                className="flex-1 h-px mx-1"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={inView ? { scaleX: 1, opacity: 1 } : {}}
                transition={{ delay: 0.18 + i * 0.1, duration: 0.28, ease: 'easeOut' }}
                style={{
                  transformOrigin: 'left',
                  background: `linear-gradient(90deg, ${accent}38, ${accent}10)`,
                }}
              />
            )}
          </div>
        ))}
      </div>
      {/* Time labels */}
      <div className="flex items-start mt-1.5">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex" style={{ flex: i < count - 1 ? '1' : 'none' }}>
            <motion.span
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.22 + i * 0.1 }}
              className="text-[8px] whitespace-nowrap"
              style={{ color: `${accent}60` }}
            >
              {i === 0 ? 'Agora' : ['+3d', '+7d', '+14d', '+21d'][i - 1]}
            </motion.span>
            {i < count - 1 && <div className="flex-1" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Template Preview Modal ───────────────────────────────────────────────────

function TemplatePreviewModal({
  template,
  onClose,
  onGenerate,
}: {
  template: Template
  onClose: () => void
  onGenerate: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inView = useInView(containerRef, { once: true, amount: 0.05 })

  function delayLabel(days: number) {
    if (days === 0) return 'Imediatamente'
    return `+${days} dia${days !== 1 ? 's' : ''}`
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(24px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        ref={containerRef}
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '80%', opacity: 0 }}
        transition={{ duration: 0.44, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-lg flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          maxHeight: '92vh',
          background: '#0d0d14',
          border: `1px solid ${template.accent}28`,
          boxShadow: `0 0 80px ${template.glowColor}, 0 32px 64px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Gradient fill */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: template.gradient, opacity: 0.6 }}
        />
        {/* Top accent line */}
        <div
          className="h-px w-full shrink-0 relative"
          style={{ background: `linear-gradient(90deg, transparent 5%, ${template.accent}80 50%, transparent 95%)` }}
        />

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-0.5 shrink-0 relative">
          <div className="h-1 w-10 rounded-full bg-white/10" />
        </div>

        {/* Scrollable body */}
        <div className="relative overflow-y-auto flex-1 pb-32">

          {/* ── Header ── */}
          <div className="px-5 pt-3 pb-4">
            <div className="flex items-start justify-between mb-3">
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                style={{ color: template.badgeColor, background: `${template.badgeColor}14`, border: `1px solid ${template.badgeColor}25` }}
              >
                {template.badge}
              </span>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all -mt-0.5 -mr-0.5"
              >
                <X size={14} />
              </button>
            </div>
            <h2 className="text-[20px] font-bold leading-tight text-white/95 mb-2">{template.name}</h2>
            <p className="text-[13px] text-white/38 leading-relaxed mb-3">{template.description}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <TriggerBadge type={template.trigger_type} />
              <span className="text-[10px] text-white/20">·</span>
              <span className="text-[10px] text-white/25 flex items-center gap-1">
                <Mail size={9} /> {template.stepsData.length} emails
              </span>
              <span className="text-[10px] text-white/20">·</span>
              <span className="text-[10px] text-white/25 flex items-center gap-1">
                <Clock size={9} /> Ativa em 60 seg
              </span>
            </div>
          </div>

          {/* ── Metrics ── */}
          <div className="px-5 mb-5">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Abertura',  value: `${template.metrics.abertura}%`,  icon: Eye       },
                { label: 'Conversão', value: `${template.metrics.conversao}%`, icon: Target    },
                { label: 'ROI',       value: `+${template.metrics.roi}%`,      icon: TrendingUp },
                { label: 'Receita',   value: template.metrics.receita,         icon: BarChart3  },
              ].map((m, mi) => {
                const Icon = m.icon
                return (
                  <motion.div
                    key={m.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.06 + mi * 0.06, duration: 0.32 }}
                    className="rounded-xl border border-white/[0.055] bg-white/[0.025] p-2.5 text-center"
                  >
                    <Icon size={10} className="mx-auto mb-1.5" style={{ color: template.accent }} />
                    <p className="text-[12px] font-bold tabular-nums leading-none" style={{ color: template.accent }}>{m.value}</p>
                    <p className="text-[9px] text-white/20 mt-1">{m.label}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* ── Flow diagram ── */}
          <div className="px-5 mb-5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-white/20 mb-3">Sequência de disparo</p>
            <FlowTimeline count={template.stepsData.length} accent={template.accent} inView={inView} />
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-white/[0.05] mb-5" />

          {/* ── Email previews ── */}
          <div className="px-5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-white/20 mb-3">Prévia das mensagens</p>
            <div className="space-y-3">
              {template.stepsData.map((step, si) => {
                const bodyLines = step.body_html.split('\n').map(l => l.trim()).filter(l => l.length > 0)
                const previewLines = bodyLines.slice(0, 5)
                const hasMore = bodyLines.length > 5

                return (
                  <motion.div
                    key={si}
                    initial={{ opacity: 0, y: 10 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.18 + si * 0.09, duration: 0.35 }}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.016)',
                      border: '1px solid rgba(255,255,255,0.058)',
                    }}
                  >
                    {/* Email client header */}
                    <div
                      className="px-4 py-3 border-b border-white/[0.04]"
                      style={{ background: 'rgba(255,255,255,0.01)' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                            style={{ background: template.accent }}
                          >
                            {si + 1}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-white/60">Email {si + 1}</p>
                          </div>
                        </div>
                        <span
                          className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color: template.accent,
                            background: `${template.accent}14`,
                            border: `1px solid ${template.accent}25`,
                          }}
                        >
                          {delayLabel(step.delay_days)}
                        </span>
                      </div>
                      <div className="space-y-0.5 pl-8.5">
                        <p className="text-[10px] text-white/25">
                          <span className="text-white/15">De:</span> {'{empresa}'} {'<no-reply@empresa.com>'}
                        </p>
                        <p className="text-[10px] text-white/25">
                          <span className="text-white/15">Para:</span> {'{nome}'}
                        </p>
                      </div>
                    </div>
                    {/* Email body */}
                    <div className="px-4 py-3">
                      <p className="text-[12px] font-semibold text-white/75 mb-2.5 leading-snug">{step.subject}</p>
                      <div className="space-y-1">
                        {previewLines.map((line, li) => (
                          <p key={li} className="text-[11px] text-white/30 leading-relaxed">{line}</p>
                        ))}
                        {hasMore && (
                          <p className="text-[10px] text-white/14 italic mt-1">... continua</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Fixed CTA ── */}
        <div
          className="absolute bottom-0 left-0 right-0 px-5 pt-6 pb-5 shrink-0"
          style={{
            background: 'linear-gradient(to top, #0d0d14 65%, rgba(13,13,20,0.92) 85%, transparent)',
          }}
        >
          <button
            onClick={onGenerate}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 text-[13px] font-bold text-white transition-all duration-200 active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${template.accent}, ${template.accent}cc)`,
              boxShadow: `0 8px 32px ${template.glowColor}, 0 2px 12px rgba(0,0,0,0.5)`,
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles size={15} />
            </motion.div>
            Criar esta automação com IA
            <ArrowRight size={14} />
          </button>
          <p className="text-center text-[10px] text-white/18 mt-2">
            Pronto em segundos · Sem código necessário
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onPreview }: { template: Template; onPreview: (t: Template) => void }) {
  const [hovered, setHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const inView  = useInView(cardRef, { once: true, amount: 0.25 })

  const TriggerIcon = TRIGGER_META[template.trigger_type]?.icon  ?? Zap
  const firstStep   = template.stepsData[0]
  // Get first real body line for preview
  const bodyPreview = firstStep.body_html
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 5) ?? ''

  const metricItems = [
    { label: 'Abertura',  value: template.metrics.abertura,  suffix: '%', prefix: '',  icon: Eye       },
    { label: 'Conversão', value: template.metrics.conversao, suffix: '%', prefix: '',  icon: Target    },
    { label: 'ROI',       value: template.metrics.roi,       suffix: '%', prefix: '+', icon: BarChart3 },
    { label: 'Emails',    value: template.stepsData.length,  suffix: '',  prefix: '',  icon: Mail      },
  ]

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: hovered ? 'rgba(255,255,255,0.028)' : 'rgba(255,255,255,0.018)',
        border: `1px solid ${hovered ? template.accent + '48' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered
          ? `0 0 70px ${template.glowColor}, 0 24px 64px rgba(0,0,0,0.55)`
          : '0 4px 28px rgba(0,0,0,0.22)',
        transition: 'background 0.35s, border-color 0.35s, box-shadow 0.55s, transform 0.2s',
      }}
    >
      {/* Gradient fill */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: template.gradient, opacity: hovered ? 1 : 0.55, transition: 'opacity 0.4s' }}
      />

      {/* Top shimmer line */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        animate={{ opacity: hovered ? 1 : 0.35 }}
        transition={{ duration: 0.3 }}
        style={{ background: `linear-gradient(90deg, transparent 5%, ${template.accent}55 50%, transparent 95%)` }}
      />

      {/* Hover shimmer sweep */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ x: '-110%' }}
        animate={hovered ? { x: '160%' } : { x: '-110%' }}
        transition={{ duration: 1.0, ease: 'easeInOut' }}
        style={{ background: `linear-gradient(90deg, transparent 20%, ${template.accent}14 50%, transparent 80%)` }}
      />

      <div className="relative p-5 space-y-4">

        {/* ── Row 1: badge + live indicator ── */}
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
            style={{ color: template.badgeColor, background: `${template.badgeColor}14`, border: `1px solid ${template.badgeColor}25` }}
          >
            {template.badge}
          </span>
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-[9px] font-bold text-emerald-400/70 uppercase tracking-wider">IA ativa</span>
          </div>
        </div>

        {/* ── Row 2: trigger + title + description ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-lg"
              style={{ background: `${template.accent}14`, border: `1px solid ${template.accent}25` }}
            >
              <TriggerIcon size={12} style={{ color: template.accent }} />
            </div>
            <TriggerBadge type={template.trigger_type} />
          </div>
          <h3 className="text-[16px] font-semibold leading-snug text-white/90 mb-1.5">{template.name}</h3>
          <p className="text-xs text-white/35 leading-relaxed line-clamp-2">{template.description}</p>
        </div>

        {/* ── Row 3: animated flow timeline ── */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-white/20 mb-2.5">Sequência de disparo</p>
          <FlowTimeline
            count={Math.min(template.stepsData.length, 5)}
            accent={template.accent}
            inView={inView}
          />
        </div>

        {/* ── Row 4: first message preview ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="h-4 w-4 rounded-md flex items-center justify-center shrink-0"
              style={{ background: `${template.accent}18` }}
            >
              <Mail size={9} style={{ color: template.accent }} />
            </div>
            <span className="text-[11px] font-medium text-white/55 truncate">{firstStep.subject}</span>
          </div>
          <p className="text-[10px] text-white/22 truncate pl-6">{bodyPreview}</p>
        </motion.div>

        {/* ── Row 5: animated metrics grid ── */}
        <div className="grid grid-cols-4 gap-1.5">
          {metricItems.map((m, mi) => {
            const Icon = m.icon
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.35 + mi * 0.07, duration: 0.3 }}
                className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-2 text-center"
              >
                <Icon size={9} className="mx-auto mb-1 text-white/20" />
                <p className="text-[13px] font-bold leading-none tabular-nums" style={{ color: template.accent }}>
                  <AnimatedNumber
                    value={m.value}
                    suffix={m.suffix}
                    prefix={m.prefix}
                    inView={inView}
                    duration={900 + mi * 120}
                  />
                </p>
                <p className="text-[9px] text-white/18 mt-1">{m.label}</p>
              </motion.div>
            )
          })}
        </div>

        {/* ── Row 6: expected results strip ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.65 }}
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ background: `${template.accent}07`, border: `1px solid ${template.accent}18` }}
        >
          <div className="flex items-center gap-1.5">
            <Clock size={9} style={{ color: template.accent }} />
            <span className="text-[10px] text-white/35">
              Ativa em <span className="font-semibold" style={{ color: template.accent }}>60 seg</span>
            </span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <TrendingUp size={9} style={{ color: template.accent }} />
            <span className="text-[10px] text-white/35">
              Receita: <span className="font-semibold" style={{ color: template.accent }}>{template.metrics.receita}</span>
            </span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={9} style={{ color: template.accent }} />
            <span className="text-[10px] text-white/35">
              Dif: <span className="font-semibold" style={{ color: template.accent }}>Fácil</span>
            </span>
          </div>
        </motion.div>

        {/* ── Row 7: CTA ── */}
        <button
          onClick={() => onPreview(template)}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-250"
          style={{
            background: hovered
              ? `linear-gradient(135deg, ${template.accent}, ${template.accent}cc)`
              : `${template.accent}16`,
            border: `1px solid ${template.accent}${hovered ? '75' : '28'}`,
            color: hovered ? '#fff' : template.accent,
            boxShadow: hovered ? `0 6px 24px ${template.glowColor}` : 'none',
          }}
        >
          <Sparkles size={14} />
          Criar automação com IA
          <ChevronRight size={13} className={cn('transition-transform', hovered && 'translate-x-0.5')} />
        </button>

      </div>
    </motion.div>
  )
}

// ─── AI Generation Modal ──────────────────────────────────────────────────────

function AIGenerationModal({
  template,
  onClose,
  onSuccess,
}: {
  template: Template
  onClose: () => void
  onSuccess: (auto: Automation) => void
}) {
  const [currentStep, setCurrentStep] = useState(-1)
  const [done, setDone]               = useState(false)
  const [error, setError]             = useState('')
  const [created, setCreated]         = useState<Automation | null>(null)

  useEffect(() => {
    let mounted = true

    async function run() {
      for (let i = 0; i < AI_STEPS.length; i++) {
        if (!mounted) return
        setCurrentStep(i)
        await new Promise(r => setTimeout(r, 950))
      }
      try {
        const res = await fetch('/api/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            trigger_type: template.trigger_type,
            steps: template.stepsData.map((s, i) => ({
              step_order: i,
              subject: s.subject,
              body_html: s.body_html,
              delay_days: s.delay_days,
            })),
          }),
        })
        const data = await res.json() as { id?: string; error?: string }
        if (!res.ok || !data.id) throw new Error(data.error ?? 'Erro ao criar automação')

        const autoRes = await fetch(`/api/automations/${data.id}`)
        const autoData = autoRes.ok ? await autoRes.json() as Automation : null

        if (mounted) { setCreated(autoData); setDone(true) }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Erro inesperado')
      }
    }

    const t = setTimeout(() => { void run() }, 250)
    return () => { mounted = false; clearTimeout(t) }
  }, [template])

  const canClose = done || !!error

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)' }}
      onClick={e => { if (e.target === e.currentTarget && canClose) onClose() }}
    >
      <motion.div
        initial={{ y: 56, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 28, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${template.accent}35`, background: '#0d0d12' }}
      >
        {/* Accent line */}
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${template.accent}60, transparent)` }} />

        {/* Glow bg */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: template.gradient, opacity: 0.4 }} />

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <motion.div
              animate={{ rotate: done ? 0 : 360 }}
              transition={{ duration: 3, repeat: done ? 0 : Infinity, ease: 'linear' }}
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: `${template.accent}20`, border: `1px solid ${template.accent}40` }}
            >
              <Sparkles size={18} style={{ color: template.accent }} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-0.5">
                {done ? 'Criada com sucesso' : 'IA Criando'}
              </p>
              <p className="text-sm font-semibold text-white/90 truncate">{template.name}</p>
            </div>
            {canClose && (
              <button onClick={onClose} className="text-white/22 hover:text-white/60 p-1 transition-colors">
                <X size={15} />
              </button>
            )}
          </div>

          {/* Step list */}
          <div className="space-y-3 mb-5">
            {AI_STEPS.map((s, i) => {
              const isActive  = currentStep === i && !done && !error
              const isDone    = (done && !error) || currentStep > i
              const isPending = !done && !error && currentStep < i

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: isPending ? 0.25 : 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                    style={{
                      background: isDone
                        ? `${template.accent}22`
                        : isActive
                        ? `${template.accent}12`
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${
                        isDone
                          ? template.accent + '55'
                          : isActive
                          ? template.accent + '38'
                          : 'rgba(255,255,255,0.07)'
                      }`,
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={12} style={{ color: template.accent }} />
                    ) : isActive ? (
                      <Loader2 size={12} className="animate-spin" style={{ color: template.accent }} />
                    ) : (
                      <span className="text-[9px] font-bold text-white/15">{i + 1}</span>
                    )}
                  </div>
                  <p className={cn('text-[13px] transition-colors duration-300', isDone ? 'text-white/55' : isActive ? 'text-white' : 'text-white/18')}>
                    {isDone ? `✓ ${s}` : s}
                  </p>
                </motion.div>
              )
            })}
          </div>

          {/* Progress bar */}
          {!done && !error && (
            <div className="h-[2px] w-full rounded-full bg-white/[0.05] overflow-hidden mb-5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${template.accent}bb, ${template.accent})` }}
                animate={{ width: `${currentStep < 0 ? 0 : ((currentStep + 1) / AI_STEPS.length) * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}

          {/* Success preview */}
          {done && !error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl p-3.5 mb-4"
              style={{ background: `${template.accent}09`, border: `1px solid ${template.accent}22` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 rounded-lg flex items-center justify-center" style={{ background: `${template.accent}22` }}>
                  <CheckCircle2 size={11} style={{ color: template.accent }} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: template.accent }}>Automação pronta</p>
              </div>
              <p className="text-sm font-semibold text-white/80 mb-0.5">{template.name}</p>
              <p className="text-xs text-white/30">{template.stepsData.length} emails configurados · Gatilho: <TriggerBadge type={template.trigger_type} /></p>
            </motion.div>
          )}

          {/* Actions */}
          {canClose && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.18 }}
              className="flex gap-2"
            >
              <button
                onClick={onClose}
                className="flex-1 rounded-xl py-2.5 text-sm text-white/38 hover:text-white/65 border border-white/[0.06] hover:border-white/10 transition-all"
              >
                Fechar
              </button>
              {done && (
                <button
                  onClick={() => { if (created) onSuccess(created); onClose() }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all"
                  style={{ background: template.accent, boxShadow: `0 4px 18px ${template.glowColor}` }}
                >
                  Ver automação <ArrowRight size={13} />
                </button>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── My Automation Card ───────────────────────────────────────────────────────

function MyAutomationCard({
  automation,
  onToggle,
  onDelete,
}: {
  automation: Automation
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const meta     = TRIGGER_META[automation.trigger_type] ?? TRIGGER_META.manual
  const Icon     = meta.icon
  const isActive = automation.status === 'active'

  async function handleToggle() {
    setToggling(true)
    try {
      await fetch(`/api/automations/${automation.id}/toggle`, { method: 'POST' })
      onToggle(automation.id)
    } finally { setToggling(false) }
  }

  async function handleDelete() {
    if (!confirm('Excluir esta automação? Esta ação não pode ser desfeita.')) return
    setDeleting(true)
    try {
      await fetch(`/api/automations/${automation.id}`, { method: 'DELETE' })
      onDelete(automation.id)
    } finally { setDeleting(false) }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden hover:border-white/10 transition-all"
    >
      <motion.div
        className="h-px w-full"
        animate={{
          background: isActive
            ? `linear-gradient(90deg, transparent, ${meta.color}55, transparent)`
            : 'transparent',
        }}
        transition={{ duration: 0.4 }}
      />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5"
            style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}22` }}
          >
            <Icon size={15} style={{ color: meta.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-semibold text-white/90 truncate">{automation.name}</h3>
              {isActive && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
              )}
            </div>
            <p className="text-xs text-white/28 truncate mb-2">{automation.description || 'Sem descrição'}</p>
            <div className="flex items-center gap-2.5 flex-wrap">
              <TriggerBadge type={automation.trigger_type} />
              <span className="text-[10px] text-white/22 flex items-center gap-1">
                <Mail size={9} /> {automation.step_count} email{automation.step_count !== 1 ? 's' : ''}
              </span>
              {automation.enrolled_count > 0 && (
                <span className="text-[10px] text-white/22 flex items-center gap-1">
                  <Users size={9} /> {automation.enrolled_count} ativo{automation.enrolled_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href={`/dashboard/automations/${automation.id}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/18 hover:text-white/55 hover:bg-white/[0.05] transition-all"
            >
              <Settings size={13} />
            </Link>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                isActive
                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                  : 'text-white/18 hover:text-white/55 hover:bg-white/[0.05]',
              )}
            >
              {toggling ? <Loader2 size={13} className="animate-spin" /> : isActive ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/12 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── PRO Gate Overlay ─────────────────────────────────────────────────────────

function ProGateOverlay() {
  const features = [
    { icon: Brain,    label: 'IA Autônoma',         desc: 'A IA cria, ajusta e executa sozinha' },
    { icon: Workflow, label: 'Fluxos Ilimitados',    desc: 'Sequências multi-etapa sem restrição' },
    { icon: Bot,      label: 'Agentes Automáticos',  desc: 'IA que age em nome da sua empresa' },
    { icon: Shield,   label: 'Execução em Tempo Real', desc: 'Disparos automáticos por gatilho' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ backdropFilter: 'blur(18px)', background: 'rgba(7,7,9,0.82)' }}
    >
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,58,237,0.18) 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ y: 32, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: '#0d0d14',
          border: '1px solid rgba(124,58,237,0.35)',
          boxShadow: '0 0 80px rgba(124,58,237,0.25), 0 32px 64px rgba(0,0,0,0.8)',
        }}
      >
        {/* Top gradient line */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #7c3aed, rgba(139,92,246,0.5), transparent)' }} />

        {/* Background gradient */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, transparent 60%)' }} />

        <div className="relative p-7">
          {/* Badge */}
          <div className="flex justify-center mb-5">
            <motion.div
              animate={{ boxShadow: ['0 0 0 0px rgba(124,58,237,0.4)', '0 0 0 10px rgba(124,58,237,0)', '0 0 0 0px rgba(124,58,237,0.4)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)' }}
            >
              <Crown size={28} className="text-violet-300" />
            </motion.div>
          </div>

          {/* PRO badge */}
          <div className="flex justify-center mb-3">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa' }}
            >
              ✦ Recurso PRO
            </span>
          </div>

          <h2 className="text-[22px] font-bold text-white text-center mb-1.5 leading-tight">
            Central Operacional de IA
          </h2>
          <p className="text-[13px] text-white/38 text-center leading-relaxed mb-6">
            Automações autônomas que operam sua empresa enquanto você dorme.
            Disponível no plano PRO.
          </p>

          {/* Features */}
          <div className="space-y-2.5 mb-6">
            {features.map((f, fi) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + fi * 0.08 }}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.12)' }}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600/18 border border-violet-500/22">
                    <Icon size={13} className="text-violet-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white/80">{f.label}</p>
                    <p className="text-[10px] text-white/28">{f.desc}</p>
                  </div>
                  <CheckCircle2 size={13} className="text-violet-400/60 shrink-0" />
                </motion.div>
              )
            })}
          </div>

          {/* Pricing hint */}
          <div className="text-center mb-4">
            <p className="text-[11px] text-white/22">A partir de</p>
            <p className="text-[28px] font-black text-white leading-none">R$397<span className="text-[14px] font-medium text-white/38">/mês</span></p>
            <p className="text-[10px] text-white/20 mt-0.5">Cancele quando quiser</p>
          </div>

          {/* CTA */}
          <Link
            href="/dashboard/billing"
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[13px] font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 8px 32px rgba(124,58,237,0.45)',
            }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}>
              <Sparkles size={15} />
            </motion.div>
            Fazer upgrade para PRO
            <ArrowRight size={14} />
          </Link>

          <p className="text-center text-[10px] text-white/15 mt-3">
            Teste 7 dias grátis · Sem compromisso
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [tab, setTab]                   = useState<'marketplace' | 'mine'>('marketplace')
  const [automations, setAutomations]   = useState<Automation[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [previewTemplate, setPreview]   = useState<Template | null>(null)
  const [activeTemplate, setActive]     = useState<Template | null>(null)
  const [filterType, setFilterType]     = useState<string>('all')
  const [plan, setPlan]                 = useState<string>('free')
  const [planLoading, setPlanLoading]   = useState(true)

  // Fetch plan
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then((d: unknown) => {
        if (d && typeof d === 'object') {
          const data = d as { user?: { effectivePlan?: string } }
          setPlan(data.user?.effectivePlan ?? 'free')
        }
      })
      .catch(() => {})
      .finally(() => setPlanLoading(false))
  }, [])

  const isPro = ['pro', 'scale', 'enterprise'].includes(plan)

  const loadAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/automations')
      if (!res.ok) return
      const data = await res.json() as { automations: Automation[] }
      setAutomations(data.automations ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadAutomations() }, [loadAutomations])

  useEffect(() => {
    if (!loading && automations.length === 0) {
      fetch('/api/automations/seed', { method: 'POST' })
        .then(() => loadAutomations())
        .catch(() => null)
    }
  }, [loading, automations.length, loadAutomations])

  function handleToggle(id: string) {
    setAutomations(prev =>
      prev.map(a => a.id === id
        ? { ...a, status: (a.status === 'active' ? 'inactive' : 'active') as Automation['status'] }
        : a,
      ),
    )
  }

  function handleDelete(id: string) { setAutomations(prev => prev.filter(a => a.id !== id)) }

  function handleCreated(auto: Automation) {
    setAutomations(prev => [auto, ...prev])
    setTab('mine')
  }

  const filteredAutomations = automations.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filterType === 'all' || a.trigger_type === filterType || a.status === filterType
    return matchSearch && matchFilter
  })

  const filteredTemplates = TEMPLATES
    .filter(t => filterType === 'all' || t.trigger_type === filterType)
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))

  const activeCount = automations.filter(a => a.status === 'active').length

  // Show PRO gate after plan is loaded and user is not pro
  if (!planLoading && !isPro) {
    return (
      <div className="min-h-screen bg-[#070709] relative overflow-hidden">
        {/* Blurred content hint */}
        <div className="blur-sm opacity-30 pointer-events-none select-none">
          <div className="px-6 pt-8 pb-6">
            <h1 className="text-[26px] font-bold text-white mb-2">Automações</h1>
            <p className="text-sm text-white/40">Fluxos inteligentes que trabalham enquanto você dorme</p>
            <div className="mt-6 grid grid-cols-1 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="h-64 rounded-2xl bg-white/[0.02] border border-white/[0.06]" />
              ))}
            </div>
          </div>
        </div>
        <ProGateOverlay />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070709] pb-16">

      {/* ── Header ── */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <motion.div
                className="h-1.5 w-1.5 rounded-full bg-violet-400"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/60">Intelligent Flows</span>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-white">Automações</h1>
            <p className="text-sm text-white/28 mt-0.5">Fluxos inteligentes que trabalham enquanto você dorme</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
              <Activity size={11} className="text-emerald-400" />
              <span className="text-xs font-semibold text-white/65">{activeCount} ativa{activeCount !== 1 ? 's' : ''}</span>
            </div>
            <Link
              href="/dashboard/automations/new"
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-600/10 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-600/20 transition-all"
            >
              <Plus size={12} /> Nova
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/18" />
          <input
            type="text"
            placeholder="Buscar automações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.02] pl-9 pr-4 py-2.5 text-sm text-white/80 placeholder-white/16 focus:outline-none focus:border-violet-500/40 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.015] p-1">
          {([
            { key: 'marketplace' as const, label: 'Marketplace', count: TEMPLATES.length },
            { key: 'mine' as const,        label: 'Minhas Automações', count: automations.length },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all duration-200',
                tab === t.key ? 'bg-white/[0.07] text-white' : 'text-white/28 hover:text-white/52',
              )}
            >
              {t.label}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-all',
                tab === t.key ? 'bg-violet-500/20 text-violet-300' : 'bg-white/[0.04] text-white/20',
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Marketplace ── */}
      <AnimatePresence mode="wait">
        {tab === 'marketplace' && (
          <motion.div
            key="marketplace"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="px-6"
          >
            {/* Filter chips */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
              {[
                { key: 'all',            label: 'Todos' },
                { key: 'client_overdue', label: '🔥 Recuperação' },
                { key: 'new_client',     label: '⭐ Onboarding' },
                { key: 'manual',         label: '⚡ Manual' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all',
                    filterType === f.key
                      ? 'border-violet-500/45 bg-violet-600/16 text-violet-300'
                      : 'border-white/[0.07] text-white/28 hover:text-white/52',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* IA banner */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-violet-500/18 bg-violet-600/[0.05] px-4 py-3 mb-5 flex items-center gap-3"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/28"
              >
                <Sparkles size={12} className="text-violet-300" />
              </motion.div>
              <div>
                <p className="text-[11px] font-semibold text-violet-300">Powered by IA · 4 templates prontos</p>
                <p className="text-[10px] text-violet-400/38 mt-0.5">A IA cria, personaliza e configura cada automação em segundos — sem código</p>
              </div>
            </motion.div>

            {/* Template cards */}
            <div className="grid grid-cols-1 gap-5">
              {filteredTemplates.map(template => (
                <TemplateCard key={template.id} template={template} onPreview={setPreview} />
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="py-16 text-center text-white/18 text-sm">
                Nenhum template encontrado{search ? ` para "${search}"` : ''}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Mine ── */}
        {tab === 'mine' && (
          <motion.div
            key="mine"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="px-6"
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin text-violet-400/55" />
              </div>
            ) : filteredAutomations.length === 0 ? (
              <div className="py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06] mx-auto mb-4">
                  <Zap size={20} className="text-white/16" />
                </div>
                <p className="text-sm text-white/26 mb-1">
                  {search ? `Nenhum resultado para "${search}"` : 'Você ainda não tem automações'}
                </p>
                <p className="text-xs text-white/14 mb-5">Use o Marketplace para criar sua primeira com IA</p>
                <button
                  onClick={() => setTab('marketplace')}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-600/10 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-600/20 transition-all"
                >
                  <Sparkles size={13} /> Explorar Marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredAutomations.map(auto => (
                    <MyAutomationCard
                      key={auto.id}
                      automation={auto}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
                <Link
                  href="/dashboard/automations/new"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.07] py-4 text-sm text-white/22 hover:text-white/45 hover:border-white/12 transition-all"
                >
                  <Plus size={13} /> Nova automação
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Template Preview Modal ── */}
      <AnimatePresence>
        {previewTemplate && !activeTemplate && (
          <TemplatePreviewModal
            key={previewTemplate.id}
            template={previewTemplate}
            onClose={() => setPreview(null)}
            onGenerate={() => { setActive(previewTemplate); setPreview(null) }}
          />
        )}
      </AnimatePresence>

      {/* ── AI Generation Modal ── */}
      <AnimatePresence>
        {activeTemplate && (
          <AIGenerationModal
            template={activeTemplate}
            onClose={() => setActive(null)}
            onSuccess={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
