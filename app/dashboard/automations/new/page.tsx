'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  ArrowLeft, Plus, Trash2, Mail, Clock, Zap, Users,
  AlertCircle, ChevronDown, Save, Sparkles,
  TrendingUp, Loader2, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string
  subject: string
  body_html: string
  delay_days: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }

// ─── Trigger config ───────────────────────────────────────────────────────────

const TRIGGER_META: Record<string, { label: string; desc: string; icon: React.ElementType; accent: string }> = {
  manual:         { label: 'Manual',       desc: 'Você dispara para os contatos selecionados',  icon: Zap,         accent: '#8b5cf6' },
  new_client:     { label: 'Novo cliente', desc: 'Enviado ao cadastrar um novo cliente',        icon: Users,       accent: '#10b981' },
  client_overdue: { label: 'Inadimplente', desc: 'Para clientes com cobranças em atraso',       icon: AlertCircle, accent: '#f97316' },
}

// ─── Flow Preview (mini) ──────────────────────────────────────────────────────

function MiniFlow({ steps, accent, inView }: { steps: Step[]; accent: string; inView: boolean }) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-10 border border-dashed border-zinc-800 rounded-lg">
        <p className="text-[10px] text-zinc-700">Adicione emails para ver o fluxo</p>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-0.5 scrollbar-none">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center shrink-0">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ delay: 0.04 + i * 0.06, type: 'spring', stiffness: 500, damping: 25 }}
            className="flex flex-col items-center gap-1"
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ background: `${accent}14`, border: `1px solid ${accent}35` }}
            >
              <Mail size={10} style={{ color: accent }} />
            </div>
            <p className="text-[8px] text-zinc-600 max-w-[44px] truncate text-center">
              {i === 0 ? 'Agora' : ['+3d', '+7d', '+14d', '+21d'][i - 1] ?? `+${i * 7}d`}
            </p>
          </motion.div>
          {i < steps.length - 1 && (
            <motion.div
              className="h-px mx-1 shrink-0"
              style={{ width: 20, background: `linear-gradient(90deg, ${accent}35, ${accent}10)` }}
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : {}}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.22 }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step, index, total, accent, onChange, onRemove,
}: {
  step: Step
  index: number
  total: number
  accent: string
  onChange: (id: string, field: keyof Step, value: string | number) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/80 overflow-hidden"
      style={{ boxShadow: open ? `0 0 0 1px ${accent}1a inset` : undefined }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-zinc-800/20 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: `${accent}18`, border: `1px solid ${accent}35`, color: accent }}
          >
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className={cn('text-sm font-medium truncate', step.subject ? 'text-white' : 'text-zinc-500')}>
              {step.subject || `Email ${index + 1}`}
            </p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              {index === 0 ? 'Enviado imediatamente' : `Aguarda ${step.delay_days} dia${step.delay_days !== 1 ? 's' : ''}`}
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3.5 border-t border-zinc-800/60">
              {index > 0 && (
                <div className="pt-3.5">
                  <label className="block text-xs text-zinc-500 mb-2">Aguardar (dias após email anterior)</label>
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

              <div className={index === 0 ? 'pt-3.5' : ''}>
                <label className="block text-xs text-zinc-500 mb-2">Assunto do email</label>
                <input
                  type="text"
                  placeholder="Ex: Olá {nome}, como podemos ajudar?"
                  value={step.subject}
                  onChange={e => onChange(step.id, 'subject', e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700/80 px-3 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-500">Mensagem</label>
                  <span className="text-[10px] text-zinc-700">{'{'+'nome}'}, {'{'+'empresa}'} disponíveis</span>
                </div>
                <textarea
                  rows={5}
                  placeholder="Escreva o corpo do email..."
                  value={step.body_html}
                  onChange={e => onChange(step.id, 'body_html', e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700/80 px-3 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors resize-none font-mono leading-relaxed"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewAutomationPage() {
  const router = useRouter()

  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [triggerType, setTrigger] = useState<'manual' | 'new_client' | 'client_overdue'>('manual')
  const [steps, setSteps]         = useState<Step[]>([
    { id: uid(), subject: '', body_html: '', delay_days: 0 },
  ])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [saved, setSaved]         = useState(false)

  const flowRef = useRef<HTMLDivElement>(null)
  const inView  = useInView(flowRef, { once: true, amount: 0.2 })

  const triggerMeta = TRIGGER_META[triggerType] ?? TRIGGER_META.manual
  const accent = triggerMeta.accent

  function addStep() {
    setSteps(s => [...s, { id: uid(), subject: '', body_html: '', delay_days: 3 }])
  }

  function removeStep(id: string) {
    setSteps(s => s.filter(st => st.id !== id))
  }

  function updateStep(id: string, field: keyof Step, value: string | number) {
    setSteps(s => s.map(st => st.id === id ? { ...st, [field]: value } : st))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Dê um nome para a automação'); return }
    const invalid = steps.find(s => !s.subject.trim() || !s.body_html.trim())
    if (invalid) { setError('Preencha o assunto e a mensagem de todos os emails'); return }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
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
      setSaved(true)
      await new Promise(r => setTimeout(r, 600))
      router.push('/dashboard/automations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">

      {/* ── Sticky header ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-lg">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/automations"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors"
            >
              <ArrowLeft size={13} />
            </Link>
            <div>
              <p className="text-xs text-zinc-600 mb-0.5">Automações</p>
              <p className="text-sm font-semibold text-white">{name || 'Nova automação'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-70 px-4 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            {saved ? (
              <><CheckCircle2 size={11} /> Salvo!</>
            ) : saving ? (
              <><Loader2 size={11} className="animate-spin" /> Criando...</>
            ) : (
              <><Save size={11} /> Criar automação</>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5 pb-16">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
            <Sparkles size={15} style={{ color: accent }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Nova automação</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Configure a sequência de emails que será enviada automaticamente</p>
          </div>
        </div>

        {/* ── Basic info ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Informações básicas</h2>
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Nome da automação <span style={{ color: accent }}>*</span></label>
            <input
              type="text"
              placeholder="Ex: Recuperação de clientes inativos"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700/80 px-3 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Descrição <span className="text-zinc-700">(opcional)</span></label>
            <input
              type="text"
              placeholder="Breve objetivo desta automação"
              value={description}
              onChange={e => setDesc(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700/80 px-3 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        </div>

        {/* ── Trigger ──────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Gatilho de disparo</h2>
          <div className="space-y-2">
            {Object.entries(TRIGGER_META).map(([key, meta]) => {
              const Icon = meta.icon
              const active = triggerType === key
              return (
                <motion.button
                  key={key}
                  type="button"
                  onClick={() => setTrigger(key as typeof triggerType)}
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all"
                  style={{
                    borderColor: active ? `${meta.accent}50` : 'rgb(39 39 42 / 0.8)',
                    background: active ? `${meta.accent}0c` : 'transparent',
                  }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${meta.accent}18` }}
                  >
                    <Icon size={14} style={{ color: meta.accent }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{meta.label}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{meta.desc}</p>
                  </div>
                  <div
                    className="h-3 w-3 rounded-full shrink-0 transition-colors duration-200"
                    style={{ background: active ? meta.accent : 'rgb(63 63 70)' }}
                  />
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* ── Flow preview ─────────────────────────────────────────────── */}
        <div ref={flowRef} className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={12} style={{ color: accent }} />
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Sequência</span>
            </div>
            <span className="text-[10px] text-zinc-600">{steps.length} email{steps.length !== 1 ? 's' : ''}</span>
          </div>
          <MiniFlow steps={steps} accent={accent} inView={inView} />
        </div>

        {/* ── Steps ────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Emails da sequência
            </h2>
            <div className="flex items-center gap-1 text-[10px] text-zinc-700">
              <Mail size={10} /> somente email
            </div>
          </div>

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
            <Plus size={12} /> Adicionar próximo email
          </motion.button>
        </div>

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
        </AnimatePresence>

        {/* ── Bottom actions ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-1 pb-4">
          <Link
            href="/dashboard/automations"
            className="rounded-lg px-4 py-2 text-xs text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-70"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
          >
            {saved ? (
              <><CheckCircle2 size={14} /> Criado!</>
            ) : saving ? (
              <><Loader2 size={14} className="animate-spin" /> Criando...</>
            ) : (
              <><Sparkles size={14} /> Criar automação</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
