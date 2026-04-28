'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter }                         from 'next/navigation'
import {
  Store, Search, Loader2, Star, Download, Zap, ChevronRight,
  TrendingUp, X, Sparkles, CheckCircle2,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { AIStatus } from '@/components/ui/ai-status'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowTemplate {
  id: string; name: string; description: string
  category: string; icon: string; color: string; tier: string
  usage_count: number; rating: number | null; rating_count: number
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',          label: 'Todos'         },
  { key: 'recovery',     label: 'Recuperação'   },
  { key: 'reactivation', label: 'Reativação'    },
  { key: 'upsell',       label: 'Upsell'        },
  { key: 'sales',        label: 'Vendas'        },
  { key: 'retention',    label: 'Retenção'      },
  { key: 'onboarding',   label: 'Onboarding'    },
  { key: 'general',      label: 'Geral'         },
]

const TIER_BADGE: Record<string, string> = {
  free:       'bg-emerald-500/15 text-emerald-400',
  premium:    'bg-violet-500/15 text-violet-400',
  enterprise: 'bg-amber-500/15 text-amber-400',
}

const COLOR_ACCENT: Record<string, string> = {
  red:    'border-red-500/30    bg-red-500/5',
  emerald:'border-emerald-500/30 bg-emerald-500/5',
  blue:   'border-blue-500/30   bg-blue-500/5',
  violet: 'border-violet-500/30 bg-violet-500/5',
  amber:  'border-amber-500/30  bg-amber-500/5',
}

// ─── AI Generator Modal ───────────────────────────────────────────────────────

function AIGeneratorModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void
  onCreated: (id: string) => void
}) {
  const [prompt,    setPrompt]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [generated, setGenerated] = useState<{ name: string; description: string } | null>(null)
  const [flowData,  setFlowData]  = useState<unknown>(null)
  const [saving,    setSaving]    = useState(false)

  async function handleGenerate() {
    if (!prompt.trim()) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/ai/generate-flow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json() as { flow?: { name: string; description: string; nodes: unknown[]; edges: unknown[] }; error?: string }
      if (!res.ok) { setError(data.error ?? 'Erro ao gerar'); return }
      setGenerated({ name: data.flow!.name, description: data.flow!.description })
      setFlowData(data.flow)
    } catch (e) {
      setError(String(e))
    } finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!flowData) return
    setSaving(true)
    const f = flowData as { name: string; description: string; nodes: unknown[]; edges: unknown[] }
    const res  = await fetch('/api/growth-maps', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: f.name, description: f.description, nodes: f.nodes, edges: f.edges }),
    })
    const data = await res.json() as { id?: string }
    setSaving(false)
    if (data.id) onCreated(data.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-400" />
            <h2 className="text-lg font-bold text-white">Gerar fluxo com IA</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800">
            <X size={15} />
          </button>
        </div>

        {!generated ? (
          <>
            <p className="text-sm text-zinc-400 mb-4">
              Descreva o que você quer automatizar e a IA vai criar o fluxo perfeito para o seu negócio.
            </p>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ex: Quero recuperar clientes que não pagam há mais de 30 dias e enviar uma mensagem personalizada no WhatsApp..."
              rows={4}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none mb-4"
            />
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <button onClick={() => void handleGenerate()} disabled={loading || !prompt.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? 'Gerando fluxo…' : 'Gerar fluxo'}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <p className="text-sm font-semibold text-white">Fluxo gerado com sucesso!</p>
              </div>
              <p className="text-sm font-medium text-white mb-1">{generated.name}</p>
              <p className="text-xs text-zinc-400">{generated.description}</p>
            </div>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setGenerated(null); setFlowData(null) }}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
                Tentar novamente
              </button>
              <button onClick={() => void handleCreate()} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {saving ? 'Criando…' : 'Criar e editar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onImport,
}: {
  template: FlowTemplate
  onImport: (id: string, name: string) => void
}) {
  const accent = COLOR_ACCENT[template.color] ?? COLOR_ACCENT.violet

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      className={cn('rounded-2xl border p-5 flex flex-col gap-3 nexus-card', accent)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-3xl">{template.icon}</span>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', TIER_BADGE[template.tier] ?? TIER_BADGE.free)}>
          {template.tier === 'free' ? 'Grátis' : template.tier === 'premium' ? 'Premium' : 'Enterprise'}
        </span>
      </div>

      <div className="flex-1">
        <p className="text-sm font-bold text-white mb-1">{template.name}</p>
        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{template.description}</p>
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Download size={10} />
          {template.usage_count} usos
        </span>
        {template.rating !== null ? (
          <span className="flex items-center gap-1">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            {template.rating.toFixed(1)} ({template.rating_count})
          </span>
        ) : (
          <span>Sem avaliações</span>
        )}
      </div>

      <button
        onClick={() => onImport(template.id, template.name)}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors">
        <Download size={11} />
        Usar template
      </button>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const router = useRouter()

  const [templates,    setTemplates]    = useState<FlowTemplate[]>([])
  const [loading,      setLoading]      = useState(true)
  const [category,     setCategory]     = useState('all')
  const [search,       setSearch]       = useState('')
  const [importing,    setImporting]    = useState<string | null>(null)
  const [showAI,       setShowAI]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    const res  = await fetch(`/api/flow-templates?${params.toString()}`)
    const data = await res.json() as { templates?: FlowTemplate[] }
    setTemplates(data.templates ?? [])
    setLoading(false)
  }, [category])

  useEffect(() => { void load() }, [load])

  async function handleImport(id: string, name: string) {
    setImporting(id)
    const res  = await fetch(`/api/flow-templates/${id}/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json() as { id?: string }
    setImporting(null)
    if (data.id) router.push(`/dashboard/growth-map/${data.id}`)
  }

  const filtered = templates.filter(t =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-600/20 border border-violet-600/30">
            <Store size={20} className="text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Marketplace de Fluxos</h1>
              <AIStatus state={loading ? 'analyzing' : showAI ? 'processing' : 'idle'} />
            </div>
            <p className="text-xs text-zinc-500">Templates prontos para automatizar seu negócio</p>
          </div>
        </div>

        <button onClick={() => setShowAI(true)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
          <Sparkles size={14} />
          Gerar com IA
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-center gap-3">
          <Store size={16} className="text-violet-400" />
          <div>
            <p className="text-lg font-bold text-white">{templates.length}</p>
            <p className="text-[10px] text-zinc-500">Templates disponíveis</p>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-center gap-3">
          <TrendingUp size={16} className="text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-white">
              {templates.reduce((s, t) => s + t.usage_count, 0)}
            </p>
            <p className="text-[10px] text-zinc-500">Fluxos criados</p>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-center gap-3">
          <Sparkles size={16} className="text-amber-400" />
          <div>
            <p className="text-lg font-bold text-white">IA</p>
            <p className="text-[10px] text-zinc-500">Gerador inteligente</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar templates…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                category === c.key
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
              )}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Store size={32} className="text-zinc-700" />
          <p className="text-zinc-500 text-sm">Nenhum template encontrado</p>
          <button onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300">
            <Sparkles size={12} />
            Gerar um fluxo personalizado com IA
            <ChevronRight size={12} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="relative">
              {importing === t.id && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-zinc-900/80 backdrop-blur-sm">
                  <Loader2 size={20} className="animate-spin text-violet-400" />
                </div>
              )}
              <TemplateCard
                template={t}
                onImport={(id, name) => void handleImport(id, name)}
              />
            </div>
          ))}
        </div>
      )}

      {/* CTA: Save your own */}
      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white mb-0.5">Tem um fluxo que funciona?</p>
          <p className="text-xs text-zinc-500">Compartilhe com a comunidade e ajude outros negócios a crescer.</p>
        </div>
        <button onClick={() => router.push('/dashboard/growth-map')}
          className="flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors">
          Meus fluxos
          <ChevronRight size={14} />
        </button>
      </div>

      {showAI && (
        <AIGeneratorModal
          onClose={() => setShowAI(false)}
          onCreated={id => router.push(`/dashboard/growth-map/${id}`)}
        />
      )}
    </div>
  )
}
