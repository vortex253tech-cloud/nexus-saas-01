'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Mail, Clock, Zap, Users,
  AlertCircle, ChevronDown, ChevronUp, Save, Users2,
  CheckCircle2, BarChart3, Loader2,
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

function localStep(s: Step) {
  return { ...s, id: s.id ?? uid() }
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  total,
  onChange,
  onRemove,
}: {
  step: Step & { id: string }
  index: number
  total: number
  onChange: (id: string, field: keyof Step, value: string | number) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600/20 border border-violet-600/30 text-violet-400 text-xs font-bold">
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{step.subject || `Email ${index + 1}`}</p>
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

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800">
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
                  onChange={e => onChange(step.id!, 'delay_days', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
                <span className="text-xs text-zinc-500">dias</span>
              </div>
            </div>
          )}

          <div className={index === 0 ? 'pt-3' : ''}>
            <label className="block text-xs text-zinc-400 mb-1.5">Assunto do email</label>
            <input
              type="text"
              value={step.subject}
              onChange={e => onChange(step.id!, 'subject', e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Mensagem
              <span className="ml-2 text-zinc-600 font-normal">Use {'{nome}'} e {'{empresa}'} para personalizar</span>
            </label>
            <textarea
              rows={5}
              value={step.body_html}
              onChange={e => onChange(step.id!, 'body_html', e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none font-mono"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditAutomationPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [auto, setAuto]           = useState<Automation | null>(null)
  const [loading, setLoading]     = useState(true)
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [triggerType, setTrigger] = useState<Automation['trigger_type']>('manual')
  const [steps, setSteps]         = useState<(Step & { id: string })[]>([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

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
      setSteps(data.steps.map(localStep) as (Step & { id: string })[])
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

  // ─── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <Loader2 size={24} className="text-violet-400 animate-spin" />
      </div>
    )
  }

  if (error && !auto) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-zinc-400">{error}</p>
        <Link href="/dashboard/automations" className="text-sm text-violet-400 hover:text-violet-300">
          Voltar para Automações
        </Link>
      </div>
    )
  }

  const TRIGGER_OPTIONS = [
    { value: 'manual' as const, label: 'Manual', icon: Zap, color: 'violet' },
    { value: 'new_client' as const, label: 'Novo cliente', icon: Users, color: 'emerald' },
    { value: 'client_overdue' as const, label: 'Inadimplente', icon: AlertCircle, color: 'orange' },
  ]

  const triggerColorMap = {
    manual: 'violet',
    new_client: 'emerald',
    client_overdue: 'orange',
  } as const

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Back */}
        <Link href="/dashboard/automations" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Voltar para Automações
        </Link>

        {/* Title + stats */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{auto?.name}</h1>
            <p className="mt-1 text-sm text-zinc-400">Editar configurações e sequência de emails</p>
          </div>
          {auto && (
            <div className="flex gap-3 shrink-0">
              <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-center">
                <div className="flex items-center gap-1.5 text-violet-400 mb-0.5">
                  <Users2 size={12} />
                  <span className="text-xs font-semibold">{auto.enrolled_count}</span>
                </div>
                <p className="text-[10px] text-zinc-600">Inscritos</p>
              </div>
              <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-center">
                <div className="flex items-center gap-1.5 text-emerald-400 mb-0.5">
                  <CheckCircle2 size={12} />
                  <span className="text-xs font-semibold">{auto.completed_count}</span>
                </div>
                <p className="text-[10px] text-zinc-600">Completos</p>
              </div>
              <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-center">
                <div className="flex items-center gap-1.5 text-zinc-400 mb-0.5">
                  <BarChart3 size={12} />
                  <span className="text-xs font-semibold">{steps.length}</span>
                </div>
                <p className="text-[10px] text-zinc-600">Emails</p>
              </div>
            </div>
          )}
        </div>

        {/* Name & description */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Informações básicas</h2>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={e => setDesc(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Trigger */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Gatilho de disparo</h2>
          <div className="flex gap-2">
            {TRIGGER_OPTIONS.map(opt => {
              const Icon = opt.icon
              const active = triggerType === opt.value
              const colorClasses = {
                violet:  { border: active ? 'border-violet-500/60 bg-violet-600/10' : '', icon: active ? 'text-violet-400' : 'text-zinc-500' },
                emerald: { border: active ? 'border-emerald-500/60 bg-emerald-600/10' : '', icon: active ? 'text-emerald-400' : 'text-zinc-500' },
                orange:  { border: active ? 'border-orange-500/60 bg-orange-600/10' : '', icon: active ? 'text-orange-400' : 'text-zinc-500' },
              }
              const c = colorClasses[opt.color as keyof typeof colorClasses]
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTrigger(opt.value)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-3 text-center transition-all hover:border-zinc-600',
                    c.border,
                  )}
                >
                  <Icon size={16} className={c.icon} />
                  <span className="text-xs font-medium text-white">{opt.label}</span>
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

        {/* Feedback */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400">
            <CheckCircle2 size={14} /> Automação salva com sucesso!
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <button
            type="button"
            onClick={() => router.push('/dashboard/automations')}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
