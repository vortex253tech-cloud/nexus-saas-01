'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  FolderOpen, Plus, TrendingUp, TrendingDown, DollarSign,
  Loader2, ChevronRight, BarChart3, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id:            string
  name:          string
  type:          string
  description:   string
  goal:          string
  created_at:    string
  totalRevenue:  number
  totalExpenses: number
  profit:        number
}

const TYPE_LABELS: Record<string, string> = {
  product:   '📦 Produto',
  service:   '🛠️ Serviço',
  ecommerce: '🛒 E-commerce',
  saas:      '💻 SaaS',
  other:     '📁 Outro',
}

const FORM_DEFAULTS = { name: '', type: 'product', description: '', goal: '' }

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void
  onCreated: (id: string) => void
}) {
  const [form, setForm]   = useState(FORM_DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      const res  = await fetch('/api/projects', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json() as { id?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'Erro ao criar projeto'); return }
      onCreated(data.id!)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Novo projeto</h2>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nome do projeto *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Loja de roupas online"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tipo</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="product">📦 Produto</option>
              <option value="service">🛠️ Serviço</option>
              <option value="ecommerce">🛒 E-commerce</option>
              <option value="saas">💻 SaaS</option>
              <option value="other">📁 Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Descrição</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descreva brevemente o projeto..."
              rows={2}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Objetivo principal</label>
            <input
              value={form.goal}
              onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
              placeholder="Ex: Faturar R$ 50k/mês"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Criar projeto
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting]  = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/projects')
      const data = await res.json() as { projects?: Project[] }
      setProjects(data.projects ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleDelete(id: string) {
    if (!confirm('Remover projeto e todos os dados?')) return
    setDeleting(id)
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects(p => p.filter(x => x.id !== id))
    setDeleting(null)
  }

  const fmtBRL = (v: number) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FolderOpen size={24} className="text-violet-400" />
            Projetos
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Organize produtos, receitas e custos — analise com IA</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          <Plus size={16} />
          Criar projeto
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-violet-400" />
        </div>
      ) : projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60 border border-zinc-700/50 mb-4">
            <BarChart3 size={28} className="text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Nenhum projeto ainda</h3>
          <p className="text-zinc-500 text-sm max-w-xs mb-6">
            Crie seu primeiro projeto para organizar produtos, receitas e despesas com inteligência artificial.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Criar primeiro projeto
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {projects.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
                className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-violet-600/40 transition-all cursor-pointer"
                onClick={() => router.push(`/dashboard/projects/${p.id}`)}
              >
                {/* Delete btn */}
                <button
                  onClick={e => { e.stopPropagation(); void handleDelete(p.id) }}
                  disabled={deleting === p.id}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  {deleting === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>

                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 border border-violet-600/20 text-lg">
                    {TYPE_LABELS[p.type]?.split(' ')[0] ?? '📁'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate">{p.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{TYPE_LABELS[p.type] ?? p.type}</p>
                  </div>
                </div>

                {p.goal && (
                  <p className="text-xs text-zinc-500 mb-4 line-clamp-1">🎯 {p.goal}</p>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-lg bg-zinc-800/60 px-2 py-2 text-center">
                    <p className="text-[10px] text-zinc-500 mb-0.5">Receita</p>
                    <p className="text-xs font-bold text-emerald-400">{fmtBRL(p.totalRevenue)}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-800/60 px-2 py-2 text-center">
                    <p className="text-[10px] text-zinc-500 mb-0.5">Custos</p>
                    <p className="text-xs font-bold text-red-400">{fmtBRL(p.totalExpenses)}</p>
                  </div>
                  <div className={cn('rounded-lg px-2 py-2 text-center',
                    p.profit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  )}>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Lucro</p>
                    <p className={cn('text-xs font-bold flex items-center justify-center gap-0.5',
                      p.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {p.profit >= 0
                        ? <TrendingUp size={10} />
                        : <TrendingDown size={10} />
                      }
                      {fmtBRL(p.profit)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600">
                    {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-violet-400 font-medium">
                    Ver detalhes <ChevronRight size={12} />
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <CreateModal
            onClose={() => setShowModal(false)}
            onCreated={(id) => { setShowModal(false); router.push(`/dashboard/projects/${id}`) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
