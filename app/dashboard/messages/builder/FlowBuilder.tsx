'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  MousePointer, Users, AlertTriangle, Plus, Trash2,
  Save, ArrowLeft, ChevronDown, Eye, EyeOff, GripVertical,
  Mail, Clock, Zap, CheckCircle2, Circle,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Step {
  id: string
  delay_days: number
  subject: string
  body_html: string
}

type TriggerType = 'manual' | 'new_client' | 'client_overdue'

export interface FlowBuilderProps {
  initialData?: {
    id?: string
    name: string
    description: string
    trigger_type: TriggerType
    steps: Step[]
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TRIGGERS = [
  {
    value: 'manual' as TriggerType,
    label: 'Manual',
    icon: MousePointer,
    description: 'Disparado manualmente por você',
    color: 'text-zinc-400',
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
  },
  {
    value: 'new_client' as TriggerType,
    label: 'Novo cliente',
    icon: Users,
    description: 'Quando um cliente é adicionado',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
  },
  {
    value: 'client_overdue' as TriggerType,
    label: 'Cliente inadimplente',
    icon: AlertTriangle,
    description: 'Quando um pagamento vence',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
]

const VARIABLES = [
  { label: '{{nome}}',        description: 'Nome do cliente' },
  { label: '{{empresa}}',     description: 'Nome da empresa' },
  { label: '{{valor}}',       description: 'Valor em aberto' },
  { label: '{{vencimento}}',  description: 'Data de vencimento' },
  { label: '{{produto}}',     description: 'Nome do produto' },
  { label: '{{link_pagamento}}', description: 'Link de pagamento' },
]

const SAMPLE_VALUES: Record<string, string> = {
  '{{nome}}':           'João Silva',
  '{{empresa}}':        'Minha Empresa',
  '{{valor}}':          'R$ 1.500,00',
  '{{vencimento}}':     '30/04/2025',
  '{{produto}}':        'Plano Pro',
  '{{link_pagamento}}': 'https://pay.exemplo.com/abc123',
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function renderPreview(html: string): string {
  let out = html
  for (const [variable, sample] of Object.entries(SAMPLE_VALUES)) {
    out = out.replaceAll(variable, `<strong class="text-violet-400">${sample}</strong>`)
  }
  return out
}

// ─── Step Card (left panel) ─────────────────────────────────────────────────

function StepCard({
  step,
  index,
  selected,
  onSelect,
  onDelete,
}: {
  step: Step
  index: number
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all',
        selected
          ? 'bg-violet-500/10 border-violet-500/40'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
      )}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700">
        <Mail size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white">
          {step.subject || `Passo ${index + 1}`}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Clock size={10} />
          <span>
            {step.delay_days === 0
              ? 'Enviar imediatamente'
              : `Aguardar ${step.delay_days} dia${step.delay_days !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="invisible shrink-0 rounded p-1 text-zinc-600 hover:text-red-400 group-hover:visible"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function FlowBuilder({ initialData }: FlowBuilderProps) {
  const router = useRouter()
  const isEdit = Boolean(initialData?.id)

  const [name,        setName]        = useState(initialData?.name ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [trigger,     setTrigger]     = useState<TriggerType>(initialData?.trigger_type ?? 'manual')
  const [steps,       setSteps]       = useState<Step[]>(
    initialData?.steps?.map((s) => ({ ...s, id: s.id ?? makeId() })) ?? []
  )

  const [selectedStep,  setSelectedStep]  = useState<string | null>(null)
  const [configOpen,    setConfigOpen]    = useState(false)
  const [triggerOpen,   setTriggerOpen]   = useState(false)
  const [showPreview,   setShowPreview]   = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const activeStep = steps.find((s) => s.id === selectedStep) ?? null

  function addStep() {
    const id = makeId()
    setSteps((prev) => [...prev, { id, delay_days: prev.length === 0 ? 0 : 1, subject: '', body_html: '' }])
    setSelectedStep(id)
    setConfigOpen(false)
  }

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function deleteStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id))
    setSelectedStep((cur) => (cur === id ? null : cur))
  }

  function insertVariable(variable: string) {
    const ta = bodyRef.current
    if (!ta || !activeStep) return
    const start = ta.selectionStart ?? 0
    const end   = ta.selectionEnd   ?? 0
    const next  = activeStep.body_html.slice(0, start) + variable + activeStep.body_html.slice(end)
    updateStep(activeStep.id, { body_html: next })
    const cursor = start + variable.length
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(cursor, cursor)
    })
  }

  async function handleSave() {
    if (!name.trim()) { showToast('Nome do fluxo é obrigatório', 'err'); return }
    if (steps.length === 0) { showToast('Adicione pelo menos um passo', 'err'); return }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        trigger_type: trigger,
        steps: steps.map((s, i) => ({
          step_order: i,
          delay_days: s.delay_days,
          subject:    s.subject,
          body_html:  s.body_html,
        })),
      }

      let url    = '/api/automations'
      let method = 'POST'
      if (isEdit && initialData?.id) {
        url    = `/api/automations/${initialData.id}`
        method = 'PUT'
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Erro ao salvar')
      }

      showToast(isEdit ? 'Fluxo atualizado!' : 'Fluxo criado!')
      setTimeout(() => router.push('/dashboard/messages'), 800)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  const selectedTrigger = TRIGGERS.find((t) => t.value === trigger)!

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, trigger, steps])

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white">
      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800/60 bg-zinc-950/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/messages')}
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do fluxo..."
              className="w-64 bg-transparent text-sm font-semibold text-white placeholder-zinc-600 outline-none"
            />
            <p className="text-[10px] text-zinc-600">
              {steps.length} passo{steps.length !== 1 ? 's' : ''} · {selectedTrigger.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              configOpen
                ? 'bg-violet-600/20 text-violet-400 border border-violet-600/30'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white border border-transparent',
            )}
          >
            Configurar
            <ChevronDown size={12} className={cn('transition-transform', configOpen && 'rotate-180')} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            <Save size={13} />
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar fluxo'}
          </button>
        </div>
      </div>

      {/* ── Config panel (collapsible) ── */}
      {configOpen && (
        <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-900/50 px-5 py-4">
          <div className="flex gap-6">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Descrição
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo deste fluxo..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="w-72 space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Gatilho
              </label>
              <div className="relative">
                <button
                  onClick={() => setTriggerOpen(!triggerOpen)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white hover:border-zinc-700"
                >
                  <div className="flex items-center gap-2">
                    <selectedTrigger.icon size={13} className={selectedTrigger.color} />
                    {selectedTrigger.label}
                  </div>
                  <ChevronDown size={12} className={cn('text-zinc-500 transition-transform', triggerOpen && 'rotate-180')} />
                </button>
                {triggerOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
                    {TRIGGERS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => { setTrigger(t.value); setTriggerOpen(false) }}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-zinc-800"
                      >
                        <t.icon size={14} className={cn('mt-0.5 shrink-0', t.color)} />
                        <div>
                          <p className="text-xs font-medium text-white">{t.label}</p>
                          <p className="text-[10px] text-zinc-500">{t.description}</p>
                        </div>
                        {t.value === trigger && <CheckCircle2 size={14} className="ml-auto shrink-0 text-violet-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main area: left (flow) + right (editor) ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: flow diagram */}
        <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-zinc-800/60 bg-zinc-950 p-4">
          {/* Trigger node */}
          <div
            onClick={() => { setConfigOpen(true); setSelectedStep(null) }}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all',
              selectedTrigger.bg, selectedTrigger.border,
            )}
          >
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', selectedTrigger.bg)}>
              <selectedTrigger.icon size={14} className={selectedTrigger.color} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Gatilho</p>
              <p className="text-xs font-medium text-white">{selectedTrigger.label}</p>
            </div>
          </div>

          {/* Connector + steps */}
          {steps.map((step, i) => (
            <div key={step.id} className="relative">
              {/* Arrow connector */}
              <div className="mx-auto flex w-px flex-col items-center py-1">
                <div className="h-4 w-px bg-zinc-800" />
                <Zap size={10} className="text-zinc-700" />
                <div className="h-4 w-px bg-zinc-800" />
              </div>

              <StepCard
                step={step}
                index={i}
                selected={selectedStep === step.id}
                onSelect={() => { setSelectedStep(step.id); setConfigOpen(false) }}
                onDelete={() => deleteStep(step.id)}
              />
            </div>
          ))}

          {/* Add step */}
          <div className="relative">
            {steps.length > 0 && (
              <div className="mx-auto flex w-px flex-col items-center py-1">
                <div className="h-6 w-px bg-zinc-800" />
              </div>
            )}
            <button
              onClick={addStep}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-3 text-xs font-medium text-zinc-500 transition-colors hover:border-violet-500/50 hover:text-violet-400"
            >
              <Plus size={13} />
              Adicionar passo
            </button>
          </div>

          {/* Done node */}
          {steps.length > 0 && (
            <>
              <div className="mx-auto flex w-px flex-col items-center py-1">
                <div className="h-6 w-px bg-zinc-800" />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 opacity-60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Fim</p>
                  <p className="text-xs font-medium text-zinc-400">Fluxo completo</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: editor or empty state */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {activeStep ? (
            <StepEditor
              step={activeStep}
              index={steps.findIndex((s) => s.id === activeStep.id)}
              onChange={(patch) => updateStep(activeStep.id, patch)}
              onDelete={() => deleteStep(activeStep.id)}
              bodyRef={bodyRef}
              insertVariable={insertVariable}
              showPreview={showPreview}
              setShowPreview={setShowPreview}
            />
          ) : (
            <EmptyRight
              hasSteps={steps.length > 0}
              onAddStep={addStep}
              onOpenConfig={() => setConfigOpen(true)}
            />
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl',
          toast.type === 'ok'
            ? 'bg-zinc-900 border-zinc-700 text-white'
            : 'bg-red-950 border-red-700/50 text-red-300',
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Step Editor ────────────────────────────────────────────────────────────

function StepEditor({
  step,
  index,
  onChange,
  onDelete,
  bodyRef,
  insertVariable,
  showPreview,
  setShowPreview,
}: {
  step: Step
  index: number
  onChange: (patch: Partial<Step>) => void
  onDelete: () => void
  bodyRef: React.RefObject<HTMLTextAreaElement | null>
  insertVariable: (v: string) => void
  showPreview: boolean
  setShowPreview: (v: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Step header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
            <Mail size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Passo {index + 1}</p>
            <p className="text-[10px] text-zinc-500">E-mail automático</p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <Trash2 size={13} />
          Remover passo
        </button>
      </div>

      {/* Delay */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Atraso de envio
        </label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            <Clock size={13} className="text-zinc-500" />
            <input
              type="number"
              min={0}
              max={365}
              value={step.delay_days}
              onChange={(e) => onChange({ delay_days: Number(e.target.value) })}
              className="w-16 bg-transparent text-sm text-white outline-none"
            />
            <span className="text-xs text-zinc-500">dia{step.delay_days !== 1 ? 's' : ''} após o passo anterior</span>
          </div>
          {step.delay_days === 0 && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
              Imediato
            </span>
          )}
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Assunto do e-mail
        </label>
        <input
          value={step.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="Ex: Oi {{nome}}, como posso te ajudar?"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50"
        />
      </div>

      {/* Variables */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Variáveis dinâmicas — clique para inserir no corpo
        </label>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map((v) => (
            <button
              key={v.label}
              onClick={() => insertVariable(v.label)}
              title={v.description}
              className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono text-[11px] text-violet-300 hover:border-violet-500/50 hover:bg-violet-500/10 transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body + preview toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Corpo do e-mail
          </label>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
            {showPreview ? 'Editar' : 'Preview'}
          </button>
        </div>

        {showPreview ? (
          <div
            className="min-h-64 rounded-xl border border-zinc-800 bg-white p-5 text-sm text-zinc-800"
            dangerouslySetInnerHTML={{ __html: renderPreview(step.body_html) }}
          />
        ) : (
          <textarea
            ref={bodyRef}
            value={step.body_html}
            onChange={(e) => onChange({ body_html: e.target.value })}
            placeholder={`Olá {{nome}},\n\nEscreva sua mensagem aqui...\n\nAbraços,\n{{empresa}}`}
            rows={14}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 font-mono text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 resize-none"
          />
        )}
      </div>

      {/* Footer tip */}
      <p className="text-[11px] text-zinc-600">
        Tip: Coloque o cursor onde quer inserir e clique em uma variável acima. Ctrl+S salva o fluxo.
      </p>
    </div>
  )
}

// ─── Empty right panel ───────────────────────────────────────────────────────

function EmptyRight({
  hasSteps,
  onAddStep,
  onOpenConfig,
}: {
  hasSteps: boolean
  onAddStep: () => void
  onOpenConfig: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      {hasSteps ? (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
            <GripVertical size={24} className="text-zinc-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Selecione um passo</p>
            <p className="mt-1 text-xs text-zinc-500">Clique em um passo na barra lateral para editar</p>
          </div>
          <button
            onClick={onAddStep}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            <Plus size={15} />
            Adicionar passo
          </button>
        </>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/15">
            <Circle size={24} className="text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Comece seu fluxo</p>
            <p className="mt-1 text-xs text-zinc-500 max-w-xs">
              Configure o gatilho e adicione passos para automatizar sua comunicação
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onOpenConfig}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Configurar gatilho
            </button>
            <button
              onClick={onAddStep}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              <Plus size={15} />
              Primeiro passo
            </button>
          </div>
        </>
      )}
    </div>
  )
}
