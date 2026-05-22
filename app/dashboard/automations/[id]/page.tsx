'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  ArrowLeft, Plus, Trash2, Mail, Clock, Zap, Users,
  AlertCircle, ChevronDown, ChevronUp, Save, Users2,
  CheckCircle2, BarChart3, Loader2, Sparkles, Play,
  Pause, Settings2, Eye, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id?: string
  subject: string
  body_html: string
  delay_days: number
  step_order?: number
}

interface Automation {
  id: string
  name: string
  description: string
  trigger_type: 'manual' | 'new_client' | 'client_overdue'
  status: 'active' | 'inactive' | 'draft'
  created_at: string
  steps: Step[]
  enrolled_count: number
  completed_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }

function localStep(s: Step): Step & { id: string } {
  return { ...s, id: s.id ?? uid() }
}

// ─── Trigger config ───────────────────────────────────────────────────────────

const TRIGGER_META: Record<string, { label: string; desc: string; icon: React.ElementType; accent: string; glow: string }> = {
  manual:         { label: 'Manual',       desc: 'Você dispara manualmente',              icon: Zap,         accent: '#8b5cf6', glow: '#8b5cf640' },
  new_client:     { label: 'Novo cliente', desc: 'Ao cadastrar novo cliente',             icon: Users,       accent: '#10b981', glow: '#10b98140' },
  client_overdue: { label: 'Inadimplente', desc: 'Para clientes com cobranças em atraso', icon: AlertCircle, accent: '#f97316', glow: '#f9731640' },
}

// ─── Flow Preview ─────────────────────────────────────────────────────────────

function FlowPreview({ steps, accent, inView }: { steps: (Step & { id: string })[]; accent: string; inView: boolean }) {
  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-1 scrollbar-none">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-start shrink-0">
          {/* Node */}
          <div className="flex flex-col items-center gap-1.5">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 0.05 + i * 0.08, type: 'spring', stiffness: 500, damping: 24 }}
              className="relative flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: `${accent}14`, border: `1.5px solid ${accent}35` }}
            >
              <Mail size={13} style={{ color: accent }} />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: `1px solid ${accent}` }}
                animate={{ opacity: [0.15, 0.4, 0.15], scale: [1, 1.18, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.12 + i * 0.08 }}
              className="text-center"
            >
              <p className="text-[9px] font-medium text-white/70 max-w-[60px] truncate leading-tight">
                {step.subject || `Email ${i + 1}`}
              </p>
              <p className="text-[8px] mt-0.5" style={{ color: `${accent}70` }}>
                {i === 0 ? 'Agora' : ['+3d', '+7d', '+14d', '+21d', '+30d'][i - 1] ?? `+${i * 7}d`}
              </p>
            </motion.div>
          </div>

          {/* Connector */}
          {i < steps.length - 1 && (
            <motion.div
              className="h-px mt-4 mx-1 shrink-0"
              style={{ width: 28, background: `linear-gradient(90deg, ${accent}40, ${accent}12)` }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={inView ? { scaleX: 1, opacity: 1 } : {}}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.25, ease: 'easeOut' }}
              layoutId={`connector-${i}`}
            />
          )}
        </div>
      ))}

      {/* Add node hint */}
      <div className="flex items-start ml-1 shrink-0">
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-zinc-700"
          >
            <Plus size={11} className="text-zinc-600" />
          </div>
          <p className="text-[8px] text-zinc-700">Adicionar</p>
        </div>
      </div>
    </div>
  )
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step, index, total, accent, onChange, onRemove,
}: {
  step: Step & { id: string }
  index: number
  total: number
  accent: string
  onChange: (id: string, field: keyof Step, value: string | number) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const hasContent = step.subject.trim().length > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/80 overflow-hidden backdrop-blur-sm"
      style={{ boxShadow: open ? `0 0 0 1px ${accent}22 inset` : undefined }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-zinc-800/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          {/* Step number */}
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: `${accent}18`, border: `1px solid ${accent}35`, color: accent }}
          >
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className={cn('text-sm font-medium truncate', hasContent ? 'text-white' : 'text-zinc-500')}>
              {step.subject || `Email ${index + 1} — sem assunto`}
            </p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              {index === 0 ? 'Enviado imediatamente' : `Aguarda ${step.delay_days} dia${step.delay_days !== 1 ? 's' : ''} após anterior`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {total > 1 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(step.id) }}
              className="p-1.5 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-zinc-600" />
          </motion.div>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3.5 border-t border-zinc-800/80">
              {/* Delay */}
              {index > 0 && (
                <div className="pt-3.5">
                  <label className="block text-xs text-zinc-500 mb-2">Aguardar após email anterior</label>
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-zinc-600" />
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={step.delay_days}
                      onChange={e => onChange(step.id, 'delay_days', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 rounded-lg bg-zinc-800 border border-zinc-700/80 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <span className="text-xs text-zinc-600">dias</span>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div className={index === 0 ? 'pt-3.5' : ''}>
                <label className="block text-xs text-zinc-500 mb-2">Assunto</label>
                <input
                  type="text"
                  placeholder="Ex: Olá {nome}, temos algo especial para você"
                  value={step.subject}
                  onChange={e => onChange(step.id, 'subject', e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700/80 px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-500">Mensagem</label>
                  <span className="text-[10px] text-zinc-700">{'{'+'nome}'}, {'{'+'empresa}'} disponíveis</span>
                </div>
                <textarea
                  rows={6}
                  placeholder="Escreva o corpo do email..."
                  value={step.body_html}
                  onChange={e => onChange(step.id, 'body_html', e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700/80 px-3 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Preview snippet */}
              {step.body_html.trim() && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Eye size={10} className="text-zinc-600" />
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wide">Preview</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {step.body_html.split('\n').map(l => l.trim()).filter(l => l.length > 3).slice(0, 2).join(' ')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditAutomationPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [auto, setAuto]           = useState<Automation | null>(null)
  const [loading, setLoading]     = useState(true)
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [triggerType, setTrigger] = useState<Automation['trigger_type']>('manual')
  const [steps, setSteps]         = useState<(Step & { id: string })[]>([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [toggling, setToggling]   = useState(false)
  const [activeTab, setTab]       = useState<'sequencia' | 'configuracoes'>('sequencia')

  const flowRef = useRef<HTMLDivElement>(null)
  const inView  = useInView(flowRef, { once: true, amount: 0.2 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/automations/${id}`)
      if (!r.ok) throw new Error('Not found')
      const data = await r.json() as Automation
      setAuto(data)
      setName(data.name)
      setDesc(data.description)
      setTrigger(data.trigger_type)
      setSteps(data.steps.map(localStep))
    } catch {
      setError('Automação não encontrada')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  function addStep() {
    setSteps(s => [...s, { id: uid(), subject: '', body_html: '', delay_days: 3 }])
  }

  function removeStep(sid: string) {
    setSteps(s => s.filter(st => st.id !== sid))
  }

  function updateStep(sid: string, field: keyof Step, value: string | number) {
    setSteps(s => s.map(st => st.id === sid ? { ...st, [field]: value } : st))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Dê um nome para a automação'); return }
    const invalid = steps.find(s => !s.subject.trim() || !s.body_html.trim())
    if (invalid) { setError('Preencha o assunto e a mensagem de todos os emails'); return }

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          trigger_type: triggerType,
          steps: steps.map((s, i) => ({
            step_order: i,
            subject: s.subject,
            body_html: s.body_html,
            delay_days: i === 0 ? 0 : s.delay_days,
          })),
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Erro ao salvar')
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle() {
    if (!auto) return
    setToggling(true)
    try {
      const res = await fetch(`/api/automations/${id}/toggle`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const d = await res.json() as { status: string }
      setAuto(a => a ? { ...a, status: d.status as Automation['status'] } : a)
    } finally {
      setToggling(false)
    }
  }

  // ─── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles size={22} className="text-violet-500" />
          </motion.div>
          <p className="text-xs text-zinc-600">Carregando automação...</p>
        </div>
      </div>
    )
  }

  if (error && !auto) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-4">
        <AlertCircle size={28} className="text-red-400" />
        <p className="text-sm text-zinc-400">{error}</p>
        <Link href="/dashboard/automations" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
          ← Voltar para Automações
        </Link>
      </div>
    )
  }

  const triggerMeta = TRIGGER_META[triggerType] ?? TRIGGER_META.manual
  const accent = triggerMeta.accent
  const isActive = auto?.status === 'active'

  return (
    <div className="min-h-screen bg-zinc-950">

      {/* ── Sticky header ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-lg">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard/automations"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors"
            >
              <ArrowLeft size={13} />
            </Link>
            <div className="min-w-0">
              <p className="text-xs text-zinc-600 mb-0.5">Automações</p>
              <p className="text-sm font-semibold text-white truncate">{auto?.name ?? name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status toggle */}
            <button
              type="button"
              onClick={handleToggle}
              disabled={toggling}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                isActive
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
              )}
            >
              {toggling ? (
                <Loader2 size={11} className="animate-spin" />
              ) : isActive ? (
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              ) : (
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
              )}
              {isActive ? 'Ativa' : 'Inativa'}
            </button>

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-4 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6 pb-24">

        {/* ── Stats row ───────────────────────────────────────────────── */}
        {auto && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Inscritos',  value: auto.enrolled_count,  icon: Users2,        color: accent },
              { label: 'Completos',  value: auto.completed_count, icon: CheckCircle2,  color: '#10b981' },
              { label: 'Emails',     value: steps.length,          icon: Mail,          color: '#6b7280' },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3.5 text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Icon size={12} style={{ color: stat.color }} />
                    <span className="text-lg font-bold text-white">{stat.value}</span>
                  </div>
                  <p className="text-[11px] text-zinc-600">{stat.label}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Flow preview ─────────────────────────────────────────────── */}
        <div ref={flowRef} className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} style={{ color: accent }} />
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Sequência de disparo</span>
            </div>
            <span className="text-[10px] text-zinc-600">{steps.length} email{steps.length !== 1 ? 's' : ''}</span>
          </div>

          {steps.length > 0 ? (
            <FlowPreview steps={steps} accent={accent} inView={inView} />
          ) : (
            <div className="flex items-center justify-center h-16 border border-dashed border-zinc-800 rounded-lg">
              <p className="text-xs text-zinc-700">Adicione emails para visualizar a sequência</p>
            </div>
          )}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-zinc-900/60 rounded-xl p-1 border border-zinc-800/60">
          {[
            { key: 'sequencia',      label: 'Sequência',    icon: Mail },
            { key: 'configuracoes',  label: 'Configurações', icon: Settings2 },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTab(tab.key as typeof activeTab)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all',
                  active
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-600 hover:text-zinc-400',
                )}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Tab: Sequência ───────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === 'sequencia' && (
            <motion.div
              key="seq"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <AnimatePresence>
                {steps.map((step, i) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={i}
                    total={steps.length}
                    accent={accent}
                    onChange={updateStep}
                    onRemove={removeStep}
                  />
                ))}
              </AnimatePresence>

              <motion.button
                type="button"
                onClick={addStep}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 py-3.5 text-xs text-zinc-600 hover:border-violet-500/40 hover:text-violet-400 hover:bg-violet-600/5 transition-all"
              >
                <Plus size={13} /> Adicionar próximo email
              </motion.button>
            </motion.div>
          )}

          {/* ── Tab: Configurações ───────────────────────────────────────── */}
          {activeTab === 'configuracoes' && (
            <motion.div
              key="cfg"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {/* Basic info */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-4">
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Informações básicas</h2>
                <div>
                  <label className="block text-xs text-zinc-500 mb-2">Nome da automação</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-2">Descrição <span className="text-zinc-700">(opcional)</span></label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="Breve descrição do objetivo"
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700/80 px-3 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              {/* Trigger */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-3">
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Gatilho de disparo</h2>
                <div className="space-y-2">
                  {Object.entries(TRIGGER_META).map(([key, meta]) => {
                    const Icon = meta.icon
                    const active = triggerType === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTrigger(key as Automation['trigger_type'])}
                        className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all"
                        style={{
                          borderColor: active ? `${meta.accent}50` : 'rgb(39 39 42 / 0.8)',
                          background: active ? `${meta.accent}0c` : 'transparent',
                        }}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `${meta.accent}14` }}
                        >
                          <Icon size={14} style={{ color: meta.accent }} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-white">{meta.label}</p>
                          <p className="text-xs text-zinc-600 mt-0.5">{meta.desc}</p>
                        </div>
                        <div
                          className="h-3 w-3 rounded-full shrink-0 transition-colors"
                          style={{ background: active ? meta.accent : 'rgb(63 63 70)' }}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Feedback ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="err"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-xl bg-red-500/8 border border-red-500/25 px-4 py-3 text-sm text-red-400"
            >
              <AlertCircle size={13} /> {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-xl bg-emerald-500/8 border border-emerald-500/25 px-4 py-3 text-sm text-emerald-400"
            >
              <CheckCircle2 size={13} /> Automação salva com sucesso!
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
