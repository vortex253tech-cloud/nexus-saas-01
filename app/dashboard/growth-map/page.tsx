'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useInView }  from 'framer-motion'
import { useRouter }                            from 'next/navigation'
import {
  Map, Plus, Loader2, Zap, Clock, Trash2, ChevronRight, X, Sparkles,
  RefreshCw, Users, TrendingUp, ShoppingBag, Play, ArrowRight,
  Brain, Activity, Target, BarChart3, AlertCircle, CheckCircle2,
  Mail, DollarSign,
} from 'lucide-react'
import { GROWTH_TEMPLATES } from '@/lib/growth-map-types'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GrowthMap {
  id: string; name: string; description: string; status: string
  last_executed_at: string | null; updated_at: string
}

// ─── Template config ──────────────────────────────────────────────────────────

const TEMPLATE_CONFIG: Record<string, {
  icon:    React.ElementType
  accent:  string
  glow:    string
  gradient: string
  roi:     string
  revenue: string
  time:    string
  steps:   number
  level:   string
}> = {
  recovery: {
    icon:     RefreshCw,
    accent:   '#ef4444',
    glow:     'rgba(239,68,68,0.3)',
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.06) 100%)',
    roi: '+340%', revenue: 'R$12.400', time: '2 min', steps: 5, level: 'Alta',
  },
  growth: {
    icon:     TrendingUp,
    accent:   '#10b981',
    glow:     'rgba(16,185,129,0.3)',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.06) 100%)',
    roi: '+280%', revenue: 'R$8.200', time: '3 min', steps: 6, level: 'Média',
  },
  retention: {
    icon:     Users,
    accent:   '#8b5cf6',
    glow:     'rgba(139,92,246,0.3)',
    gradient: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(109,40,217,0.06) 100%)',
    roi: '+220%', revenue: 'R$6.800', time: '2 min', steps: 4, level: 'Fácil',
  },
  upsell: {
    icon:     ShoppingBag,
    accent:   '#06b6d4',
    glow:     'rgba(6,182,212,0.3)',
    gradient: 'linear-gradient(135deg, rgba(6,182,212,0.18) 0%, rgba(8,145,178,0.06) 100%)',
    roi: '+420%', revenue: 'R$15.600', time: '4 min', steps: 7, level: 'Alta',
  },
}

// ─── Animated background grid ─────────────────────────────────────────────────

function FuturisticBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Base grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '52px 52px',
        }}
      />
      {/* Radial fade to keep grid subtle toward edges */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 20%, transparent 0%, #070709 75%)',
        }}
      />
      {/* Glow orbs */}
      <motion.div
        className="absolute -top-32 left-1/3 h-96 w-96 rounded-full"
        animate={{ opacity: [0.12, 0.22, 0.12], scale: [1, 1.08, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.5) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <motion.div
        className="absolute top-1/3 -right-24 h-72 w-72 rounded-full"
        animate={{ opacity: [0.08, 0.16, 0.08], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)', filter: 'blur(50px)' }}
      />
      {/* Floating particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-0.5 w-0.5 rounded-full bg-violet-400"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.7, 0],
            y: [0, -60],
            x: [0, (i % 3 - 1) * 20],
          }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            delay: i * 1.1,
            ease: 'easeOut',
          }}
          style={{
            left: `${10 + i * 11}%`,
            top: `${30 + (i % 4) * 15}%`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Mini flow preview ────────────────────────────────────────────────────────

function MiniFlowNodes({ count, accent, inView }: { count: number; accent: string; inView: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <React.Fragment key={i}>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ delay: 0.08 + i * 0.06, type: 'spring', stiffness: 500, damping: 24 }}
            className="h-4 w-4 rounded-md flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, border: `1px solid ${accent}35` }}
          >
            <Brain size={7} style={{ color: accent }} />
          </motion.div>
          {i < count - 1 && (
            <motion.div
              className="h-px flex-1"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={inView ? { scaleX: 1, opacity: 1 } : {}}
              transition={{ delay: 0.12 + i * 0.06, duration: 0.2, ease: 'easeOut' }}
              style={{ transformOrigin: 'left', background: `${accent}28`, minWidth: '10px', maxWidth: '20px' }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Template Card (premium) ──────────────────────────────────────────────────

function TemplateMapCard({
  templateKey,
  onSelect,
}: {
  templateKey: string
  onSelect: () => void
}) {
  const tpl    = GROWTH_TEMPLATES[templateKey]
  const cfg    = TEMPLATE_CONFIG[templateKey] ?? TEMPLATE_CONFIG.recovery
  const Icon   = cfg.icon
  const cardRef = useRef<HTMLDivElement>(null)
  const inView  = useInView(cardRef, { once: true, amount: 0.3 })
  const [hovered, setHovered] = useState(false)

  if (!tpl) return null

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onSelect}
      className="relative rounded-2xl cursor-pointer overflow-hidden"
      style={{
        background: hovered ? 'rgba(255,255,255,0.028)' : 'rgba(255,255,255,0.016)',
        border: `1px solid ${hovered ? cfg.accent + '45' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered
          ? `0 0 60px ${cfg.glow}, 0 20px 48px rgba(0,0,0,0.55)`
          : '0 4px 24px rgba(0,0,0,0.25)',
        transition: 'background 0.3s, border-color 0.3s, box-shadow 0.4s',
      }}
    >
      {/* Gradient fill */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: cfg.gradient, opacity: hovered ? 1 : 0.5, transition: 'opacity 0.35s' }}
      />
      {/* Top shimmer */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent 5%, ${cfg.accent}55 50%, transparent 95%)`, opacity: hovered ? 1 : 0.4 }}
      />
      {/* Hover sweep */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ x: '-110%' }}
        animate={hovered ? { x: '160%' } : { x: '-110%' }}
        transition={{ duration: 0.9, ease: 'easeInOut' }}
        style={{ background: `linear-gradient(90deg, transparent 20%, ${cfg.accent}12 50%, transparent 80%)` }}
      />

      <div className="relative p-4 space-y-3.5">
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <motion.div
            animate={hovered ? { rotate: [0, -8, 8, 0] } : { rotate: 0 }}
            transition={{ duration: 0.5 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${cfg.accent}14`, border: `1px solid ${cfg.accent}25` }}
          >
            <Icon size={16} style={{ color: cfg.accent }} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white/90 leading-snug">{tpl.name}</p>
            <p className="text-[10px] text-white/28 mt-0.5 line-clamp-2">{tpl.description}</p>
          </div>
        </div>

        {/* Mini flow */}
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-widest text-white/18 mb-1.5">Fluxo de execução</p>
          <MiniFlowNodes count={Math.min(cfg.steps, 6)} accent={cfg.accent} inView={inView} />
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'ROI', value: cfg.roi, icon: BarChart3 },
            { label: 'Receita', value: cfg.revenue, icon: DollarSign },
            { label: 'Nível', value: cfg.level, icon: Target },
          ].map((m, mi) => {
            const MIcon = m.icon
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.2 + mi * 0.06 }}
                className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5 text-center"
              >
                <MIcon size={8} className="mx-auto mb-0.5" style={{ color: cfg.accent }} />
                <p className="text-[10px] font-bold tabular-nums leading-none" style={{ color: cfg.accent }}>{m.value}</p>
                <p className="text-[8px] text-white/20 mt-0.5">{m.label}</p>
              </motion.div>
            )
          })}
        </div>

        {/* CTA */}
        <motion.div
          animate={{
            background: hovered
              ? `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}cc)`
              : `${cfg.accent}10`,
            color: hovered ? '#fff' : cfg.accent,
            borderColor: hovered ? `${cfg.accent}70` : `${cfg.accent}22`,
          }}
          transition={{ duration: 0.25 }}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold border"
        >
          <Play size={10} />
          Executar estratégia
          <ChevronRight size={10} className={cn('transition-transform', hovered && 'translate-x-0.5')} />
        </motion.div>
      </div>
    </motion.div>
  )
}

// ─── AI Copilot Banner ────────────────────────────────────────────────────────

function AICopilotBanner({ maps }: { maps: GrowthMap[] }) {
  const executed = maps.filter(m => m.last_executed_at).length
  const active   = maps.filter(m => m.status === 'active').length

  const insights = [
    executed > 0
      ? `${executed} mapa${executed !== 1 ? 's' : ''} executado${executed !== 1 ? 's' : ''} — monitorando resultados em tempo real`
      : 'Nenhum mapa executado ainda — execute um template para ver insights da IA',
    active > 0
      ? `${active} estratégia${active !== 1 ? 's' : ''} ativa${active !== 1 ? 's' : ''} operando autonomamente`
      : 'Ative um mapa para que a IA opere sua empresa automaticamente',
    'Potencial de recuperação estimado: R$12.400 — clientes inativos detectados',
  ]
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % insights.length), 4000)
    return () => clearInterval(t)
  }, [insights.length])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative rounded-2xl overflow-hidden mb-6"
      style={{
        background: 'rgba(124,58,237,0.06)',
        border: '1px solid rgba(124,58,237,0.18)',
      }}
    >
      {/* Animated accent top line */}
      <motion.div
        className="h-px w-full"
        animate={{ background: [
          'linear-gradient(90deg, transparent, rgba(124,58,237,0.7), transparent)',
          'linear-gradient(90deg, transparent, rgba(16,185,129,0.5), transparent)',
          'linear-gradient(90deg, transparent, rgba(124,58,237,0.7), transparent)',
        ] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      <div className="px-4 py-3.5 flex items-center gap-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/28"
        >
          <Brain size={14} className="text-violet-300" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/60 mb-0.5">Copiloto IA · Monitoramento Contínuo</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={idx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="text-[12px] text-violet-200/70 truncate"
            >
              {insights[idx]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="text-[9px] font-semibold text-emerald-400/70 uppercase tracking-wider">IA ativa</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Map card (premium) ───────────────────────────────────────────────────────

function MapCard({
  map,
  onOpen,
  onDelete,
  deleting,
}: {
  map:      GrowthMap
  onOpen:   () => void
  onDelete: () => void
  deleting: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const isActive = map.status === 'active'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onOpen}
      className="relative group rounded-2xl cursor-pointer overflow-hidden"
      style={{
        background: hovered ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.016)',
        border: `1px solid ${hovered ? 'rgba(124,58,237,0.38)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered
          ? '0 0 40px rgba(124,58,237,0.18), 0 16px 40px rgba(0,0,0,0.5)'
          : '0 4px 20px rgba(0,0,0,0.2)',
        transition: 'all 0.3s',
      }}
    >
      {/* Active indicator line */}
      <motion.div
        className="h-px w-full"
        animate={{
          background: isActive
            ? 'linear-gradient(90deg, transparent 5%, rgba(124,58,237,0.65) 50%, transparent 95%)'
            : 'transparent',
        }}
        transition={{ duration: 0.5 }}
      />

      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.div
              animate={isActive ? { boxShadow: ['0 0 0 0px rgba(124,58,237,0.4)', '0 0 0 6px rgba(124,58,237,0)', '0 0 0 0px rgba(124,58,237,0.4)'] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 border border-violet-600/22"
            >
              <Map size={15} className="text-violet-400" />
            </motion.div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white/90 truncate">{map.name}</h3>
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5',
                isActive
                  ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/[0.04] text-white/28 border border-white/[0.06]',
              )}>
                {isActive ? (
                  <>
                    <motion.span
                      className="h-1 w-1 rounded-full bg-emerald-400"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    Ativo
                  </>
                ) : 'Rascunho'}
              </span>
            </div>
          </div>

          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-white/18 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        </div>

        {map.description && (
          <p className="text-[11px] text-white/25 mb-3 line-clamp-2 leading-relaxed">{map.description}</p>
        )}

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] text-white/20">
            <Clock size={9} />
            {map.last_executed_at
              ? `Executado ${new Date(map.last_executed_at).toLocaleDateString('pt-BR')}`
              : 'Nunca executado'}
          </span>
          <motion.span
            animate={{ color: hovered ? '#a78bfa' : 'rgba(124,58,237,0.5)' }}
            className="flex items-center gap-1 text-[11px] font-semibold"
          >
            Abrir <ChevronRight size={11} className={cn('transition-transform', hovered && 'translate-x-0.5')} />
          </motion.span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name,        setName]        = useState('')
  const [templateKey, setTemplateKey] = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  async function handleCreate() {
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch('/api/growth-maps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, templateKey }),
      })
      const data = await res.json() as { id?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'Erro ao criar'); return }
      onCreated(data.id!)
    } finally { setSaving(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: '#0d0d14', border: '1px solid rgba(124,58,237,0.25)' }}
      >
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.7), transparent)' }} />

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/28">
                <Sparkles size={14} className="text-violet-300" />
              </div>
              <h2 className="text-base font-bold text-white">Novo mapa de crescimento</h2>
            </div>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all">
              <X size={14} />
            </button>
          </div>

          <div className="mb-5">
            <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-2">Nome do mapa</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Campanha de Recuperação Q2"
              className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          <div className="mb-5">
            <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-3">Template (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(GROWTH_TEMPLATES).map(([key, tpl]) => {
                const cfg      = TEMPLATE_CONFIG[key] ?? TEMPLATE_CONFIG.recovery
                const Icon     = cfg.icon
                const selected = templateKey === key
                return (
                  <button
                    key={key}
                    onClick={() => { setTemplateKey(selected ? null : key); if (!name) setName(tpl.name) }}
                    className="text-left rounded-xl p-3.5 transition-all"
                    style={{
                      background: selected ? `${cfg.accent}10` : 'rgba(255,255,255,0.018)',
                      border: `1px solid ${selected ? cfg.accent + '40' : 'rgba(255,255,255,0.07)'}`,
                      boxShadow: selected ? `0 0 20px ${cfg.glow}` : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${cfg.accent}14` }}>
                        <Icon size={12} style={{ color: cfg.accent }} />
                      </div>
                      <p className="text-[12px] font-semibold text-white/80">{tpl.name}</p>
                    </div>
                    <p className="text-[10px] text-white/28 line-clamp-2 leading-relaxed">{tpl.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/25 px-3.5 py-2.5 text-[12px] text-red-400 mb-4">
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm text-white/35 hover:text-white/60 border border-white/[0.06] hover:border-white/10 transition-all">
              Cancelar
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={saving || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Criar mapa
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GrowthMapPage() {
  const router      = useRouter()
  const [maps,      setMaps]      = useState<GrowthMap[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const listRef     = useRef<HTMLDivElement>(null)
  const listInView  = useInView(listRef, { once: true, amount: 0.1 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/growth-maps')
      const data = await res.json() as { maps?: GrowthMap[] }
      setMaps(data.maps ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleDelete(id: string) {
    if (!confirm('Remover este mapa?')) return
    setDeleting(id)
    await fetch(`/api/growth-maps/${id}`, { method: 'DELETE' })
    setMaps(m => m.filter(x => x.id !== id))
    setDeleting(null)
  }

  return (
    <div className="relative min-h-screen bg-[#070709] pb-16">
      <FuturisticBackground />

      <div className="relative z-10 px-6 pt-8 max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <motion.div
                className="h-1.5 w-1.5 rounded-full bg-violet-400"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/60">Estratégia Autônoma</span>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-white">Mapa de Crescimento</h1>
            <p className="text-sm text-white/28 mt-0.5">A IA pensa, decide e executa — sua empresa operando sozinha</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
              <Activity size={11} className="text-violet-400" />
              <span className="text-xs font-semibold text-white/55">{maps.filter(m => m.status === 'active').length} ativo{maps.filter(m => m.status === 'active').length !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-600/10 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-600/20 transition-all"
            >
              <Plus size={13} /> Novo mapa
            </button>
          </div>
        </div>

        {/* ── AI Copilot ── */}
        <AICopilotBanner maps={maps} />

        {/* ── Template cards ── */}
        <div className="mb-7">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-white/20 mb-3">Estratégias prontas</p>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {Object.keys(GROWTH_TEMPLATES).map(key => (
              <TemplateMapCard key={key} templateKey={key} onSelect={() => setShowModal(true)} />
            ))}
          </div>
        </div>

        {/* ── Maps list ── */}
        <div ref={listRef}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Brain size={24} className="text-violet-400" />
                </motion.div>
                <p className="text-[11px] text-white/20">IA carregando seus mapas...</p>
              </div>
            </div>
          ) : maps.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}
              >
                <Map size={26} className="text-violet-400/50" />
              </div>
              <h3 className="text-base font-semibold text-white/70 mb-2">Nenhum mapa criado</h3>
              <p className="text-[12px] text-white/22 max-w-xs mb-6 leading-relaxed">
                Crie seu primeiro mapa e deixe a IA definir, executar e medir sua estratégia de crescimento.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 6px 24px rgba(124,58,237,0.35)' }}
              >
                <Plus size={14} /> Criar primeiro mapa
              </button>
            </motion.div>
          ) : (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-white/20 mb-3">Meus mapas</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence>
                  {maps.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={listInView ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: i * 0.06 }}
                    >
                      <MapCard
                        map={m}
                        onOpen={() => router.push(`/dashboard/growth-map/${m.id}`)}
                        onDelete={() => void handleDelete(m.id)}
                        deleting={deleting === m.id}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Add new */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={listInView ? { opacity: 1 } : {}}
                  transition={{ delay: maps.length * 0.06 + 0.1 }}
                  onClick={() => setShowModal(true)}
                  className="flex flex-col items-center justify-center gap-2.5 rounded-2xl py-8 text-white/18 hover:text-violet-400/70 transition-all"
                  style={{ border: '1px dashed rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.008)' }}
                  whileHover={{ borderColor: 'rgba(124,58,237,0.3)' }}
                >
                  <Plus size={18} />
                  <span className="text-[12px] font-medium">Novo mapa</span>
                </motion.button>
              </div>
            </div>
          )}
        </div>

        {/* ── How it works ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={listInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4 }}
          className="mt-10 rounded-2xl overflow-hidden"
          style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.12)' }}
        >
          <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)' }} />
          <div className="p-5 flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 border border-violet-500/22">
              <Zap size={14} className="text-violet-300" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white/70 mb-1.5">Como funciona o Mapa de Crescimento?</p>
              <p className="text-[11px] text-white/25 leading-relaxed">
                Cada mapa é um fluxo visual de blocos conectados. A IA analisa seus dados financeiros e de clientes,
                identifica oportunidades, toma decisões estratégicas, gera mensagens personalizadas e dispara ações reais
                como emails e WhatsApp — tudo automaticamente, em sequência.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Create modal ── */}
      <AnimatePresence>
        {showModal && (
          <CreateModal
            onClose={() => setShowModal(false)}
            onCreated={id => { setShowModal(false); router.push(`/dashboard/growth-map/${id}`) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
