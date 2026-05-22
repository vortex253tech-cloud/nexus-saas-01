'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Users, AlertCircle, Plus, Play, Pause, Trash2,
  BarChart3, TrendingUp, CheckCircle2, Loader2, Sparkles,
  ArrowRight, Mail, Clock, Search, ChevronRight,
  Settings, Eye, Target, Activity, X,
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
  id:          string
  name:        string
  description: string
  trigger_type: 'manual' | 'new_client' | 'client_overdue'
  badge:       string
  badgeColor:  string
  gradient:    string
  glowColor:   string
  accent:      string
  metrics:     { abertura: number; conversao: number; receita: string; roi: number }
  steps:       number
  avgDays:     number
  stepsData:   Array<{ subject: string; body_html: string; delay_days: number }>
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
    gradient: 'linear-gradient(135deg, rgba(234,88,12,0.15) 0%, rgba(220,38,38,0.08) 50%, transparent 100%)',
    glowColor: 'rgba(249,115,22,0.3)',
    accent: '#f97316',
    metrics: { abertura: 78, conversao: 34, receita: 'R$12.400', roi: 340 },
    steps: 4,
    avgDays: 14,
    stepsData: [
      { subject: 'Atenção: Cobrança pendente - {nome}', body_html: 'Olá {nome},\n\nIdentificamos uma cobrança em aberto em seu nome. Para evitar a suspensão dos serviços, regularize sua situação o quanto antes.\n\nEntre em contato para mais informações.\n\nAtenciosamente,\n{empresa}', delay_days: 0 },
      { subject: 'Aviso: Regularize sua situação, {nome}', body_html: 'Olá {nome},\n\nAinda não identificamos o pagamento da sua cobrança em aberto. Temos opções de parcelamento disponíveis.\n\nEntre em contato conosco hoje.\n\nAtenciosamente,\n{empresa}', delay_days: 3 },
      { subject: 'Proposta especial de regularização', body_html: 'Olá {nome},\n\nQueremos ajudar você a regularizar sua situação. Temos condições especiais com parcelamento facilitado.\n\nResponda este email ou ligue para nós.\n\nAtenciosamente,\n{empresa}', delay_days: 7 },
      { subject: 'Última chance — Condições especiais disponíveis', body_html: 'Olá {nome},\n\nEsta é nossa última tentativa de contato. Temos condições especiais disponíveis por tempo limitado.\n\nEntre em contato hoje mesmo.\n\nAtenciosamente,\n{empresa}', delay_days: 14 },
    ],
  },
  {
    id: 'welcome',
    name: 'Onboarding de Novo Cliente',
    description: 'Sequência de boas-vindas para novos clientes. Aumenta engajamento e reduz churn desde o primeiro dia.',
    trigger_type: 'new_client',
    badge: '⭐ Alta Conversão',
    badgeColor: '#10b981',
    gradient: 'linear-gradient(135deg, rgba(5,150,105,0.15) 0%, rgba(20,184,166,0.08) 50%, transparent 100%)',
    glowColor: 'rgba(16,185,129,0.3)',
    accent: '#10b981',
    metrics: { abertura: 92, conversao: 61, receita: 'R$8.200', roi: 280 },
    steps: 3,
    avgDays: 7,
    stepsData: [
      { subject: 'Bem-vindo(a), {nome}! 🎉', body_html: 'Olá {nome},\n\nSeja muito bem-vindo(a) à {empresa}! Estamos felizes em ter você conosco.\n\nAqui estão seus próximos passos:\n1. Complete seu perfil\n2. Explore nossas funcionalidades\n3. Entre em contato se precisar de ajuda\n\nEquipe {empresa}', delay_days: 0 },
      { subject: 'Como está sendo sua experiência, {nome}?', body_html: 'Olá {nome},\n\nJá faz alguns dias desde que você se juntou a nós. Como está sendo sua experiência?\n\nSe tiver alguma dúvida, estamos à disposição.\n\nEquipe {empresa}', delay_days: 3 },
      { subject: 'Dicas exclusivas para você, {nome}', body_html: 'Olá {nome},\n\nQueremos garantir que você aproveite todos os benefícios disponíveis.\n\nAqui vão dicas exclusivas para maximizar seus resultados com a {empresa}.\n\nEquipe {empresa}', delay_days: 7 },
    ],
  },
  {
    id: 'reactivation',
    name: 'Reativação de Clientes Inativos',
    description: 'Reconquiste clientes que não interagem há mais de 30 dias. Estratégia comprovada com taxa de retorno de 28%.',
    trigger_type: 'manual',
    badge: '💎 ROI +280%',
    badgeColor: '#8b5cf6',
    gradient: 'linear-gradient(135deg, rgba(109,40,217,0.15) 0%, rgba(139,92,246,0.08) 50%, transparent 100%)',
    glowColor: 'rgba(139,92,246,0.3)',
    accent: '#8b5cf6',
    metrics: { abertura: 65, conversao: 28, receita: 'R$6.800', roi: 220 },
    steps: 3,
    avgDays: 10,
    stepsData: [
      { subject: 'Sentimos sua falta, {nome}!', body_html: 'Olá {nome},\n\nFaz um tempo que não nos falamos. Sentimos sua falta!\n\nTemos novidades incríveis esperando por você.\n\nEquipe {empresa}', delay_days: 0 },
      { subject: 'Uma oferta especial só para você, {nome}', body_html: 'Olá {nome},\n\nComo você é especial para nós, preparamos uma oferta exclusiva de retorno.\n\nNão perca essa oportunidade!\n\nEquipe {empresa}', delay_days: 5 },
      { subject: 'Última chance: Oferta válida até hoje', body_html: 'Olá {nome},\n\nHoje é o último dia para aproveitar a oferta especial que preparamos para você.\n\nEquipe {empresa}', delay_days: 10 },
    ],
  },
  {
    id: 'nurturing',
    name: 'Nurturing de Leads',
    description: 'Eduque e aqueça leads ao longo do funil de vendas. Aumenta a probabilidade de conversão em até 4x.',
    trigger_type: 'manual',
    badge: '🤖 IA Powered',
    badgeColor: '#06b6d4',
    gradient: 'linear-gradient(135deg, rgba(8,145,178,0.15) 0%, rgba(59,130,246,0.08) 50%, transparent 100%)',
    glowColor: 'rgba(6,182,212,0.3)',
    accent: '#06b6d4',
    metrics: { abertura: 71, conversao: 42, receita: 'R$15.600', roi: 420 },
    steps: 5,
    avgDays: 21,
    stepsData: [
      { subject: 'Olá {nome} — obrigado pelo interesse!', body_html: 'Olá {nome},\n\nMuito obrigado pelo interesse em nossos serviços! Nos próximos dias, enviaremos conteúdo exclusivo para ajudá-lo(a) a tomar a melhor decisão.\n\nEquipe {empresa}', delay_days: 0 },
      { subject: 'Guia exclusivo: Como maximizar resultados', body_html: 'Olá {nome},\n\nComo prometido, segue nosso guia exclusivo sobre como maximizar seus resultados.\n\nEquipe {empresa}', delay_days: 3 },
      { subject: 'Case de sucesso: Resultados reais', body_html: 'Olá {nome},\n\nConheça como nossos clientes estão obtendo resultados incríveis com nossa solução.\n\nEquipe {empresa}', delay_days: 7 },
      { subject: '{nome}, posso tirar suas dúvidas?', body_html: 'Olá {nome},\n\nGostaríamos de saber se ficou alguma dúvida sobre nossa solução. Estou disponível para uma conversa rápida.\n\nEquipe {empresa}', delay_days: 14 },
      { subject: 'Proposta personalizada para {nome}', body_html: 'Olá {nome},\n\nPreparamos uma proposta personalizada baseada nas suas necessidades. Vamos conversar?\n\nEquipe {empresa}', delay_days: 21 },
    ],
  },
]

const AI_STEPS = [
  'Analisando objetivo da automação',
  'Criando sequência de mensagens',
  'Definindo gatilhos e timing',
  'Otimizando para conversão',
  'Configurando automação no sistema',
]

// ─── Trigger badge ────────────────────────────────────────────────────────────

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
      style={{ color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}
    >
      <Icon size={8} />
      {meta.label}
    </span>
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
        await new Promise(r => setTimeout(r, 900))
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

        // Fetch enriched automation data
        const autoRes = await fetch(`/api/automations/${data.id}`)
        const autoData = autoRes.ok ? await autoRes.json() as Automation : null

        if (mounted) {
          setCreated(autoData)
          setDone(true)
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Erro inesperado')
      }
    }

    const t = setTimeout(() => { void run() }, 300)
    return () => { mounted = false; clearTimeout(t) }
  }, [template])

  const canClose = done || !!error

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
      onClick={e => { if (e.target === e.currentTarget && canClose) onClose() }}
    >
      <motion.div
        initial={{ y: 48, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d12] p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${template.accent}20`, border: `1px solid ${template.accent}40` }}
          >
            <Sparkles size={18} style={{ color: template.accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-0.5">IA Criando</p>
            <p className="text-sm font-semibold text-white/90 truncate">{template.name}</p>
          </div>
          {canClose && (
            <button onClick={onClose} className="text-white/25 hover:text-white/60 transition-colors p-1">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Steps list */}
        <div className="space-y-2.5 mb-5">
          {AI_STEPS.map((s, i) => {
            const isActive  = currentStep === i && !done && !error
            const isDone    = currentStep > i || done
            const isPending = currentStep < i && !done && !error

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
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
                        ? template.accent + '35'
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
                <p className={cn(
                  'text-[13px] transition-colors duration-300',
                  isDone ? 'text-white/60' : isActive ? 'text-white' : 'text-white/20',
                )}>
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
              style={{ background: `linear-gradient(90deg, ${template.accent}cc, ${template.accent})` }}
              animate={{ width: `${currentStep < 0 ? 0 : ((currentStep + 1) / AI_STEPS.length) * 100}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* Success state */}
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 mb-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <p className="text-[11px] text-emerald-400/80 font-semibold uppercase tracking-widest">Criada com sucesso</p>
            </div>
            <p className="text-sm font-semibold text-white/80">{template.name}</p>
            <p className="text-xs text-white/35 mt-0.5">{template.stepsData.length} emails configurados · Pronta para ativar</p>
          </motion.div>
        )}

        {/* Actions */}
        {canClose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex gap-2"
          >
            <button
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-sm text-white/40 hover:text-white/70 border border-white/[0.06] hover:border-white/10 transition-all"
            >
              Fechar
            </button>
            {done && (
              <button
                onClick={() => { if (created) onSuccess(created); onClose() }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all"
                style={{ background: template.accent }}
              >
                Ver automação <ArrowRight size={13} />
              </button>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onActivate }: { template: Template; onActivate: (t: Template) => void }) {
  const [hovered, setHovered] = useState(false)
  const TriggerIcon = TRIGGER_META[template.trigger_type]?.icon ?? Zap

  return (
    <motion.div
      layout
      whileHover={{ y: -3 }}
      transition={{ duration: 0.22 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: hovered ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.018)',
        border: `1px solid ${hovered ? template.accent + '40' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered
          ? `0 0 50px ${template.glowColor}, 0 20px 60px rgba(0,0,0,0.5)`
          : '0 4px 24px rgba(0,0,0,0.25)',
        transition: 'all 0.3s cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      {/* Gradient bg */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: template.gradient, opacity: hovered ? 1 : 0.6, transition: 'opacity 0.3s' }} />

      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent 10%, ${template.accent}50 50%, transparent 90%)`, opacity: hovered ? 1 : 0, transition: 'opacity 0.3s' }}
      />

      <div className="relative p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: `${template.accent}18`, border: `1px solid ${template.accent}30` }}
            >
              <TriggerIcon size={15} style={{ color: template.accent }} />
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ color: template.badgeColor, background: `${template.badgeColor}15`, border: `1px solid ${template.badgeColor}28` }}
            >
              {template.badge}
            </span>
          </div>
          <div className="flex items-center gap-1 text-white/20 text-[10px]">
            <Mail size={10} />
            {template.steps} emails
          </div>
        </div>

        {/* Name & description */}
        <h3 className="text-[15px] font-semibold text-white/90 leading-snug mb-1">{template.name}</h3>
        <p className="text-xs text-white/35 leading-relaxed mb-4 line-clamp-2">{template.description}</p>

        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {[
            { label: 'Abertura',  value: `${template.metrics.abertura}%`,  icon: Eye       },
            { label: 'Conversão', value: `${template.metrics.conversao}%`, icon: Target    },
            { label: 'Receita',   value: template.metrics.receita,          icon: TrendingUp },
            { label: 'ROI',       value: `+${template.metrics.roi}%`,       icon: BarChart3 },
          ].map(m => {
            const Icon = m.icon
            return (
              <div
                key={m.label}
                className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2 text-center"
              >
                <Icon size={9} className="mx-auto mb-1 text-white/25" />
                <p className="text-[11px] font-bold text-white/75 leading-none">{m.value}</p>
                <p className="text-[9px] text-white/20 mt-1">{m.label}</p>
              </div>
            )
          })}
        </div>

        {/* Flow preview */}
        <div className="flex items-center gap-1.5 mb-4 overflow-hidden">
          {template.stepsData.slice(0, 5).map((_, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-lg"
                style={{ background: `${template.accent}14`, border: `1px solid ${template.accent}22` }}
              >
                <Mail size={8} style={{ color: template.accent }} />
              </div>
              {i < Math.min(template.stepsData.length - 1, 4) && (
                <div className="flex items-center gap-0.5">
                  <div className="h-px w-2 bg-white/10" />
                  <Clock size={7} className="text-white/12" />
                  <div className="h-px w-2 bg-white/10" />
                </div>
              )}
            </div>
          ))}
          {template.stepsData.length > 5 && (
            <span className="text-[9px] text-white/20 ml-0.5">+{template.stepsData.length - 5}</span>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => onActivate(template)}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200"
          style={{
            background: hovered ? template.accent : `${template.accent}18`,
            border: `1px solid ${template.accent}${hovered ? '80' : '28'}`,
            color: hovered ? '#fff' : template.accent,
          }}
        >
          <Sparkles size={13} />
          Criar com IA
          <ChevronRight size={13} />
        </button>
      </div>
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
    } finally {
      setToggling(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir esta automação? Esta ação não pode ser desfeita.')) return
    setDeleting(true)
    try {
      await fetch(`/api/automations/${automation.id}`, { method: 'DELETE' })
      onDelete(automation.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden hover:border-white/10 transition-all group"
    >
      {/* Active status line */}
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
          {/* Icon */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5"
            style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}22` }}
          >
            <Icon size={15} style={{ color: meta.color }} />
          </div>

          {/* Content */}
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
            <p className="text-xs text-white/30 truncate mb-2">{automation.description || 'Sem descrição'}</p>

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

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href={`/dashboard/automations/${automation.id}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.05] transition-all"
            >
              <Settings size={13} />
            </Link>
            <button
              onClick={handleToggle}
              disabled={toggling}
              title={isActive ? 'Pausar' : 'Ativar'}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                isActive
                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                  : 'text-white/20 hover:text-white/60 hover:bg-white/[0.05]',
              )}
            >
              {toggling
                ? <Loader2 size={13} className="animate-spin" />
                : isActive
                ? <Pause size={13} />
                : <Play size={13} />}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all"
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

export default function AutomationsPage() {
  const [tab, setTab]                 = useState<'marketplace' | 'mine'>('marketplace')
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [activeTemplate, setActive]   = useState<Template | null>(null)
  const [filterType, setFilterType]   = useState<string>('all')

  const loadAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/automations')
      if (!res.ok) return
      const data = await res.json() as { automations: Automation[] }
      setAutomations(data.automations ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAutomations() }, [loadAutomations])

  // Auto-seed on first load if empty
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

  function handleDelete(id: string) {
    setAutomations(prev => prev.filter(a => a.id !== id))
  }

  function handleCreated(auto: Automation) {
    setAutomations(prev => [auto, ...prev])
    setTab('mine')
  }

  const filteredAutomations = automations.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filterType === 'all' || a.trigger_type === filterType || a.status === filterType
    return matchSearch && matchFilter
  })

  const filteredTemplates = TEMPLATES.filter(t =>
    filterType === 'all' || t.trigger_type === filterType,
  ).filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()),
  )

  const activeCount = automations.filter(a => a.status === 'active').length

  return (
    <div className="min-h-screen bg-[#070709] pb-16">

      {/* ─── Header ─── */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/60">Intelligent Flows</span>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-white">Automações</h1>
            <p className="text-sm text-white/30 mt-0.5">Fluxos inteligentes que trabalham enquanto você dorme</p>
          </div>

          <div className="flex gap-2 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
              <Activity size={11} className="text-emerald-400" />
              <span className="text-xs font-semibold text-white/70">{activeCount} ativa{activeCount !== 1 ? 's' : ''}</span>
            </div>
            <Link
              href="/dashboard/automations/new"
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-600/12 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-600/22 transition-all"
            >
              <Plus size={12} /> Nova
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            placeholder="Buscar automações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.02] pl-9 pr-4 py-2.5 text-sm text-white/80 placeholder-white/18 focus:outline-none focus:border-violet-500/40 transition-all"
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
                tab === t.key ? 'bg-white/[0.07] text-white' : 'text-white/30 hover:text-white/55',
              )}
            >
              {t.label}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-all',
                tab === t.key ? 'bg-violet-500/22 text-violet-300' : 'bg-white/[0.04] text-white/22',
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Marketplace Tab ─── */}
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
                      ? 'border-violet-500/45 bg-violet-600/18 text-violet-300'
                      : 'border-white/[0.07] bg-transparent text-white/30 hover:text-white/55',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* IA banner */}
            <div className="rounded-2xl border border-violet-500/18 bg-violet-600/[0.06] px-4 py-3 mb-4 flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-violet-600/22 border border-violet-500/28">
                <Sparkles size={13} className="text-violet-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-violet-300">Powered by IA</p>
                <p className="text-[10px] text-violet-400/40 mt-0.5">Cada automação é criada, personalizada e configurada pela IA em segundos</p>
              </div>
            </div>

            {/* Template cards */}
            <div className="grid grid-cols-1 gap-4">
              {filteredTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onActivate={setActive}
                />
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="py-16 text-center text-white/20 text-sm">
                Nenhum template encontrado{search ? ` para "${search}"` : ''}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Mine Tab ─── */}
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
                <Loader2 size={20} className="animate-spin text-violet-400/60" />
              </div>
            ) : filteredAutomations.length === 0 ? (
              <div className="py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06] mx-auto mb-4">
                  <Zap size={20} className="text-white/18" />
                </div>
                <p className="text-sm text-white/28 mb-1">
                  {search ? `Nenhum resultado para "${search}"` : 'Você ainda não tem automações'}
                </p>
                <p className="text-xs text-white/15 mb-5">
                  Use o Marketplace para criar sua primeira automação com IA
                </p>
                <button
                  onClick={() => setTab('marketplace')}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-600/12 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-600/22 transition-all"
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

      {/* ─── AI Generation Modal ─── */}
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
