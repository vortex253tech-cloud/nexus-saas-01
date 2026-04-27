'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence }           from 'framer-motion'
import { useRouter }                         from 'next/navigation'
import {
  Map, Plus, Loader2, Zap, Clock, Trash2, ChevronRight, X, Play,
} from 'lucide-react'
import { GROWTH_TEMPLATES } from '@/lib/growth-map-engine'
import { cn } from '@/lib/cn'

interface GrowthMap {
  id: string; name: string; description: string; status: string
  last_executed_at: string | null; updated_at: string
}

const COLOR: Record<string, string> = {
  red:    'bg-red-500/10 border-red-500/30 text-red-400',
  emerald:'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  blue:   'bg-blue-500/10 border-blue-500/30 text-blue-400',
  violet: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Novo mapa de crescimento</h2>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800"><X size={15} /></button>
        </div>

        {/* Name */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nome do mapa *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Ex: Campanha de Recuperação Q2"
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500" />
        </div>

        {/* Templates */}
        <div className="mb-5">
          <p className="text-xs font-medium text-zinc-400 mb-3">Começar com um template (opcional)</p>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(GROWTH_TEMPLATES).map(([key, tpl]) => (
              <button key={key} onClick={() => { setTemplateKey(templateKey === key ? null : key); if (!name) setName(tpl.name) }}
                className={cn(
                  'text-left rounded-xl border p-3.5 transition-all',
                  templateKey === key
                    ? 'border-violet-500 bg-violet-600/15'
                    : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/40',
                )}>
                <div className="text-xl mb-1.5">{tpl.icon}</div>
                <p className="text-sm font-semibold text-white mb-1">{tpl.name}</p>
                <p className="text-xs text-zinc-500 line-clamp-2">{tpl.description}</p>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700">Cancelar</button>
          <button onClick={() => void handleCreate()} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Criar mapa
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GrowthMapPage() {
  const router = useRouter()
  const [maps,      setMaps]      = useState<GrowthMap[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)

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
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Map size={24} className="text-violet-400" />
            Mapa de Crescimento
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Automatize estratégias completas — a IA pensa, decide e executa</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
          <Plus size={16} /> Novo mapa
        </button>
      </div>

      {/* Template preview strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-10">
        {Object.entries(GROWTH_TEMPLATES).map(([key, tpl]) => (
          <button key={key} onClick={() => setShowModal(true)}
            className={cn('text-left rounded-2xl border p-4 transition-all hover:scale-[1.02]', COLOR[tpl.color])}>
            <div className="text-2xl mb-2">{tpl.icon}</div>
            <p className="text-sm font-semibold text-white mb-1">{tpl.name}</p>
            <p className="text-xs opacity-70 line-clamp-2">{tpl.description}</p>
          </button>
        ))}
      </div>

      {/* Maps list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-violet-400" />
        </div>
      ) : maps.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60 border border-zinc-700/50 mb-4">
            <Map size={28} className="text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Nenhum mapa criado</h3>
          <p className="text-zinc-500 text-sm max-w-sm mb-6">
            Crie seu primeiro mapa e deixe a IA definir, executar e medir sua estratégia de crescimento.
          </p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white">
            <Plus size={16} /> Criar primeiro mapa
          </button>
        </motion.div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Meus mapas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {maps.map((m, i) => (
                <motion.div key={m.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}
                  className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-violet-600/40 transition-all cursor-pointer"
                  onClick={() => router.push(`/dashboard/growth-map/${m.id}`)}>

                  <button onClick={e => { e.stopPropagation(); void handleDelete(m.id) }}
                    disabled={deleting === m.id}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    {deleting === m.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/15 border border-violet-600/20 text-lg">🗺</div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{m.name}</h3>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full',
                        m.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
                      )}>{m.status === 'active' ? '● Ativo' : '◯ Rascunho'}</span>
                    </div>
                  </div>

                  {m.description && <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{m.description}</p>}

                  <div className="flex items-center justify-between text-[10px] text-zinc-600">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {m.last_executed_at
                        ? `Executado ${new Date(m.last_executed_at).toLocaleDateString('pt-BR')}`
                        : 'Nunca executado'}
                    </span>
                    <span className="flex items-center gap-1 text-violet-400 font-medium text-xs">
                      Abrir <ChevronRight size={12} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Tip */}
      <div className="mt-10 rounded-2xl border border-violet-600/20 bg-violet-600/5 p-5">
        <div className="flex items-start gap-3">
          <Zap size={18} className="text-violet-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white mb-1">Como funciona o Mapa de Crescimento?</p>
            <p className="text-xs text-zinc-500">
              Cada mapa é um fluxo visual de blocos conectados. A IA analisa seus dados financeiros e de clientes,
              identifica oportunidades, toma decisões estratégicas, gera mensagens personalizadas e dispara ações reais
              como emails e WhatsApp — tudo automaticamente, em sequência.
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && <CreateModal onClose={() => setShowModal(false)}
          onCreated={id => { setShowModal(false); router.push(`/dashboard/growth-map/${id}`) }} />}
      </AnimatePresence>
    </div>
  )
}
