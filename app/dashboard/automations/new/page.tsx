'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Mail, Clock, Zap, Users,
  AlertCircle, ChevronDown, ChevronUp, Save,
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

function uid() {
  return Math.random().toString(36).slice(2)
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  total,
  onChange,
  onRemove,
}: {
  step: Step
  index: number
  total: number
  onChange: (id: string, field: keyof Step, value: string | number) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600/20 border border-violet-600/30 text-violet-400 text-xs font-bold">
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {step.subject || `Email ${index + 1}`}
            </p>
            <p className="text-xs text-zinc-500">
              {index === 0 ? 'Imediato' : `${step.delay_days} dia${step.delay_days !== 1 ? 's' : ''} após email anterior`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 1 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(step.id) }}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
          {open ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800">
          {/* Delay */}
          {index > 0 && (
            <div className="pt-3">
              <label className="block text-xs text-zinc-400 mb-1.5">Aguardar (dias após email anterior)</label>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-zinc-500" />
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={step.delay_days}
                  onChange={e => onChange(step.id, 'delay_days', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
                <span className="text-xs text-zinc-500">dias</span>
              </div>
            </div>
          )}

          {/* Subject */}
          <div className={index === 0 ? 'pt-3' : ''}>
            <label className="block text-xs text-zinc-400 mb-1.5">Assunto do email</label>
            <input
              type="text"
              placeholder="Ex: Olá {nome}, como podemos ajudar?"
              value={step.subject}
              onChange={e => onChange(step.id, 'subject', e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Mensagem
              <span className="ml-2 text-zinc-600 font-normal">Use {'{nome}'} e {'{empresa}'} para personalizar</span>
            </label>
            <textarea
              rows={5}
              placeholder="Escreva o corpo do email aqui..."
              value={step.body_html}
              onChange={e => onChange(step.id, 'body_html', e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none font-mono"
            />
          </div>
        </div>
      )}
    </div>
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
      const payload = {
        name: name.trim(),
        description: description.trim(),
        trigger_type: triggerType,
        steps: steps.map((s, i) => ({
          step_order: i,
          subject: s.subject,
          body_html: s.body_html,
          delay_days: i === 0 ? 0 : s.delay_days,
        })),
      }

      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Erro ao salvar')
      }

      router.push('/dashboard/automations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
      setSaving(false)
    }
  }

  const TRIGGER_OPTIONS = [
    {
      value: 'manual',
      label: 'Manual',
      desc: 'Você dispara manualmente para os clientes selecionados',
      icon: Zap,
      color: 'violet',
    },
    {
      value: 'new_client',
      label: 'Novo cliente',
      desc: 'Dispara automaticamente quando um novo cliente é cadastrado',
      icon: Users,
      color: 'emerald',
    },
    {
      value: 'client_overdue',
      label: 'Cliente inadimplente',
      desc: 'Dispara automaticamente para clientes com cobranças em atraso',
      icon: AlertCircle,
      color: 'orange',
    },
  ] as const

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Back */}
        <Link href="/dashboard/automations" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Voltar para Automações
        </Link>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">Nova Automação</h1>
          <p className="mt-1 text-sm text-zinc-400">Configure a sequência de emails que será enviada automaticamente.</p>
        </div>

        {/* Name & description */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Informações básicas</h2>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Nome da automação *</label>
            <input
              type="text"
              placeholder="Ex: Recuperação de clientes inativos"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Descrição (opcional)</label>
            <input
              type="text"
              placeholder="Breve descrição do objetivo desta automação"
              value={description}
              onChange={e => setDesc(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Trigger */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Gatilho de disparo</h2>

          <div className="space-y-2">
            {TRIGGER_OPTIONS.map(opt => {
              const Icon = opt.icon
              const active = triggerType === opt.value
              const colorMap = {
                violet: {
                  border: active ? 'border-violet-500/60' : 'border-zinc-700 hover:border-zinc-600',
                  bg: active ? 'bg-violet-600/10' : 'bg-zinc-800/50',
                  icon: active ? 'text-violet-400' : 'text-zinc-500',
                  dot: active ? 'bg-violet-500' : 'bg-zinc-700',
                },
                emerald: {
                  border: active ? 'border-emerald-500/60' : 'border-zinc-700 hover:border-zinc-600',
                  bg: active ? 'bg-emerald-600/10' : 'bg-zinc-800/50',
                  icon: active ? 'text-emerald-400' : 'text-zinc-500',
                  dot: active ? 'bg-emerald-500' : 'bg-zinc-700',
                },
                orange: {
                  border: active ? 'border-orange-500/60' : 'border-zinc-700 hover:border-zinc-600',
                  bg: active ? 'bg-orange-600/10' : 'bg-zinc-800/50',
                  icon: active ? 'text-orange-400' : 'text-zinc-500',
                  dot: active ? 'bg-orange-500' : 'bg-zinc-700',
                },
              }
              const c = colorMap[opt.color]

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTrigger(opt.value)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all',
                    c.border, c.bg,
                  )}
                >
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', active ? 'bg-zinc-800' : 'bg-zinc-900')}>
                    <Icon size={15} className={c.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{opt.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
                  </div>
                  <div className={cn('h-3 w-3 rounded-full shrink-0', c.dot)} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
              Sequência de emails ({steps.length})
            </h2>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Mail size={12} /> Apenas email
            </div>
          </div>

          {steps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              total={steps.length}
              onChange={updateStep}
              onRemove={removeStep}
            />
          ))}

          <button
            type="button"
            onClick={addStep}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-500 hover:border-violet-500/50 hover:text-violet-400 hover:bg-violet-600/5 transition-all"
          >
            <Plus size={14} /> Adicionar próximo email
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <Link
            href="/dashboard/automations"
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Criar automação'}
          </button>
        </div>
      </div>
    </div>
  )
}
