'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Check, ChevronRight, Upload, X, Brain,
  MessageSquare, CreditCard, Mail, Globe,
  TrendingUp, AlertTriangle, Users, ArrowRight, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Static data ──────────────────────────────────────────────

const SEGMENTS = [
  { value: 'ecommerce',    label: 'E-commerce',   emoji: '🛒' },
  { value: 'servicos',     label: 'Serviços',      emoji: '🤝' },
  { value: 'tech',         label: 'Tech / SaaS',   emoji: '⚡' },
  { value: 'consultoria',  label: 'Consultoria',   emoji: '📊' },
  { value: 'varejo',       label: 'Varejo',        emoji: '🏪' },
  { value: 'saude',        label: 'Saúde',         emoji: '🏥' },
  { value: 'educacao',     label: 'Educação',      emoji: '📚' },
  { value: 'outro',        label: 'Outro',         emoji: '🏢' },
]

const TEAM_SIZES = ['1–5', '6–20', '21–50', '51–200', '200+']

const OBJECTIVES = [
  { value: 'vendas',       label: 'Aumentar vendas' },
  { value: 'inadimplencia',label: 'Reduzir inadimplência' },
  { value: 'automacao',    label: 'Automatizar operação' },
  { value: 'produtividade',label: 'Melhorar produtividade' },
  { value: 'leads',        label: 'Gerar mais leads' },
  { value: 'cobrancas',    label: 'Automatizar cobranças' },
]

const PERSONALITIES = [
  { value: 'premium',     label: 'Premium',      desc: 'Exclusivo, refinado, sofisticado' },
  { value: 'formal',      label: 'Formal',       desc: 'Profissional, direto, corporativo' },
  { value: 'humanizado',  label: 'Humanizado',   desc: 'Empático, acolhedor, próximo' },
  { value: 'comercial',   label: 'Comercial',    desc: 'Persuasivo, orientado a resultados' },
  { value: 'moderno',     label: 'Moderno',      desc: 'Ágil, inovador, direto ao ponto' },
]

const CHANNELS = [
  { id: 'whatsapp',    label: 'WhatsApp',     icon: MessageSquare, color: '#22c55e' },
  { id: 'stripe',      label: 'Stripe',       icon: CreditCard,    color: '#6366f1' },
  { id: 'email',       label: 'Email',        icon: Mail,          color: '#06b6d4' },
  { id: 'instagram',   label: 'Instagram',    icon: Globe,         color: '#ec4899' },
  { id: 'mercadopago', label: 'Mercado Pago', icon: CreditCard,    color: '#facc15' },
  { id: 'api',         label: 'API Externa',  icon: Globe,         color: '#8b5cf6' },
]

// ─── Helpers ─────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Background ──────────────────────────────────────────────

function NeuralBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Base */}
      <div className="absolute inset-0" style={{ background: '#0A0E16' }} />

      {/* Grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────

const STEP_LABELS = ['Boot', 'Empresa', 'Objetivos', 'Personalidade', 'Canais', 'Treino', 'Ativação']

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-500',
            i < step ? 'bg-violet-600 text-white' :
            i === step ? 'bg-violet-600/20 text-violet-400 ring-1 ring-violet-500' :
            'bg-zinc-900 text-zinc-600',
          )}>
            {i < step ? <Check size={10} /> : i + 1}
          </div>
          <span className={cn(
            'hidden text-[11px] font-medium lg:block transition-colors',
            i === step ? 'text-violet-400' : i < step ? 'text-zinc-500' : 'text-zinc-700',
          )}>
            {label}
          </span>
          {i < total - 1 && (
            <div className={cn(
              'hidden h-px w-6 transition-colors lg:block',
              i < step ? 'bg-violet-600' : 'bg-zinc-800',
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 0: Boot ─────────────────────────────────────────────

function BootStep({ onStart }: { onStart: () => void }) {
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      {/* Boot icon */}
      <div className="relative mb-12">
        <div
          className="relative flex h-24 w-24 items-center justify-center rounded-full border border-violet-700/40"
          style={{ background: 'rgba(37,99,235,0.12)' }}
        >
          <Brain size={38} className="text-violet-300" />
        </div>
      </div>

      {/* Boot lines */}
      <AnimatePresence mode="wait">
        {!booted ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2 mb-8"
          >
            {['Inicializando núcleo IA…', 'Carregando agentes operacionais…', 'Preparando seu ambiente…'].map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.35 }}
                className="text-xs font-mono text-violet-500/60"
              >
                <span className="text-violet-400/50 mr-2">›</span>{line}
              </motion.p>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <motion.p
              className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: '#60a5fa' }}
            >
              Sistema operacional IA
            </motion.p>
            <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">
              NEXUS IA está pronta para{' '}
              <span className="text-violet-400">
                conhecer sua empresa.
              </span>
            </h1>
            <p className="text-zinc-400 text-lg max-w-md mx-auto">
              Vamos configurar sua operação inteligente em menos de 3 minutos.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: booted ? 1 : 0, scale: booted ? 1 : 0.95 }}
        transition={{ delay: 0.2 }}
        onClick={onStart}
        className="group relative flex items-center gap-3 rounded-2xl px-8 py-4 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
      >
        <Zap size={18} className="text-violet-200" />
        Inicializar NEXUS
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </motion.button>
    </div>
  )
}

// ─── Step 1: Company identity ─────────────────────────────────

function CompanyStep({
  data, onChange, onNext, onBack, saving,
}: {
  data: { name: string; segment: string; teamSize: string }
  onChange: (k: string, v: string) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  const canContinue = data.name.trim() && data.segment && data.teamSize

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-3">Passo 1 de 6</p>
        <h2 className="text-3xl font-bold text-white mb-2">Identidade da empresa</h2>
        <p className="text-zinc-400">A IA aprende com cada detalhe sobre o seu negócio.</p>
      </div>

      {/* Company name */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-zinc-300">Nome da empresa</label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Ex: Agência Vortex"
          className="w-full rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3 text-white placeholder-zinc-600 outline-none backdrop-blur-sm transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
        />
      </div>

      {/* Segment */}
      <div className="mb-6">
        <label className="mb-3 block text-sm font-medium text-zinc-300">Segmento</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SEGMENTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange('segment', s.value)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm transition-all',
                data.segment === s.value
                  ? 'border-violet-500 bg-violet-600/10 text-white'
                  : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600',
              )}
            >
              <span className="text-lg">{s.emoji}</span>
              <span className="font-medium text-xs">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Team size */}
      <div className="mb-8">
        <label className="mb-3 block text-sm font-medium text-zinc-300">Tamanho do time</label>
        <div className="flex flex-wrap gap-2">
          {TEAM_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onChange('teamSize', size)}
              className={cn(
                'rounded-xl border px-4 py-2 text-sm font-medium transition-all',
                data.teamSize === size
                  ? 'border-violet-500 bg-violet-600/15 text-violet-300'
                  : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600',
              )}
            >
              {size} pessoas
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="rounded-xl border border-zinc-800 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600">
          Voltar
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue || saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : <>Continuar <ChevronRight size={14} /></>}
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Objectives ───────────────────────────────────────

function ObjectivesStep({
  objectives, challenge,
  onToggleObjective, onChallenge,
  onNext, onBack, saving,
}: {
  objectives: string[]
  challenge: string
  onToggleObjective: (v: string) => void
  onChallenge: (v: string) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  const CHALLENGES = [
    'Falta de visibilidade financeira',
    'Processos manuais lentos',
    'Alta taxa de churn',
    'Dificuldade para escalar vendas',
    'Inadimplência elevada',
    'Time sobrecarregado',
  ]

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-3">Passo 2 de 6</p>
        <h2 className="text-3xl font-bold text-white mb-2">Objetivos principais</h2>
        <p className="text-zinc-400">A IA vai priorizar ações que movem o ponteiro do que mais importa.</p>
      </div>

      <div className="mb-6">
        <label className="mb-3 block text-sm font-medium text-zinc-300">O que você quer alcançar? <span className="text-zinc-500">(selecione até 3)</span></label>
        <div className="grid grid-cols-2 gap-2">
          {OBJECTIVES.map((obj) => {
            const selected = objectives.includes(obj.value)
            return (
              <button
                key={obj.value}
                type="button"
                disabled={!selected && objectives.length >= 3}
                onClick={() => onToggleObjective(obj.value)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all',
                  selected
                    ? 'border-violet-500 bg-violet-600/10 text-violet-200'
                    : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 disabled:opacity-40',
                )}
              >
                {selected && <Check size={12} className="text-violet-400 shrink-0" />}
                {obj.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-8">
        <label className="mb-3 block text-sm font-medium text-zinc-300">Principal desafio atual</label>
        <div className="flex flex-col gap-2">
          {CHALLENGES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChallenge(c)}
              className={cn(
                'flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-all',
                challenge === c
                  ? 'border-violet-500 bg-violet-600/10 text-violet-200'
                  : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600',
              )}
            >
              {c}
              {challenge === c && <Check size={14} className="text-violet-400 shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="rounded-xl border border-zinc-800 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600">Voltar</button>
        <button
          onClick={onNext}
          disabled={objectives.length === 0 || saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : <>Continuar <ChevronRight size={14} /></>}
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: AI Personality ───────────────────────────────────

function PersonalityStep({
  personality, channels,
  onPersonality, onToggleChannel,
  onNext, onBack, saving,
}: {
  personality: string
  channels: string[]
  onPersonality: (v: string) => void
  onToggleChannel: (v: string) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-3">Passo 3 de 6</p>
        <h2 className="text-3xl font-bold text-white mb-2">Personalidade da IA</h2>
        <p className="text-zinc-400">Isso define como a IA se comunica com seus clientes em todos os canais.</p>
      </div>

      {/* Personality */}
      <div className="mb-8">
        <label className="mb-3 block text-sm font-medium text-zinc-300">Tom de voz</label>
        <div className="flex flex-col gap-2">
          {PERSONALITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPersonality(p.value)}
              className={cn(
                'flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all',
                personality === p.value
                  ? 'border-violet-500 bg-violet-600/10'
                  : 'border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-600',
              )}
            >
              <div>
                <p className={cn('text-sm font-semibold', personality === p.value ? 'text-violet-300' : 'text-zinc-300')}>{p.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{p.desc}</p>
              </div>
              {personality === p.value && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600">
                  <Check size={10} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div className="mb-8">
        <label className="mb-1 block text-sm font-medium text-zinc-300">Canais de atuação</label>
        <p className="mb-3 text-xs text-zinc-500">Quanto mais integrações, mais inteligente a IA se torna.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon
            const selected = channels.includes(ch.id)
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onToggleChannel(ch.id)}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-medium transition-all',
                  selected
                    ? 'border-violet-500/60 bg-violet-600/10 text-violet-300'
                    : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600',
                )}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${ch.color}22` }}>
                  <Icon size={14} style={{ color: ch.color }} />
                </div>
                {ch.label}
                {selected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600"
                  >
                    <Check size={8} className="text-white" />
                  </motion.div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="rounded-xl border border-zinc-800 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600">Voltar</button>
        <button
          onClick={onNext}
          disabled={!personality || saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : <>Continuar <ChevronRight size={14} /></>}
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: AI Training (file upload) ───────────────────────

interface TrainFile { file: File; id: string; status: 'queued' | 'uploading' | 'done' | 'error' }

function TrainingStep({
  files, onAddFiles, onRemoveFile, onNext, onBack, uploading,
}: {
  files: TrainFile[]
  onAddFiles: (f: File[]) => void
  onRemoveFile: (id: string) => void
  onNext: () => void
  onBack: () => void
  uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    onAddFiles(dropped)
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-3">Passo 4 de 6</p>
        <h2 className="text-3xl font-bold text-white mb-2">Treino da IA</h2>
        <p className="text-zinc-400">
          Envie documentos da sua empresa para a IA aprender sua linguagem, clientes e processos.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'mb-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all',
          dragging
            ? 'border-violet-500 bg-violet-600/10'
            : 'border-zinc-700/60 bg-zinc-900/30 hover:border-violet-500/50 hover:bg-violet-600/5',
        )}
      >
        <motion.div
          animate={dragging ? { scale: 1.1 } : { scale: 1 }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/15"
        >
          <Upload size={24} className="text-violet-400" />
        </motion.div>
        <div>
          <p className="text-sm font-medium text-zinc-300">Arraste arquivos aqui ou clique para selecionar</p>
          <p className="mt-1 text-xs text-zinc-600">PDF, XLSX, DOCX, imagens, áudios — até 50MB cada</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.xlsx,.xls,.docx,.doc,.csv,.txt,.png,.jpg,.jpeg,.mp3,.m4a,.wav"
          onChange={(e) => {
            if (e.target.files) onAddFiles(Array.from(e.target.files))
          }}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/15">
                <Upload size={13} className="text-violet-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-300">{f.file.name}</p>
                <p className="text-xs text-zinc-600">{formatBytes(f.file.size)}</p>
              </div>
              <div className="shrink-0">
                {f.status === 'uploading' && <Loader2 size={14} className="animate-spin text-violet-400" />}
                {f.status === 'done' && <Check size={14} className="text-emerald-400" />}
                {f.status === 'error' && <AlertTriangle size={14} className="text-red-400" />}
                {f.status === 'queued' && (
                  <button onClick={() => onRemoveFile(f.id)} className="text-zinc-600 hover:text-zinc-400">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mb-6 text-xs text-zinc-600">
        💡 Pular esta etapa é possível. Você pode enviar documentos a qualquer momento pelo dashboard.
      </p>

      <div className="flex gap-3">
        <button onClick={onBack} className="rounded-xl border border-zinc-800 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600">Voltar</button>
        <button
          onClick={onNext}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading
            ? <><Loader2 size={14} className="animate-spin" /> Enviando…</>
            : files.length > 0
              ? <>Enviar e continuar <ChevronRight size={14} /></>
              : <>Pular esta etapa <ChevronRight size={14} /></>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Step 5: AI Analysis ──────────────────────────────────────

const INSIGHTS = [
  { icon: TrendingUp, text: 'Detectamos R$ 18.400 em potencial de recuperação', color: 'text-emerald-400' },
  { icon: AlertTriangle, text: '23 clientes identificados sem follow-up nos últimos 30 dias', color: 'text-yellow-400' },
  { icon: Zap, text: 'Encontramos 4 oportunidades de automação imediata', color: 'text-violet-400' },
  { icon: Users, text: 'Perfil de cliente ideal mapeado com base nos seus dados', color: 'text-cyan-400' },
]

function AnalysisStep({ companyName, onNext }: { companyName: string; onNext: () => void }) {
  const [phase, setPhase] = useState<'analyzing' | 'ready'>('analyzing')
  const [visibleInsights, setVisibleInsights] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('ready'), 3200)
    return () => clearTimeout(t1)
  }, [])

  useEffect(() => {
    if (phase !== 'ready') return
    const intervals = INSIGHTS.map((_, i) => setTimeout(() => setVisibleInsights(i + 1), i * 500))
    return () => intervals.forEach(clearTimeout)
  }, [phase])

  return (
    <div className="w-full max-w-xl mx-auto text-center">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-3">Passo 5 de 6</p>
        <h2 className="text-3xl font-bold text-white mb-2">Análise operacional da IA</h2>
        <p className="text-zinc-400">A IA está analisando o contexto de {companyName || 'sua empresa'}.</p>
      </div>

      {/* Scanning animation */}
      <div className="relative mx-auto mb-10 flex h-32 w-32 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full border border-violet-500/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-violet-700/40" style={{ background: 'rgba(37,99,235,0.12)' }}>
          <Brain size={32} className="text-violet-400" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'analyzing' ? (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-zinc-400 text-sm mb-4">Analisando integrações, dados e contexto…</p>
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-violet-500"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.25 }}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="insights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-left">
            <p className="mb-4 text-center text-sm font-medium text-zinc-300">Análise concluída. Resultados encontrados:</p>
            <div className="flex flex-col gap-3 mb-8">
              {INSIGHTS.map((ins, i) => {
                const Icon = ins.icon
                return (
                  <AnimatePresence key={i}>
                    {visibleInsights > i && (
                      <motion.div
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-3"
                      >
                        <Icon size={16} className={cn('shrink-0 mt-0.5', ins.color)} />
                        <p className="text-sm text-zinc-300">{ins.text}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )
              })}
            </div>
            <button
              onClick={onNext}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Ver ativação completa <ArrowRight size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Step 6: Activation ───────────────────────────────────────

const CHECKLIST = [
  'Empresa analisada',
  'IA treinada com seus dados',
  'Integrações configuradas',
  'Automações prontas',
  'Agentes ativados',
]

function ActivationStep({ companyName, onComplete, completing }: {
  companyName: string
  onComplete: () => void
  completing: boolean
}) {
  const [checkedCount, setCheckedCount] = useState(0)
  const [phase, setPhase] = useState<'activating' | 'ready'>('activating')

  useEffect(() => {
    const timers = CHECKLIST.map((_, i) => setTimeout(() => setCheckedCount(i + 1), 500 + i * 600))
    const done = setTimeout(() => setPhase('ready'), 500 + CHECKLIST.length * 600 + 400)
    return () => { timers.forEach(clearTimeout); clearTimeout(done) }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      {/* Activation ring */}
      <div className="relative mb-10">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              inset: -(i + 1) * 20,
              border: `1px solid rgba(37,99,235,${0.2 - i * 0.05})`,
            }}
            animate={{ scale: [1, 1 + (i + 1) * 0.05, 1], opacity: [0.2 - i * 0.05, 0.4 - i * 0.1, 0.2 - i * 0.05] }}
            transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          />
        ))}
        <motion.div
          className="relative flex h-24 w-24 items-center justify-center rounded-full border border-violet-600/40"
          style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
        >
          <Zap size={38} className="text-violet-200" />
        </motion.div>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
        {phase === 'activating' ? 'Ativando sistemas…' : 'Sistema ativo'}
      </p>
      <h1 className="mb-3 text-4xl font-bold text-white md:text-5xl">
        {phase === 'activating'
          ? 'NEXUS IA inicializando…'
          : (
            <>
              NEXUS IA{' '}
              <span className="text-violet-400">
                inicializada.
              </span>
            </>
          )
        }
      </h1>
      {phase === 'ready' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-10 text-zinc-400 text-lg"
        >
          {companyName || 'Sua empresa'} agora possui uma IA operacional ativa.
        </motion.p>
      )}

      {/* Checklist */}
      <div className="mb-10 w-full max-w-xs">
        {CHECKLIST.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={checkedCount > i ? { opacity: 1, x: 0 } : {}}
            className="flex items-center gap-3 py-1.5"
          >
            <div className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full transition-all',
              checkedCount > i ? 'bg-emerald-600' : 'border border-zinc-700',
            )}>
              {checkedCount > i && <Check size={11} className="text-white" />}
            </div>
            <span className={cn('text-sm', checkedCount > i ? 'text-zinc-300' : 'text-zinc-700')}>
              {item}
            </span>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {phase === 'ready' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onComplete}
            disabled={completing}
            className="group relative flex items-center gap-3 rounded-2xl px-8 py-4 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
          >
            {completing
              ? <><Loader2 size={16} className="animate-spin" /> Abrindo Centro Operacional…</>
              : <><Zap size={16} className="text-violet-200" /> Entrar no Centro Operacional <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></>
            }
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main orchestrator ────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
}

export default function SetupPage() {
  const router = useRouter()

  // UI state
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [completing, setCompleting] = useState(false)

  // Form data
  const [company, setCompany] = useState({ name: '', segment: '', teamSize: '' })
  const [objectives, setObjectives] = useState<string[]>([])
  const [challenge, setChallenge] = useState('')
  const [personality, setPersonality] = useState('moderno')
  const [channels, setChannels] = useState<string[]>([])
  const [trainFiles, setTrainFiles] = useState<TrainFile[]>([])

  // Load company name from session on mount
  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d: { company?: { name?: string } }) => {
        if (d.company?.name) setCompany((c) => ({ ...c, name: d.company!.name ?? '' }))
      })
      .catch(() => {})
  }, [])

  function go(next: number) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  // ── Step 1: Save profile ──────────────────────────────────

  async function handleCompanyNext() {
    setSaving(true)
    await fetch('/api/setup/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: company.name,
        segment: company.segment,
        teamSize: company.teamSize,
      }),
    }).catch(() => {})
    setSaving(false)
    go(step + 1)
  }

  async function handleObjectivesNext() {
    setSaving(true)
    await fetch('/api/setup/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectives, mainChallenge: challenge }),
    }).catch(() => {})
    setSaving(false)
    go(step + 1)
  }

  async function handlePersonalityNext() {
    setSaving(true)
    await fetch('/api/setup/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiPersonality: personality, integrations: channels }),
    }).catch(() => {})
    setSaving(false)
    go(step + 1)
  }

  // ── Step 4: Upload files ──────────────────────────────────

  function handleAddFiles(newFiles: File[]) {
    setTrainFiles((prev) => [
      ...prev,
      ...newFiles.map((f) => ({ file: f, id: Math.random().toString(36).slice(2), status: 'queued' as const })),
    ])
  }

  function handleRemoveFile(id: string) {
    setTrainFiles((prev) => prev.filter((f) => f.id !== id))
  }

  async function handleUploadNext() {
    if (trainFiles.length === 0) { go(step + 1); return }

    setUploading(true)
    setTrainFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading' })))

    const formData = new FormData()
    trainFiles.forEach((f) => formData.append('files', f.file))

    try {
      const res = await fetch('/api/setup/upload', { method: 'POST', body: formData })
      const data = await res.json() as { files?: { id: string; status: string }[] }

      setTrainFiles((prev) =>
        prev.map((f, i) => ({ ...f, status: (data.files?.[i]?.status === 'uploaded' ? 'done' : 'error') })),
      )
    } catch {
      setTrainFiles((prev) => prev.map((f) => ({ ...f, status: 'error' })))
    }

    setUploading(false)
    setTimeout(() => go(step + 1), 600)
  }

  // ── Step 6: Complete ──────────────────────────────────────

  async function handleComplete() {
    setCompleting(true)
    await fetch('/api/setup/complete', { method: 'POST' }).catch(() => {})
    router.replace('/dashboard')
  }

  // ── Toggle helpers ────────────────────────────────────────

  const toggleObjective = useCallback((v: string) => {
    setObjectives((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : prev.length < 3 ? [...prev, v] : prev,
    )
  }, [])

  const toggleChannel = useCallback((v: string) => {
    setChannels((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }, [])

  // ─────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <NeuralBackground />

      {/* Header with progress (hidden on boot + activation steps) */}
      {step > 0 && step < 6 && (
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center justify-between border-b border-white/5 px-6 py-4 backdrop-blur-sm"
        >
          <span className="text-base font-bold tracking-tight">
            <span style={{ color: '#60a5fa' }}>N</span>EXUS
          </span>
          <ProgressBar step={step} total={7} />
          <div className="w-16" />
        </motion.header>
      )}

      {/* Content */}
      <main className="relative z-10">
        <AnimatePresence mode="wait" custom={direction}>
          {/* Boot */}
          {step === 0 && (
            <motion.div key="boot" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: 'easeInOut' }}>
              <BootStep onStart={() => go(1)} />
            </motion.div>
          )}

          {/* Company */}
          {step === 1 && (
            <motion.div key="company" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: 'easeInOut' }} className="flex min-h-screen items-center justify-center px-6 py-20">
              <CompanyStep
                data={company}
                onChange={(k, v) => setCompany((c) => ({ ...c, [k]: v }))}
                onNext={handleCompanyNext}
                onBack={() => go(0)}
                saving={saving}
              />
            </motion.div>
          )}

          {/* Objectives */}
          {step === 2 && (
            <motion.div key="objectives" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: 'easeInOut' }} className="flex min-h-screen items-center justify-center px-6 py-20">
              <ObjectivesStep
                objectives={objectives}
                challenge={challenge}
                onToggleObjective={toggleObjective}
                onChallenge={setChallenge}
                onNext={handleObjectivesNext}
                onBack={() => go(1)}
                saving={saving}
              />
            </motion.div>
          )}

          {/* Personality + channels */}
          {step === 3 && (
            <motion.div key="personality" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: 'easeInOut' }} className="flex min-h-screen items-center justify-center px-6 py-20">
              <PersonalityStep
                personality={personality}
                channels={channels}
                onPersonality={setPersonality}
                onToggleChannel={toggleChannel}
                onNext={handlePersonalityNext}
                onBack={() => go(2)}
                saving={saving}
              />
            </motion.div>
          )}

          {/* Training upload */}
          {step === 4 && (
            <motion.div key="training" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: 'easeInOut' }} className="flex min-h-screen items-center justify-center px-6 py-20">
              <TrainingStep
                files={trainFiles}
                onAddFiles={handleAddFiles}
                onRemoveFile={handleRemoveFile}
                onNext={handleUploadNext}
                onBack={() => go(3)}
                uploading={uploading}
              />
            </motion.div>
          )}

          {/* AI analysis */}
          {step === 5 && (
            <motion.div key="analysis" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: 'easeInOut' }} className="flex min-h-screen items-center justify-center px-6 py-20">
              <AnalysisStep companyName={company.name} onNext={() => go(6)} />
            </motion.div>
          )}

          {/* Activation */}
          {step === 6 && (
            <motion.div key="activation" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: 'easeInOut' }}>
              <ActivationStep
                companyName={company.name}
                onComplete={handleComplete}
                completing={completing}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
