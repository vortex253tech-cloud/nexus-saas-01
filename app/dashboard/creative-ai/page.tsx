'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Image as LucideImage, MessageSquare, Mail, Camera, FileText,
  Megaphone, Zap, Copy, Download, Send,
  Heart, Loader2, CheckCircle2, RefreshCw,
  ChevronRight, Plus, TrendingUp, Target,
  BarChart3, DollarSign, Palette, Wand2, Play, Bookmark,
  LayoutTemplate, ArrowRight, Eye, Edit3, Brain,
  AlertTriangle, Activity, Clock, Users, BotMessageSquare,
  ChevronDown, Power, Rocket, Shield, Star,
  X, Check, Lightbulb, Navigation,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { OpportunityCard } from '@/app/api/creative/opportunities/route'
import type { Variation }       from '@/app/api/creative/generate-multi/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId     = 'imagens' | 'whatsapp' | 'email' | 'instagram' | 'pdfs' | 'campanhas' | 'automacao'
type PdfType   = 'proposta' | 'relatorio' | 'contrato' | 'playbook'
type Objective = 'cobranca' | 'reativacao' | 'lancamento' | 'promocao' | 'boas_vindas' | 'follow_up'
type GenState  = 'idle' | 'generating' | 'done' | 'error'

interface GeneratedImage {
  url:           string
  revised_prompt?: string
  generation_ms?: number
  company_name?:  string
  size?:          string
}

interface CampaignMessage {
  step:    number
  delay:   string
  channel: string
  content: string
}

interface Campaign {
  name:             string
  objective:        string
  audience:         string
  messages:         CampaignMessage[]
  expected_results: { open_rate: string; conversion_rate: string; revenue_potential: string }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType; color: string }> = [
  { id: 'whatsapp',  label: 'WhatsApp',     icon: MessageSquare, color: 'emerald' },
  { id: 'email',     label: 'Email',        icon: Mail,          color: 'blue'    },
  { id: 'instagram', label: 'Instagram',    icon: Camera,        color: 'pink'    },
  { id: 'imagens',   label: 'Imagens IA',   icon: LucideImage,   color: 'violet'  },
  { id: 'campanhas', label: 'Campanhas',    icon: Megaphone,     color: 'orange'  },
  { id: 'pdfs',      label: 'Documentos',   icon: FileText,      color: 'amber'   },
  { id: 'automacao', label: 'Automação IA', icon: Zap,           color: 'purple'  },
]

const OBJECTIVES: Array<{ value: Objective; label: string; emoji: string }> = [
  { value: 'cobranca',    label: 'Cobrança',    emoji: '💰' },
  { value: 'reativacao',  label: 'Reativação',  emoji: '🔥' },
  { value: 'lancamento',  label: 'Lançamento',  emoji: '🚀' },
  { value: 'promocao',    label: 'Promoção',    emoji: '🎯' },
  { value: 'boas_vindas', label: 'Boas-vindas', emoji: '👋' },
  { value: 'follow_up',   label: 'Follow-up',   emoji: '📞' },
]

const IMAGE_STYLES = [
  { id: 'corporate', label: 'Corporativo', desc: 'Sóbrio e profissional'    },
  { id: 'vibrant',   label: 'Vibrante',   desc: 'Cores fortes, energético' },
  { id: 'minimal',   label: 'Minimal',    desc: 'Clean e moderno'          },
  { id: 'luxury',    label: 'Luxo',       desc: 'Elegante e exclusivo'     },
]

const IMAGE_RATIOS = [
  { id: 'square',    label: '1:1',   desc: 'Feed / WhatsApp' },
  { id: 'portrait',  label: '9:16',  desc: 'Stories / Reels' },
  { id: 'landscape', label: '16:9',  desc: 'Email / Banner'  },
  { id: 'banner',    label: '3:1',   desc: 'Capa / LinkedIn' },
]

const URGENCY_CONFIG = {
  critical: { label: 'Crítico',  color: 'red',    dot: 'bg-red-500'    },
  high:     { label: 'Urgente',  color: 'orange', dot: 'bg-orange-500' },
  medium:   { label: 'Atenção',  color: 'amber',  dot: 'bg-amber-500'  },
}

const TYPE_CONFIG: Record<string, { gradient: string; border: string }> = {
  cobranca:     { gradient: 'from-red-500/10 to-orange-500/10',     border: 'border-red-500/20'    },
  reativacao:   { gradient: 'from-orange-500/10 to-amber-500/10',   border: 'border-orange-500/20' },
  lancamento:   { gradient: 'from-violet-500/10 to-purple-500/10',  border: 'border-violet-500/20' },
  risco:        { gradient: 'from-red-600/10 to-rose-500/10',       border: 'border-red-600/20'    },
  crescimento:  { gradient: 'from-emerald-500/10 to-teal-500/10',   border: 'border-emerald-500/20'},
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function colorClass(color: string, variant: 'bg' | 'text' | 'border') {
  const map: Record<string, Record<string, string>> = {
    violet:  { bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/30'  },
    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    blue:    { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/30'    },
    pink:    { bg: 'bg-pink-500/15',    text: 'text-pink-400',    border: 'border-pink-500/30'    },
    amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30'   },
    orange:  { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/30'  },
    cyan:    { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    border: 'border-cyan-500/30'    },
    purple:  { bg: 'bg-purple-500/15',  text: 'text-purple-400',  border: 'border-purple-500/30'  },
    red:     { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30'     },
  }
  return map[color]?.[variant] ?? ''
}

async function generateMulti(
  type:      string,
  channel:   string,
  objective: string,
  context:   string,
): Promise<{ variations: Variation[]; company_name?: string }> {
  const res = await fetch('/api/creative/generate-multi', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ type, channel, objective, context }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border border-zinc-700 text-zinc-400 transition hover:border-violet-500/50 hover:text-violet-400',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-[10px]',
      )}
    >
      {copied ? <CheckCircle2 size={size === 'sm' ? 12 : 10} className="text-emerald-400" /> : <Copy size={size === 'sm' ? 12 : 10} />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

// ─── ObjectiveSelector ────────────────────────────────────────────────────────

function ObjectiveSelector({ value, onChange }: { value: Objective; onChange: (v: Objective) => void }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Objetivo</label>
      <div className="flex flex-wrap gap-2">
        {OBJECTIVES.map(obj => (
          <button
            key={obj.value}
            onClick={() => onChange(obj.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
              value === obj.value
                ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
            )}
          >
            <span>{obj.emoji}</span>
            {obj.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── GenerateButton ───────────────────────────────────────────────────────────

function GenerateButton({ onClick, loading, label = 'Gerar 3 Variações com IA' }: {
  onClick: () => void; loading: boolean; label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all overflow-hidden',
        'bg-gradient-to-r from-violet-600 to-purple-600',
        'disabled:opacity-70 disabled:cursor-not-allowed',
        'shadow-lg shadow-violet-500/25',
        !loading && 'hover:from-violet-500 hover:to-purple-500 hover:shadow-violet-500/40',
      )}
    >
      {!loading && (
        <span className="absolute inset-0 bg-gradient-to-r from-violet-400/0 via-white/5 to-violet-400/0 translate-x-[-100%] animate-shimmer" />
      )}
      {loading ? (
        <><Loader2 size={15} className="animate-spin" /> Gerando variações...</>
      ) : (
        <><Sparkles size={15} /> {label}</>
      )}
    </button>
  )
}

// ─── VariationsPanel ─────────────────────────────────────────────────────────

function VariationsPanel({
  variations,
  onRegenerate,
  companyName,
}: { variations: Variation[]; onRegenerate: () => void; companyName?: string }) {
  const [selected, setSelected] = useState<number | null>(null)

  const toneColors: Record<string, string> = {
    persuasivo: 'violet',
    emocional:  'pink',
    urgente:    'orange',
    premium:    'amber',
    amigavel:   'emerald',
    corporativo:'blue',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400">3 variações geradas</span>
          {companyName && <span className="text-xs text-zinc-500">· {companyName}</span>}
        </div>
        <button onClick={onRegenerate} className="flex items-center gap-1 rounded-lg p-1.5 text-zinc-500 transition hover:text-violet-400">
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {variations.map((v, i) => {
          const color = toneColors[v.tone] ?? 'violet'
          const isSelected = selected === i
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setSelected(isSelected ? null : i)}
              className={cn(
                'relative cursor-pointer rounded-2xl border p-4 transition-all',
                isSelected
                  ? 'border-violet-500/50 bg-violet-500/8 shadow-lg shadow-violet-500/10'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
              )}
            >
              {/* Tone badge */}
              <div className="mb-3 flex items-center justify-between">
                <span className={cn(
                  'rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  colorClass(color, 'text'),
                  colorClass(color, 'border'),
                  colorClass(color, 'bg'),
                )}>
                  {v.tone_label}
                </span>
                {isSelected && <Check size={12} className="text-violet-400" />}
              </div>

              {/* Text preview */}
              <p className="text-xs text-zinc-300 leading-relaxed line-clamp-6">
                {v.text}
              </p>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <CopyButton text={v.text} size="xs" />
                <button className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 transition hover:border-emerald-500/40 hover:text-emerald-400">
                  <Send size={9} /> Usar
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {selected !== null && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"
        >
          <p className="whitespace-pre-wrap font-sans text-sm text-zinc-200 leading-relaxed">
            {variations[selected].text}
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Tab: WhatsApp ────────────────────────────────────────────────────────────

function WhatsAppTab({ jumpObjective }: { jumpObjective?: Objective | null }) {
  const [objective, setObjective] = useState<Objective>(jumpObjective ?? 'cobranca')
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [result,    setResult]    = useState<{ variations: Variation[]; company_name?: string } | null>(null)

  useEffect(() => { if (jumpObjective) setObjective(jumpObjective) }, [jumpObjective])

  async function handleGenerate() {
    setState('generating')
    try {
      const data = await generateMulti('message', 'whatsapp', objective, context)
      setResult(data)
      setState('done')
    } catch { setState('error') }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <ObjectiveSelector value={objective} onChange={setObjective} />
          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Contexto (opcional)</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Ex: Cliente deve R$380 há 15 dias, oferecemos desconto de 20%..."
              rows={4}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition"
            />
          </div>
          <GenerateButton onClick={handleGenerate} loading={state === 'generating'} />
          {state === 'error' && (
            <p className="text-xs text-red-400">Erro ao gerar. Verifique a configuração de API.</p>
          )}
        </div>

        {/* WhatsApp preview */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Preview</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">NX</div>
              <div>
                <p className="text-xs font-semibold text-white">Sua Empresa</p>
                <p className="text-[10px] text-emerald-400">● Online</p>
              </div>
            </div>
            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-zinc-800 px-3 py-2">
              {state === 'generating'
                ? <div className="flex gap-1 items-center py-1"><span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" /><span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" /><span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" /></div>
                : <p className="text-xs text-zinc-300 leading-relaxed">{result?.variations[0]?.text?.slice(0, 120) ?? 'Sua mensagem gerada aparecerá aqui...'}{(result?.variations[0]?.text?.length ?? 0) > 120 ? '…' : ''}</p>
              }
            </div>
          </div>
        </div>
      </div>

      {state === 'done' && result && (
        <VariationsPanel
          variations={result.variations}
          onRegenerate={handleGenerate}
          companyName={result.company_name}
        />
      )}
    </div>
  )
}

// ─── Tab: Email ───────────────────────────────────────────────────────────────

function EmailTab({ jumpObjective }: { jumpObjective?: Objective | null }) {
  const [objective, setObjective] = useState<Objective>(jumpObjective ?? 'cobranca')
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [result,    setResult]    = useState<{ variations: Variation[]; company_name?: string } | null>(null)

  useEffect(() => { if (jumpObjective) setObjective(jumpObjective) }, [jumpObjective])

  async function handleGenerate() {
    setState('generating')
    try {
      const data = await generateMulti('message', 'email', objective, context)
      setResult(data)
      setState('done')
    } catch { setState('error') }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <ObjectiveSelector value={objective} onChange={setObjective} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Contexto</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Ex: Enviar para clientes que não abriram o último email..."
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition"
            />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Preview Email</p>
            <div className="space-y-2">
              <div className="rounded-lg bg-zinc-800 px-3 py-2">
                <p className="text-[10px] text-zinc-500">De: Sua Empresa &lt;contato@empresa.com&gt;</p>
                <p className="text-[10px] text-zinc-500">Assunto: {OBJECTIVES.find(o => o.value === objective)?.emoji} {OBJECTIVES.find(o => o.value === objective)?.label}</p>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-4">
                {result?.variations[0]?.text?.slice(0, 100) ?? 'Conteúdo do email aparecerá aqui...'}
              </p>
            </div>
          </div>
        </div>
        <GenerateButton onClick={handleGenerate} loading={state === 'generating'} />
      </div>

      {state === 'done' && result && (
        <VariationsPanel
          variations={result.variations}
          onRegenerate={handleGenerate}
          companyName={result.company_name}
        />
      )}
    </div>
  )
}

// ─── Tab: Instagram ───────────────────────────────────────────────────────────

function InstagramTab() {
  const [objective, setObjective] = useState<Objective>('promocao')
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [result,    setResult]    = useState<{ variations: Variation[]; company_name?: string } | null>(null)

  async function handleGenerate() {
    setState('generating')
    try {
      const data = await generateMulti('caption', 'instagram', objective, context)
      setResult(data)
      setState('done')
    } catch { setState('error') }
  }

  return (
    <div className="space-y-6">
      <ObjectiveSelector value={objective} onChange={setObjective} />
      <div>
        <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Contexto do post</label>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Ex: Lançamento da coleção de verão, 30% de desconto só essa semana..."
          rows={3}
          className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition"
        />
      </div>
      <GenerateButton onClick={handleGenerate} loading={state === 'generating'} label="Gerar 3 Legendas com IA" />
      {state === 'done' && result && (
        <VariationsPanel variations={result.variations} onRegenerate={handleGenerate} companyName={result.company_name} />
      )}
    </div>
  )
}

// ─── Tab: Campanhas ───────────────────────────────────────────────────────────

function CampanhasTab({ jumpObjective }: { jumpObjective?: Objective | null }) {
  const [objective, setObjective] = useState<Objective>(jumpObjective ?? 'reativacao')
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [campaign,  setCampaign]  = useState<Campaign | null>(null)

  useEffect(() => { if (jumpObjective) setObjective(jumpObjective) }, [jumpObjective])

  async function handleGenerate() {
    setState('generating')
    try {
      const res = await fetch('/api/creative/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'campaign', channel: 'whatsapp', objective, context }),
      })
      const data = await res.json() as { json?: Campaign; text?: string }
      if (data.json) { setCampaign(data.json as Campaign); setState('done') }
      else setState('error')
    } catch { setState('error') }
  }

  return (
    <div className="space-y-6">
      <ObjectiveSelector value={objective} onChange={setObjective} />
      <div>
        <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Contexto da campanha</label>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Ex: Campanha de reativação para clientes que não compram há 60 dias..."
          rows={3}
          className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition"
        />
      </div>
      <GenerateButton onClick={handleGenerate} loading={state === 'generating'} label="Criar Campanha Completa" />

      {state === 'done' && campaign && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
            <h3 className="font-semibold text-white">{campaign.name}</h3>
            <p className="mt-1 text-xs text-zinc-400">{campaign.audience}</p>
          </div>
          <div className="space-y-3">
            {campaign.messages.map((msg, i) => (
              <div key={i} className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">
                  {msg.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-lg border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">{msg.delay}</span>
                    <span className="rounded-lg border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">{msg.channel}</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{msg.content}</p>
                </div>
                <CopyButton text={msg.content} size="xs" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(campaign.expected_results).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center">
                <p className="text-sm font-bold text-white">{v}</p>
                <p className="text-[10px] text-zinc-500 capitalize">{k.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Tab: Imagens (Creative Studio) ──────────────────────────────────────────

function ImagensTab() {
  const [style,       setStyle]       = useState('corporate')
  const [ratio,       setRatio]       = useState('square')
  const [objective,   setObjective]   = useState<Objective>('promocao')
  const [description, setDescription] = useState('')
  const [state,       setState]       = useState<GenState>('idle')
  const [image,       setImage]       = useState<GeneratedImage | null>(null)
  const [history,     setHistory]     = useState<GeneratedImage[]>([])

  async function handleGenerate() {
    setState('generating')
    try {
      const res = await fetch('/api/creative/image', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ description, style, ratio, objective }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as GeneratedImage
      setImage(data)
      setHistory(h => [data, ...h.slice(0, 7)])
      setState('done')
    } catch { setState('error') }
  }

  const aspectClass = {
    square:    'aspect-square',
    portrait:  'aspect-[9/16]',
    landscape: 'aspect-video',
    banner:    'aspect-[3/1]',
  }[ratio] ?? 'aspect-square'

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Controls */}
        <div className="space-y-5 lg:col-span-2">
          <ObjectiveSelector value={objective} onChange={setObjective} />

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Formato</label>
            <div className="grid grid-cols-2 gap-2">
              {IMAGE_RATIOS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRatio(r.id)}
                  className={cn(
                    'rounded-xl border p-2.5 text-left transition-all',
                    ratio === r.id
                      ? 'border-violet-500/50 bg-violet-500/15'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
                  )}
                >
                  <p className={cn('text-xs font-semibold', ratio === r.id ? 'text-violet-300' : 'text-zinc-300')}>{r.label}</p>
                  <p className="text-[10px] text-zinc-500">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Estilo visual</label>
            <div className="grid grid-cols-2 gap-2">
              {IMAGE_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    'rounded-xl border p-2.5 text-left transition-all',
                    style === s.id
                      ? 'border-violet-500/50 bg-violet-500/15'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
                  )}
                >
                  <p className={cn('text-xs font-semibold', style === s.id ? 'text-violet-300' : 'text-zinc-300')}>{s.label}</p>
                  <p className="text-[10px] text-zinc-500">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Descreva a imagem</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Produto premium em fundo neutro, iluminação profissional..."
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition"
            />
          </div>

          <GenerateButton onClick={handleGenerate} loading={state === 'generating'} label="Gerar Imagem com DALL-E 3" />
          {state === 'error' && <p className="text-xs text-red-400">Erro ao gerar. Verifique OPENAI_API_KEY.</p>}
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className={cn(
            'relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 flex items-center justify-center',
            aspectClass,
          )}>
            <AnimatePresence mode="wait">
              {state === 'generating' ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative">
                    <div className="h-12 w-12 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                      <Sparkles size={20} className="text-violet-400" />
                    </div>
                    <div className="absolute -inset-1 rounded-2xl border-2 border-violet-500/30 animate-ping" />
                  </div>
                  <p className="text-xs text-zinc-400 animate-pulse">Gerando com DALL-E 3...</p>
                </motion.div>
              ) : image ? (
                <motion.div key="image" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0">
                  <img src={image.url} alt="AI generated" className="h-full w-full object-cover" />
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 text-center p-6">
                  <LucideImage size={32} className="text-zinc-700" />
                  <p className="text-xs text-zinc-600">Configure e clique em Gerar</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generation time badge */}
            {image?.generation_ms && (
              <div className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur-sm">
                {(image.generation_ms / 1000).toFixed(1)}s
              </div>
            )}
          </div>

          {/* Action bar */}
          {image && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 flex-wrap">
              <a
                href={image.url}
                download="nexus-creative.png"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-violet-500/50 hover:text-violet-300 transition"
              >
                <Download size={12} /> Download PNG
              </a>
              <CopyButton text={image.url} />
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-violet-500/50 hover:text-violet-300 transition"
              >
                <RefreshCw size={12} /> Regerar
              </button>
            </motion.div>
          )}

          {/* History strip */}
          {history.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {history.slice(1).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImage(img)}
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-800 hover:border-violet-500/50 transition"
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Documentos (PDFs) ───────────────────────────────────────────────────

const PDF_TYPES: Array<{ id: PdfType; icon: string; label: string; desc: string; placeholder: string }> = [
  { id: 'proposta',  icon: '📄', label: 'Proposta Comercial',  desc: 'Proposta profissional com valores, condições e próximos passos',     placeholder: 'Ex: Proposta para empresa de 50 funcionários, consultoria mensal R$5.000, 3 meses de contrato...' },
  { id: 'relatorio', icon: '📊', label: 'Relatório Executivo', desc: 'Relatório de desempenho com análise e recomendações estratégicas',   placeholder: 'Ex: Relatório mensal de vendas, meta R$100k, atingimos R$87k, 3 novos clientes...' },
  { id: 'contrato',  icon: '📋', label: 'Contrato de Serviço', desc: 'Contrato de prestação de serviços com cláusulas essenciais',         placeholder: 'Ex: Contrato de mentoria 3 meses, R$3.000/mês, acesso a grupo VIP e 2 sessões semanais...' },
  { id: 'playbook',  icon: '🎯', label: 'Playbook de Vendas',  desc: 'Guia completo com scripts, objeções mapeadas e técnicas de fechamento', placeholder: 'Ex: Playbook para time de 5 closers, produto de ticket R$15.000, ICP: empresas 10-50 funcionários...' },
]

function PdfsTab() {
  const [selected,  setSelected]  = useState<PdfType | null>(null)
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [content,   setContent]   = useState('')

  const selectedType = PDF_TYPES.find(p => p.id === selected)

  async function handleGenerate() {
    if (!selected || !context.trim()) return
    setState('generating')
    try {
      const res = await fetch('/api/creative/pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: selected, context }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { content: string }
      setContent(data.content)
      setState('done')
    } catch {
      setState('error')
    }
  }

  function reset() { setState('idle'); setContent('') }

  return (
    <div className="space-y-5">
      {/* Type selector */}
      <div>
        <label className="mb-3 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Tipo de Documento</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PDF_TYPES.map(item => (
            <button
              key={item.id}
              onClick={() => { setSelected(item.id); reset() }}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-4 text-left transition-all',
                selected === item.id
                  ? 'border-amber-500/50 bg-amber-500/8 shadow-lg shadow-amber-500/10'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
              )}
            >
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-zinc-500 line-clamp-1">{item.desc}</p>
              </div>
              {selected === item.id
                ? <Check size={14} className="shrink-0 text-amber-400" />
                : <ChevronRight size={14} className="shrink-0 text-zinc-600" />
              }
            </button>
          ))}
        </div>
      </div>

      {/* Context input */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Contexto e Detalhes
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder={selectedType?.placeholder}
              rows={4}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/50 transition"
            />
          </div>
          <GenerateButton
            onClick={handleGenerate}
            loading={state === 'generating'}
            label={`Gerar ${selectedType?.label ?? 'Documento'}`}
          />
        </motion.div>
      )}

      {/* Generated content */}
      {state === 'done' && content && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">{selectedType?.label} gerado</span>
            </div>
            <div className="flex gap-2">
              <CopyButton text={content} />
              <button
                onClick={reset}
                className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:border-zinc-600 transition"
              >
                <RefreshCw size={9} /> Novo
              </button>
            </div>
          </div>
          <div className="max-h-[480px] overflow-y-auto px-5 py-4">
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed">{content}</pre>
          </div>
        </motion.div>
      )}

      {state === 'error' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs text-red-400">Erro ao gerar documento. Verifique o contexto e tente novamente.</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Automação ───────────────────────────────────────────────────────────

const AUTOMATION_TEMPLATES = [
  {
    emoji:        '💰',
    name:         'Régua de Cobrança',
    desc:         'Sequência automática para inadimplentes',
    trigger_type: 'overdue_payment',
    description:  'Régua de cobrança automática: WhatsApp D+1, Email D+3, WhatsApp D+7, Bloqueio D+15',
    sequence:     ['D+1 WhatsApp', 'D+3 Email', 'D+7 WhatsApp', 'D+15 Bloqueio'],
    steps: [
      { type: 'whatsapp', delay_hours: 24,  message: 'Olá! Identificamos um pagamento pendente. Podemos resolver?' },
      { type: 'email',    delay_hours: 72,  message: 'Lembrete de pagamento pendente. Clique aqui para regularizar.' },
      { type: 'whatsapp', delay_hours: 168, message: 'Última oportunidade antes do bloqueio do serviço.' },
    ],
  },
  {
    emoji:        '🔥',
    name:         'Reativação de Leads',
    desc:         'Reengajamento de leads frios em 4 etapas',
    trigger_type: 'lead_cold',
    description:  'Reengajamento de leads sem atividade há 30+ dias: segmentação, oferta exclusiva, campanha e acompanhamento',
    sequence:     ['Segmenta leads', 'Gera oferta', 'Dispara campanha', 'Mede resultado'],
    steps: [
      { type: 'whatsapp', delay_hours: 0,   message: 'Sentimos sua falta! Temos uma condição especial para você.' },
      { type: 'email',    delay_hours: 48,  message: 'Oferta exclusiva de reativação — válida por 48h.' },
      { type: 'whatsapp', delay_hours: 96,  message: 'Última chance! Sua oferta especial expira amanhã.' },
    ],
  },
  {
    emoji:        '👋',
    name:         'Boas-vindas VIP',
    desc:         'Onboarding completo para novos clientes',
    trigger_type: 'new_customer',
    description:  'Sequência de onboarding: WhatsApp D+0, Email D+1, Pesquisa D+3, Follow-up D+7',
    sequence:     ['D+0 WhatsApp', 'D+1 Email', 'D+3 Pesquisa', 'D+7 Follow-up'],
    steps: [
      { type: 'whatsapp', delay_hours: 1,   message: 'Bem-vindo(a)! Estamos felizes em ter você conosco. Aqui está o que fazer agora.' },
      { type: 'email',    delay_hours: 24,  message: 'Guia completo de início: tudo que você precisa saber.' },
      { type: 'whatsapp', delay_hours: 72,  message: 'Como está sendo sua experiência? Sua opinião é importante!' },
      { type: 'whatsapp', delay_hours: 168, message: 'Precisando de algo? Estamos aqui para ajudar!' },
    ],
  },
  {
    emoji:        '📈',
    name:         'Upsell Inteligente',
    desc:         'Detecta momento certo e propõe upgrade',
    trigger_type: 'upsell_opportunity',
    description:  'Identifica clientes com potencial de upgrade, analisa histórico e envia proposta personalizada',
    sequence:     ['Analisa histórico', 'Detecta momento', 'Gera proposta', 'Acompanha'],
    steps: [
      { type: 'whatsapp', delay_hours: 0,   message: 'Com base no seu uso, temos uma proposta exclusiva de upgrade.' },
      { type: 'email',    delay_hours: 72,  message: 'Proposta personalizada de upgrade — veja o que ganhas.' },
      { type: 'whatsapp', delay_hours: 144, message: 'Ainda considerando? Posso tirar alguma dúvida?' },
    ],
  },
]

function AutomacaoTab() {
  const [activating, setActivating] = useState<number | null>(null)
  const [activated,  setActivated]  = useState<Set<number>>(new Set())
  const [errors,     setErrors]     = useState<Record<number, string>>({})

  async function handleActivate(index: number) {
    const auto = AUTOMATION_TEMPLATES[index]
    setActivating(index)
    setErrors(prev => { const n = { ...prev }; delete n[index]; return n })
    try {
      const res = await fetch('/api/automations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:         auto.name,
          description:  auto.description,
          trigger_type: auto.trigger_type,
          steps:        auto.steps,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setActivated(prev => new Set([...prev, index]))
    } catch {
      setErrors(prev => ({ ...prev, [index]: 'Erro ao ativar. Tente novamente.' }))
    }
    setActivating(null)
  }

  return (
    <div className="space-y-4">
      {AUTOMATION_TEMPLATES.map((a, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className={cn(
            'rounded-2xl border p-5 transition',
            activated.has(i)
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{a.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-white">{a.name}</p>
                <p className="text-xs text-zinc-500">{a.desc}</p>
              </div>
            </div>
            {activated.has(i) ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5">
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">Ativo</span>
              </div>
            ) : (
              <button
                onClick={() => handleActivate(i)}
                disabled={activating === i}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition',
                  activating === i
                    ? 'bg-violet-600/60 cursor-not-allowed'
                    : 'bg-violet-600 hover:bg-violet-500',
                )}
              >
                {activating === i
                  ? <><Loader2 size={11} className="animate-spin" /> Ativando...</>
                  : <><Play size={11} /> Ativar</>
                }
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {a.sequence.map((step, si) => (
              <div key={si} className="flex items-center gap-1.5">
                <span className={cn(
                  'rounded-lg border px-2.5 py-1 text-[10px] font-medium',
                  activated.has(i)
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
                )}>{step}</span>
                {si < a.sequence.length - 1 && <ArrowRight size={10} className="text-zinc-700" />}
              </div>
            ))}
          </div>
          {errors[i] && (
            <p className="mt-2 text-xs text-red-400">{errors[i]}</p>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// ─── OpportunityEngine ────────────────────────────────────────────────────────

interface OpportunityEngineProps {
  onAction: (tab: TabId, obj: Objective) => void
}

function OpportunityEngine({ onAction }: OpportunityEngineProps) {
  const [cards,       setCards]       = useState<OpportunityCard[]>([])
  const [loading,     setLoading]     = useState(true)
  const [summary,     setSummary]     = useState<string>('')
  const [healthScore, setHealthScore] = useState<number>(0)
  const [dismissed,   setDismissed]   = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/creative/opportunities')
      .then(r => r.json())
      .then((data: { cards?: OpportunityCard[]; summary?: string; health_score?: number }) => {
        setCards(data.cards ?? [])
        setSummary(data.summary ?? '')
        setHealthScore(data.health_score ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const visible = cards.filter(c => !dismissed.has(c.id))

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="relative">
          <div className="h-8 w-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Brain size={14} className="text-violet-400" />
          </div>
          <div className="absolute -inset-1 rounded-xl border border-violet-500/30 animate-ping" />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-48 rounded-full bg-zinc-800 animate-pulse" />
          <div className="h-2.5 w-32 rounded-full bg-zinc-800 animate-pulse" />
        </div>
      </div>
    )
  }

  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Header */}
      {summary && (
        <div className="flex items-start gap-3 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
          <div className="relative shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Brain size={14} className="text-violet-400" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-violet-500 border-2 border-zinc-950 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs font-semibold text-violet-300">NEXUS Intelligence</p>
              <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-400 uppercase tracking-wide">LIVE</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">{summary}</p>
          </div>
          {healthScore > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold" style={{ color: healthScore >= 70 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                {healthScore}
              </p>
              <p className="text-[9px] text-zinc-600">saúde</p>
            </div>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((card, i) => {
          const cfg     = TYPE_CONFIG[card.type] ?? TYPE_CONFIG.crescimento
          const urgency = URGENCY_CONFIG[card.urgency]

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.07 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border p-4',
                `bg-gradient-to-br ${cfg.gradient}`,
                cfg.border,
              )}
            >
              {/* Dismiss */}
              <button
                onClick={() => setDismissed(d => new Set([...d, card.id]))}
                className="absolute top-2 right-2 rounded-full p-1 text-zinc-600 hover:text-zinc-400 transition"
              >
                <X size={10} />
              </button>

              {/* Urgency dot */}
              <div className="mb-3 flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', urgency.dot, card.urgency === 'critical' && 'animate-pulse')} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{urgency.label}</span>
              </div>

              {/* Icon + headline */}
              <div className="mb-1 flex items-start gap-2">
                <span className="text-lg leading-none">{card.emoji}</span>
                <p className="text-xs font-semibold text-white leading-snug">{card.headline}</p>
              </div>

              {/* Value */}
              <p className="mb-2 text-lg font-bold text-white">{card.value}</p>

              {/* Description */}
              <p className="mb-4 text-[11px] text-zinc-400 leading-relaxed line-clamp-2">{card.description}</p>

              {/* Actions */}
              <div className="flex flex-wrap gap-1.5">
                {card.actions.map((action, ai) => (
                  <button
                    key={ai}
                    onClick={() => {
                      if (action.action === 'generate_campaign' && action.tab && action.obj) {
                        onAction(action.tab as TabId, action.obj as Objective)
                      } else if (action.href) {
                        window.location.href = action.href
                      }
                    }}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition',
                      ai === 0
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'border border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
                    )}
                  >
                    {action.action === 'generate_campaign'
                      ? <><Sparkles size={9} /> {action.label}</>
                      : <><Navigation size={9} /> {action.label}</>
                    }
                  </button>
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── AutoPilot Toggle ─────────────────────────────────────────────────────────

function AutoPilotToggle() {
  const [enabled,  setEnabled]  = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetch('/api/autopilot/enable')
      .then(r => r.json())
      .then((d: { autopilot_enabled?: boolean }) => setEnabled(d.autopilot_enabled ?? false))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggle() {
    setToggling(true)
    const next = !enabled
    try {
      await fetch('/api/autopilot/enable', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ enabled: next }),
      })
      setEnabled(next)
    } catch { /* ok */ }
    setToggling(false)
  }

  if (loading) return <div className="h-8 w-28 animate-pulse rounded-xl bg-zinc-800" />

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
        enabled
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
          : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
      )}
    >
      {toggling
        ? <Loader2 size={12} className="animate-spin" />
        : <Power size={12} className={enabled ? 'text-emerald-400' : ''} />
      }
      AutoPilot {enabled ? 'ON' : 'OFF'}
      {enabled && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface CreativeStats {
  generated:       number
  response_rate:   string
  conversion_rate: string
  revenue:         string
  loaded:          boolean
}

export default function CreativeAIPage() {
  const [activeTab,     setActiveTab]     = useState<TabId>('whatsapp')
  const [jumpObjective, setJumpObjective] = useState<Objective | null>(null)
  const [stats,         setStats]         = useState<CreativeStats>({
    generated: 0, response_rate: '—', conversion_rate: '—', revenue: 'R$0', loaded: false,
  })

  useEffect(() => {
    fetch('/api/creative/stats')
      .then(r => r.json())
      .then((d: Omit<CreativeStats, 'loaded'>) => setStats({ ...d, loaded: true }))
      .catch(() => setStats(s => ({ ...s, loaded: true })))
  }, [])

  function handleOpportunityAction(tab: TabId, obj: Objective) {
    setActiveTab(tab)
    setJumpObjective(obj)
    setTimeout(() => setJumpObjective(null), 500)
    // scroll to tab content
    document.getElementById('creative-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const tab = TABS.find(t => t.id === activeTab)!

  function renderTab() {
    switch (activeTab) {
      case 'whatsapp':  return <WhatsAppTab  jumpObjective={jumpObjective} />
      case 'email':     return <EmailTab     jumpObjective={jumpObjective} />
      case 'instagram': return <InstagramTab />
      case 'campanhas': return <CampanhasTab jumpObjective={jumpObjective} />
      case 'imagens':   return <ImagensTab />
      case 'pdfs':      return <PdfsTab />
      case 'automacao': return <AutomacaoTab />
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-5 py-8 md:px-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-500/25">
              <Brain size={18} className="text-white" />
            </div>
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-zinc-950 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Creative AI</h1>
            <p className="text-xs text-zinc-500">Motor de inteligência da sua empresa · Online agora</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <AutoPilotToggle />
          <button
            onClick={() => setActiveTab('imagens')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600 transition"
          >
            <Wand2 size={12} /> Criar Imagem
          </button>
          <button
            onClick={() => setActiveTab('campanhas')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600 transition"
          >
            <Megaphone size={12} /> Campanha
          </button>
        </div>
      </div>

      {/* ── Opportunity Engine ── */}
      <OpportunityEngine onAction={handleOpportunityAction} />

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          { label: 'Conteúdos gerados',  value: stats.loaded ? stats.generated.toLocaleString('pt-BR') : null, icon: Sparkles,   color: 'violet'  },
          { label: 'Respostas via IA',   value: stats.loaded ? stats.response_rate   : null,                   icon: Eye,        color: 'emerald' },
          { label: 'Taxa de conversão',  value: stats.loaded ? stats.conversion_rate : null,                   icon: Target,     color: 'blue'    },
          { label: 'Receita (30 dias)',  value: stats.loaded ? stats.revenue          : null,                   icon: DollarSign, color: 'amber'   },
        ] as Array<{ label: string; value: string | null; icon: React.ElementType; color: string }>).map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4 flex items-center gap-3">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl border', colorClass(s.color, 'bg'), colorClass(s.color, 'border'))}>
                <Icon size={16} className={colorClass(s.color, 'text')} />
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">{s.label}</p>
                {s.value !== null
                  ? <p className="text-base font-bold text-white">{s.value}</p>
                  : <div className="mt-1 h-4 w-14 animate-pulse rounded bg-zinc-800" />
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Tab Navigation ── */}
      <div id="creative-tabs" className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        {/* Tab bar */}
        <div className="flex overflow-x-auto border-b border-zinc-800">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold transition-all',
                  active
                    ? `border-violet-500 ${colorClass(t.color, 'text')} bg-violet-500/5`
                    : 'border-transparent text-zinc-500 hover:text-zinc-300',
                )}
              >
                <Icon size={13} />
                <span className="hidden sm:block">{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab heading */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', colorClass(tab.color, 'bg'))}>
              <tab.icon size={12} className={colorClass(tab.color, 'text')} />
            </div>
            <p className="text-sm font-semibold text-white">{tab.label}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', colorClass(tab.color, 'bg'), colorClass(tab.color, 'text'))}>
              IA Ativa
            </span>
          </div>
          <span className="hidden text-[11px] text-zinc-600 sm:block">
            Gera 3 variações simultâneas com tons diferentes
          </span>
        </div>

        {/* Tab content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {renderTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
