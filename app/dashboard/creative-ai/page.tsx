'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Image as LucideImage, MessageSquare, Mail, Camera, FileText,
  Megaphone, Globe, Zap, Copy, Download, Send, Calendar,
  Heart, Share2, Loader2, CheckCircle2, RefreshCw,
  ChevronRight, Plus, TrendingUp, Target,
  BarChart3, DollarSign, Palette, Wand2, Play, Bookmark,
  LayoutTemplate, ArrowRight, Eye, Edit3,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'imagens' | 'whatsapp' | 'email' | 'instagram' | 'pdfs' | 'campanhas' | 'landing' | 'automacao'
type Objective = 'cobranca' | 'reativacao' | 'lancamento' | 'promocao' | 'boas_vindas' | 'follow_up'
type GenState  = 'idle' | 'generating' | 'done' | 'error'

interface GeneratedContent {
  text?:       string
  json?:       unknown
  asset_id?:   string
  company_name?: string
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
  { id: 'imagens',   label: 'Imagens',       icon: LucideImage,    color: 'violet'  },
  { id: 'whatsapp',  label: 'WhatsApp',       icon: MessageSquare,  color: 'emerald' },
  { id: 'email',     label: 'Email',          icon: Mail,           color: 'blue'    },
  { id: 'instagram', label: 'Instagram',      icon: Camera,         color: 'pink'    },
  { id: 'pdfs',      label: 'PDFs',           icon: FileText,       color: 'amber'   },
  { id: 'campanhas', label: 'Campanhas',      icon: Megaphone,      color: 'orange'  },
  { id: 'landing',   label: 'Landing Pages',  icon: Globe,          color: 'cyan'    },
  { id: 'automacao', label: 'Automação IA',   icon: Zap,            color: 'purple'  },
]

const OBJECTIVES: Array<{ value: Objective; label: string; emoji: string }> = [
  { value: 'cobranca',    label: 'Cobrança',       emoji: '💰' },
  { value: 'reativacao',  label: 'Reativação',     emoji: '🔥' },
  { value: 'lancamento',  label: 'Lançamento',     emoji: '🚀' },
  { value: 'promocao',    label: 'Promoção',       emoji: '🎯' },
  { value: 'boas_vindas', label: 'Boas-vindas',    emoji: '👋' },
  { value: 'follow_up',   label: 'Follow-up',      emoji: '📞' },
]

const NICHES = [
  'Restaurantes', 'Academias', 'Clínicas', 'E-commerce',
  'Salões de Beleza', 'Imobiliárias', 'Consultórios', 'Pet Shops',
  'Cursos Online', 'Advocacia', 'Contabilidade', 'Varejo',
]

const IMAGE_STYLES = [
  { id: 'corporate',  label: 'Corporativo',  desc: 'Sóbrio e profissional'    },
  { id: 'vibrant',    label: 'Vibrante',     desc: 'Cores fortes, energético' },
  { id: 'minimal',    label: 'Minimalista',  desc: 'Clean e moderno'          },
  { id: 'luxury',     label: 'Luxo',         desc: 'Elegante e exclusivo'     },
]

const IMAGE_RATIOS = [
  { id: 'square',    label: '1:1',     desc: 'Feed Instagram / WhatsApp' },
  { id: 'portrait',  label: '9:16',    desc: 'Stories / Reels'           },
  { id: 'landscape', label: '16:9',    desc: 'Email / Banner web'        },
  { id: 'banner',    label: '3:1',     desc: 'Capa Facebook / LinkedIn'  },
]

const STATS = [
  { label: 'Conteúdos gerados', value: '2.847',     icon: Sparkles,    color: 'violet' },
  { label: 'Taxa de abertura',  value: '68,4%',     icon: Eye,         color: 'emerald'},
  { label: 'Taxa de conversão', value: '12,1%',     icon: Target,      color: 'blue'   },
  { label: 'Receita recuperada',value: 'R$ 47.820', icon: DollarSign,  color: 'amber'  },
]

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
  }
  return map[color]?.[variant] ?? ''
}

async function generate(
  type:      string,
  channel:   string,
  objective: string,
  context:   string,
): Promise<GeneratedContent> {
  const res = await fetch('/api/creative/generate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ type, channel, objective, context }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<GeneratedContent>
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ stat }: { stat: typeof STATS[number] }) {
  const Icon = stat.icon
  return (
    <div className={cn(
      'rounded-2xl border p-4 flex items-center gap-4',
      'bg-zinc-900/40 border-zinc-800/60',
    )}>
      <div className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl border',
        colorClass(stat.color, 'bg'),
        colorClass(stat.color, 'border'),
      )}>
        <Icon size={18} className={colorClass(stat.color, 'text')} />
      </div>
      <div>
        <p className="text-xs text-zinc-500">{stat.label}</p>
        <p className="text-lg font-bold text-white">{stat.value}</p>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-violet-500/50 hover:text-violet-400"
    >
      {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

function GenerateButton({
  onClick,
  loading,
  label = 'Gerar com IA',
}: { onClick: () => void; loading: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all',
        'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'shadow-lg shadow-violet-500/20',
      )}
    >
      {loading ? (
        <><Loader2 size={15} className="animate-spin" /> Gerando...</>
      ) : (
        <><Sparkles size={15} /> {label}</>
      )}
    </button>
  )
}

function ResultBox({
  content,
  onRegenerate,
}: { content: GeneratedContent; onRegenerate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400">Conteúdo gerado</span>
          {content.company_name && (
            <span className="text-xs text-zinc-500">· para {content.company_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1 rounded-lg p-1.5 text-zinc-500 transition hover:text-violet-400"
          >
            <RefreshCw size={13} />
          </button>
          {content.text && <CopyButton text={content.text} />}
        </div>
      </div>

      {content.text && (
        <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-200 leading-relaxed">
          {content.text}
        </pre>
      )}
    </motion.div>
  )
}

function ObjectiveSelector({
  value,
  onChange,
}: { value: Objective; onChange: (v: Objective) => void }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        Objetivo
      </label>
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

// ─── Tab: WhatsApp ────────────────────────────────────────────────────────────

function WhatsAppTab() {
  const [objective, setObjective] = useState<Objective>('cobranca')
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [result,    setResult]    = useState<GeneratedContent | null>(null)

  async function handleGenerate() {
    setState('generating')
    try {
      const data = await generate('message', 'whatsapp', objective, context)
      setResult(data)
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Config */}
        <div className="space-y-5">
          <ObjectiveSelector value={objective} onChange={setObjective} />

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Contexto (opcional)
            </label>
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
            <p className="text-xs text-red-400">Erro ao gerar. Tente novamente.</p>
          )}
        </div>

        {/* Right: Preview phone */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[260px]">
            <div className="rounded-3xl border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
              <div className="mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
                <div className="h-8 w-8 rounded-full bg-emerald-600/20 flex items-center justify-center">
                  <MessageSquare size={14} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">WhatsApp</p>
                  <p className="text-[10px] text-zinc-500">Preview</p>
                </div>
              </div>
              <div className="rounded-2xl rounded-tl-none bg-zinc-800 p-3 text-xs text-zinc-300 leading-relaxed min-h-[80px]">
                {result?.text
                  ? result.text.slice(0, 180) + (result.text.length > 180 ? '…' : '')
                  : <span className="text-zinc-600 italic">O conteúdo gerado aparecerá aqui</span>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {result && state === 'done' && (
        <ResultBox content={result} onRegenerate={handleGenerate} />
      )}

      {result && state === 'done' && (
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20">
            <Send size={14} /> Enviar via WhatsApp
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200">
            <Bookmark size={14} /> Salvar template
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200">
            <Calendar size={14} /> Agendar envio
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Email ───────────────────────────────────────────────────────────────

function EmailTab() {
  const [objective, setObjective] = useState<Objective>('promocao')
  const [context,   setContext]   = useState('')
  const [genBody,   setGenBody]   = useState<GenState>('idle')
  const [genSubj,   setGenSubj]   = useState<GenState>('idle')
  const [body,      setBody]      = useState<GeneratedContent | null>(null)
  const [subjects,  setSubjects]  = useState<string[]>([])
  const [selSubj,   setSelSubj]   = useState<string | null>(null)

  async function handleGenerateBody() {
    setGenBody('generating')
    try {
      const data = await generate('message', 'email', objective, context)
      setBody(data)
      setGenBody('done')
    } catch {
      setGenBody('error')
    }
  }

  async function handleGenerateSubjects() {
    setGenSubj('generating')
    try {
      const data = await generate('subject', 'email', objective, context)
      const lines = (data.text ?? '').split('\n').filter(Boolean)
      setSubjects(lines)
      setSelSubj(lines[0] ?? null)
      setGenSubj('done')
    } catch {
      setGenSubj('error')
    }
  }

  return (
    <div className="space-y-6">
      <ObjectiveSelector value={objective} onChange={setObjective} />

      <div>
        <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Contexto
        </label>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Ex: Promoção de Black Friday, 30% de desconto em todos os planos até domingo..."
          rows={3}
          className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-500/50 transition"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GenerateButton
          onClick={handleGenerateBody}
          loading={genBody === 'generating'}
          label="Gerar corpo do email"
        />
        <GenerateButton
          onClick={handleGenerateSubjects}
          loading={genSubj === 'generating'}
          label="Gerar assuntos"
        />
      </div>

      {subjects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2"
        >
          <p className="text-xs font-semibold text-blue-400 mb-3">Escolha o assunto do email</p>
          {subjects.map((s, i) => (
            <button
              key={i}
              onClick={() => setSelSubj(s)}
              className={cn(
                'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                selSubj === s
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200',
              )}
            >
              {selSubj === s && <CheckCircle2 size={12} className="shrink-0 text-blue-400" />}
              <span className="flex-1">{s}</span>
              <CopyButton text={s} />
            </button>
          ))}
        </motion.div>
      )}

      {body && genBody === 'done' && (
        <ResultBox content={body} onRegenerate={handleGenerateBody} />
      )}

      {(body || selSubj) && (
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-500/20">
            <Send size={14} /> Enviar email
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-200">
            <Calendar size={14} /> Agendar
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-200">
            <Eye size={14} /> Prévia completa
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Instagram ───────────────────────────────────────────────────────────

function InstagramTab() {
  const [objective, setObjective] = useState<Objective>('promocao')
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [result,    setResult]    = useState<GeneratedContent | null>(null)

  async function handleGenerate() {
    setState('generating')
    try {
      const data = await generate('caption', 'instagram', objective, context)
      setResult(data)
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-5">
          <ObjectiveSelector value={objective} onChange={setObjective} />
          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Contexto do post
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Ex: Foto do nosso novo produto X, campanha de lançamento com 20% off..."
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-pink-500/50 transition"
            />
          </div>
          <GenerateButton onClick={handleGenerate} loading={state === 'generating'} label="Gerar legenda" />
        </div>

        {/* Instagram preview */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="flex items-center gap-2.5 p-3 border-b border-zinc-800">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-400" />
              <div>
                <p className="text-xs font-semibold text-white">sua_empresa</p>
                <p className="text-[10px] text-zinc-500">Instagram</p>
              </div>
              <div className="ml-auto flex gap-1">
                <div className="h-1 w-1 rounded-full bg-zinc-600" />
                <div className="h-1 w-1 rounded-full bg-zinc-600" />
                <div className="h-1 w-1 rounded-full bg-zinc-600" />
              </div>
            </div>
            <div className="bg-zinc-800 aspect-square flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-zinc-600">
                <LucideImage size={32} className="opacity-30" />
                <p className="text-[10px]">Sua imagem aqui</p>
              </div>
            </div>
            <div className="p-3">
              <div className="flex gap-3 mb-2 text-zinc-400">
                <Heart size={18} />
                <MessageSquare size={18} />
                <Share2 size={18} />
                <Bookmark size={18} className="ml-auto" />
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed line-clamp-4">
                {result?.text
                  ? result.text.slice(0, 120) + '…'
                  : <span className="text-zinc-600 italic">Legenda gerada aparecerá aqui</span>
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {result && state === 'done' && (
        <ResultBox content={result} onRegenerate={handleGenerate} />
      )}

      {result && state === 'done' && (
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-sm font-medium text-pink-400 transition hover:bg-pink-500/20">
            <Camera size={14} /> Publicar agora
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-200">
            <Calendar size={14} /> Agendar post
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-200">
            <Bookmark size={14} /> Salvar rascunho
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Campanhas ───────────────────────────────────────────────────────────

function CampanhasTab() {
  const [objective, setObjective] = useState<Objective>('reativacao')
  const [channel,   setChannel]   = useState<'whatsapp' | 'email'>('whatsapp')
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [campaign,  setCampaign]  = useState<Campaign | null>(null)
  const [expanded,  setExpanded]  = useState<number | null>(0)

  async function handleGenerate() {
    setState('generating')
    try {
      const data = await generate('campaign', channel, objective, context)
      if (data.json) {
        setCampaign(data.json as Campaign)
      } else {
        setCampaign(null)
      }
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 size={16} className="text-orange-400" />
          <span className="text-sm font-semibold text-orange-300">Criador de Campanhas IA</span>
        </div>
        <p className="text-xs text-zinc-400">
          Descreva o objetivo da campanha e a IA cria automaticamente toda a sequência de mensagens, timing e estratégia personalizada para sua empresa.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <ObjectiveSelector value={objective} onChange={setObjective} />

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Canal</label>
            <div className="flex gap-2">
              {(['whatsapp', 'email'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition',
                    channel === c
                      ? 'border-orange-500/50 bg-orange-500/15 text-orange-300'
                      : 'border-zinc-800 text-zinc-400 hover:border-zinc-600',
                  )}
                >
                  {c === 'whatsapp' ? <MessageSquare size={13} /> : <Mail size={13} />}
                  {c === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Contexto da campanha</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Ex: Clientes inativos há mais de 60 dias, oferecer desconto progressivo de até 30%..."
              rows={4}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/50 transition"
            />
          </div>

          <GenerateButton onClick={handleGenerate} loading={state === 'generating'} label="Criar campanha completa" />
        </div>

        {/* Metrics preview */}
        <div className="space-y-3">
          {campaign && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
                <p className="text-sm font-bold text-white mb-1">{campaign.name}</p>
                <p className="text-xs text-zinc-400">Público: {campaign.audience}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center">
                  <p className="text-xs text-zinc-500">Abertura</p>
                  <p className="text-base font-bold text-emerald-400">{campaign.expected_results.open_rate}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center">
                  <p className="text-xs text-zinc-500">Conversão</p>
                  <p className="text-base font-bold text-violet-400">{campaign.expected_results.conversion_rate}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center">
                  <p className="text-xs text-zinc-500">Potencial</p>
                  <p className="text-[10px] font-bold text-amber-400 leading-tight">{campaign.expected_results.revenue_potential}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {campaign && state === 'done' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Sequência de mensagens</p>
          {campaign.messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'rounded-2xl border transition-all cursor-pointer',
                expanded === i
                  ? 'border-orange-500/30 bg-orange-500/5'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
              )}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-400">
                  {msg.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Mensagem {msg.step}</p>
                  <p className="text-xs text-zinc-500">{msg.delay} · {msg.channel}</p>
                </div>
                <ChevronRight
                  size={14}
                  className={cn('text-zinc-500 transition-transform', expanded === i && 'rotate-90')}
                />
              </div>
              <AnimatePresence>
                {expanded === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-zinc-800 p-4 pt-3">
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <div className="mt-3 flex gap-2">
                        <CopyButton text={msg.content} />
                        <button className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
                          <Edit3 size={11} /> Editar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          <div className="flex flex-wrap gap-3 pt-2">
            <button className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition hover:bg-orange-500/20">
              <Play size={14} /> Lançar campanha
            </button>
            <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-200">
              <Calendar size={14} /> Agendar
            </button>
            <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-200">
              <Download size={14} /> Exportar
            </button>
            <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-200">
              <Bookmark size={14} /> Salvar template
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Tab: Imagens ─────────────────────────────────────────────────────────────

function ImagensTab() {
  const [style,     setStyle]     = useState('corporate')
  const [ratio,     setRatio]     = useState('square')
  const [objective, setObjective] = useState<Objective>('promocao')
  const [prompt,    setPrompt]    = useState('')

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-400" />
          <p className="text-sm font-semibold text-violet-300">Geração de imagens via IA</p>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">Integração com DALL-E 3 / Stable Diffusion. Configure abaixo e ative sua chave de API nas configurações.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Estilo visual</label>
            <div className="grid grid-cols-2 gap-2">
              {IMAGE_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-xl border p-3 text-left transition',
                    style === s.id
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
                  )}
                >
                  <span className="text-xs font-semibold text-white">{s.label}</span>
                  <span className="text-[10px] text-zinc-500">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Proporção</label>
            <div className="grid grid-cols-2 gap-2">
              {IMAGE_RATIOS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRatio(r.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 transition',
                    ratio === r.id
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
                  )}
                >
                  <span className="text-sm font-bold text-white">{r.label}</span>
                  <span className="text-[10px] text-zinc-500">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <ObjectiveSelector value={objective} onChange={setObjective} />

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Descrição</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ex: Banner de promoção de fim de ano com tema natalino, cores quentes..."
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition"
            />
          </div>

          <button
            disabled
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600/50 to-purple-600/50 cursor-not-allowed opacity-60"
          >
            <LucideImage size={15} /> Gerar imagem (configure API nas settings)
          </button>
        </div>

        {/* Placeholder grid */}
        <div>
          <p className="mb-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Gerados recentemente</p>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col items-center justify-center gap-2 text-zinc-700 hover:border-zinc-700 transition cursor-pointer"
              >
                <LucideImage size={20} className="opacity-30" />
                <span className="text-[10px]">Nenhuma imagem</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Landing Pages ───────────────────────────────────────────────────────

function LandingTab() {
  const [objective, setObjective] = useState<Objective>('lancamento')
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [result,    setResult]    = useState<GeneratedContent | null>(null)

  async function handleGenerate() {
    setState('generating')
    try {
      const data = await generate('landing_section', 'general', objective, context)
      setResult(data)
      setState('done')
    } catch {
      setState('error')
    }
  }

  // Parse JSON result
  type LandingContent = {
    headline: string; subheadline: string; body: string
    benefits: string[]; cta: string
  }
  const landing: LandingContent | null = result?.json
    ? (result.json as unknown as LandingContent)
    : null

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <ObjectiveSelector value={objective} onChange={setObjective} />
          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Produto / serviço</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Ex: Curso online de confeitaria, 8 módulos, R$497, bônus de fichas técnicas..."
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-500/50 transition"
            />
          </div>
          <GenerateButton onClick={handleGenerate} loading={state === 'generating'} label="Gerar seção da landing" />
        </div>

        {/* Live preview */}
        {landing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 space-y-4"
          >
            <h2 className="text-xl font-bold text-white leading-tight">{landing.headline}</h2>
            <p className="text-sm text-zinc-400">{landing.subheadline}</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{landing.body}</p>
            {landing.benefits?.length > 0 && (
              <ul className="space-y-2">
                {landing.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-cyan-400" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <button className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-bold text-white">
              {landing.cta}
            </button>
          </motion.div>
        )}
      </div>

      {result && state === 'done' && !landing && (
        <ResultBox content={result} onRegenerate={handleGenerate} />
      )}

      {result && state === 'done' && (
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition hover:bg-cyan-500/20">
            <Globe size={14} /> Publicar landing page
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-200">
            <Download size={14} /> Exportar HTML
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: PDFs ────────────────────────────────────────────────────────────────

function PdfsTab() {
  const [objective, setObjective] = useState<Objective>('cobranca')
  const [context,   setContext]   = useState('')
  const [state,     setState]     = useState<GenState>('idle')
  const [result,    setResult]    = useState<GeneratedContent | null>(null)

  async function handleGenerate() {
    setState('generating')
    try {
      const data = await generate('message', 'general', objective, context)
      setResult(data)
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-amber-400" />
          <p className="text-sm font-semibold text-amber-300">Gerador de PDFs inteligentes</p>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Propostas comerciais, contratos, boletos, relatórios — gerados automaticamente com a identidade da sua empresa.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FileText, label: 'Proposta Comercial', desc: 'Com valores e benefícios' },
          { icon: FileText, label: 'Boleto Personalizado', desc: 'Com logo e dados da empresa' },
          { icon: BarChart3, label: 'Relatório Executivo', desc: 'KPIs e métricas visuais' },
        ].map((t, i) => (
          <button
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-left hover:border-amber-500/30 hover:bg-amber-500/5 transition group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <t.icon size={16} className="text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-white group-hover:text-amber-300 transition">{t.label}</p>
            <p className="text-xs text-zinc-500">{t.desc}</p>
            <div className="flex items-center gap-1 mt-auto text-xs text-amber-400 opacity-0 group-hover:opacity-100 transition">
              Gerar <ArrowRight size={10} />
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <ObjectiveSelector value={objective} onChange={setObjective} />
        <div>
          <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Conteúdo / dados</label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Ex: Proposta para cliente João Silva, serviço de manutenção mensal R$1.500..."
            rows={3}
            className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/50 transition"
          />
        </div>
        <GenerateButton onClick={handleGenerate} loading={state === 'generating'} label="Gerar documento" />
      </div>

      {result && state === 'done' && (
        <ResultBox content={result} onRegenerate={handleGenerate} />
      )}

      {result && state === 'done' && (
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/20">
            <Download size={14} /> Baixar PDF
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-200">
            <Send size={14} /> Enviar por email
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Automação ───────────────────────────────────────────────────────────

function AutomacaoTab() {
  const automations = [
    {
      name:     'Cobrança automática de inadimplentes',
      trigger:  'Cliente em atraso há 3+ dias',
      sequence: ['WhatsApp dia 3', 'WhatsApp dia 7', 'Email dia 10', 'WhatsApp dia 15'],
      active:   true,
      color:    'red',
    },
    {
      name:     'Reativação de clientes inativos',
      trigger:  'Sem compra há 60+ dias',
      sequence: ['Email oferta especial', 'WhatsApp lembrete', 'Email urgência'],
      active:   true,
      color:    'orange',
    },
    {
      name:     'Boas-vindas ao novo cliente',
      trigger:  'Novo cliente cadastrado',
      sequence: ['WhatsApp boas-vindas', 'Email apresentação', 'WhatsApp tutorial'],
      active:   false,
      color:    'emerald',
    },
    {
      name:     'Follow-up pós-proposta',
      trigger:  'Proposta enviada há 48h sem resposta',
      sequence: ['WhatsApp acompanhamento', 'Email com cases', 'Ligação lembrete'],
      active:   false,
      color:    'violet',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">Fluxos que criam conteúdo personalizado automaticamente usando IA</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white">
          <Plus size={14} /> Nova automação
        </button>
      </div>

      <div className="grid gap-4">
        {automations.map((a, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 transition"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    a.active ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-zinc-600',
                  )} />
                  <p className="text-sm font-semibold text-white">{a.name}</p>
                </div>
                <p className="text-xs text-zinc-500">Gatilho: {a.trigger}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                  a.active
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500',
                )}>
                  {a.active ? 'Ativo' : 'Pausado'}
                </span>
                <button className="rounded-lg p-1.5 text-zinc-500 hover:text-white transition hover:bg-zinc-800">
                  <Edit3 size={13} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {a.sequence.map((step, si) => (
                <div key={si} className="flex items-center gap-1.5">
                  <span className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-[10px] font-medium text-zinc-300">
                    {step}
                  </span>
                  {si < a.sequence.length - 1 && <ArrowRight size={10} className="text-zinc-700" />}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-zinc-700 p-8 flex flex-col items-center gap-3 text-center hover:border-violet-500/40 transition cursor-pointer group">
        <div className="h-12 w-12 rounded-2xl border border-zinc-700 bg-zinc-900 flex items-center justify-center group-hover:border-violet-500/40 transition">
          <Zap size={20} className="text-zinc-500 group-hover:text-violet-400 transition" />
        </div>
        <p className="text-sm font-semibold text-zinc-400 group-hover:text-white transition">Criar nova automação com IA</p>
        <p className="text-xs text-zinc-600">Descreva o que você quer automatizar e a IA cria o fluxo completo</p>
      </div>
    </div>
  )
}

// ─── Template Library ─────────────────────────────────────────────────────────

function TemplateLibrary({ onUse }: { onUse: (tab: TabId, objective: Objective) => void }) {
  const templates = [
    { niche: 'Restaurantes',   tab: 'whatsapp' as TabId, obj: 'promocao'    as Objective, label: 'Promoção do dia',      icon: '🍽️' },
    { niche: 'Academias',      tab: 'whatsapp' as TabId, obj: 'reativacao'  as Objective, label: 'Reativar alunos',      icon: '💪' },
    { niche: 'Clínicas',       tab: 'email'    as TabId, obj: 'boas_vindas' as Objective, label: 'Boas-vindas paciente', icon: '🏥' },
    { niche: 'E-commerce',     tab: 'email'    as TabId, obj: 'cobranca'    as Objective, label: 'Boleto vencido',        icon: '🛒' },
    { niche: 'Salão de Beleza',tab: 'whatsapp' as TabId, obj: 'follow_up'   as Objective, label: 'Confirmação de horário',icon: '✂️' },
    { niche: 'Consultoria',    tab: 'email'    as TabId, obj: 'lancamento'  as Objective, label: 'Lançamento de serviço', icon: '📊' },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutTemplate size={14} className="text-zinc-500" />
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Templates por nicho</p>
        </div>
        <button className="text-xs text-violet-400 hover:text-violet-300 transition">Ver todos</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {templates.map((t, i) => (
          <button
            key={i}
            onClick={() => onUse(t.tab, t.obj)}
            className="flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-left hover:border-violet-500/30 hover:bg-violet-500/5 transition group"
          >
            <span className="text-lg">{t.icon}</span>
            <p className="text-xs font-semibold text-white">{t.label}</p>
            <p className="text-[10px] text-zinc-500">{t.niche}</p>
            <div className="flex items-center gap-1 text-[10px] text-violet-400 opacity-0 group-hover:opacity-100 transition">
              Usar <ArrowRight size={9} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreativeAIPage() {
  const [activeTab,  setActiveTab]  = useState<TabId>('whatsapp')
  const [showLib,    setShowLib]    = useState(false)

  const tab = TABS.find(t => t.id === activeTab)!

  function handleUseTemplate(tab: TabId, _obj: Objective) {
    setActiveTab(tab)
    setShowLib(false)
  }

  function renderTab() {
    switch (activeTab) {
      case 'whatsapp':  return <WhatsAppTab />
      case 'email':     return <EmailTab />
      case 'instagram': return <InstagramTab />
      case 'campanhas': return <CampanhasTab />
      case 'imagens':   return <ImagensTab />
      case 'landing':   return <LandingTab />
      case 'pdfs':      return <PdfsTab />
      case 'automacao': return <AutomacaoTab />
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-5 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-500/20">
              <Sparkles size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">Creative AI</h1>
              <p className="text-xs text-zinc-500">Motor criativo inteligente da sua empresa</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLib(!showLib)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition',
              showLib
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200',
            )}
          >
            <LayoutTemplate size={13} />
            Templates
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition">
            <Palette size={13} />
            Identidade
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <StatCard key={i} stat={s} />
        ))}
      </div>

      {/* Template Library drawer */}
      <AnimatePresence>
        {showLib && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <TemplateLibrary onUse={handleUseTemplate} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <div className="mb-6 flex overflow-x-auto gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-1 scrollbar-hide">
        {TABS.map(t => {
          const active = t.id === activeTab
          const Icon   = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all whitespace-nowrap',
                active
                  ? cn('border', colorClass(t.color, 'bg'), colorClass(t.color, 'text'), colorClass(t.color, 'border'))
                  : 'border border-transparent text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300',
              )}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="mb-5 flex items-center gap-2 border-b border-zinc-800/60 pb-4">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-xl border',
            colorClass(tab.color, 'bg'),
            colorClass(tab.color, 'border'),
          )}>
            <tab.icon size={15} className={colorClass(tab.color, 'text')} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{tab.label}</p>
            <p className="text-[11px] text-zinc-500">
              {activeTab === 'whatsapp'  && 'Mensagens personalizadas para WhatsApp'}
              {activeTab === 'email'     && 'Emails e sequências automatizadas'}
              {activeTab === 'instagram' && 'Legendas e conteúdo para Instagram'}
              {activeTab === 'campanhas' && 'Campanhas multi-canal com sequências IA'}
              {activeTab === 'imagens'   && 'Banners, posts e criativos visuais'}
              {activeTab === 'landing'   && 'Páginas de conversão para seus produtos'}
              {activeTab === 'pdfs'      && 'Documentos, propostas e relatórios PDF'}
              {activeTab === 'automacao' && 'Fluxos automatizados com conteúdo IA'}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
