'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, FolderKanban, Search, CheckSquare, Clock,
  AlertCircle, Trash2, ArrowRight, Target, X, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task { id: string; status: string; priority: string }

interface Project {
  id:           string
  name:         string
  type?:        string
  description?: string
  goal?:        number
  status?:      string
  created_at:   string
  tasks?:       Task[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:    { label: 'Ativo',      cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' },
  paused:    { label: 'Pausado',    cls: 'bg-amber-500/20  text-amber-400  border-amber-500/20' },
  completed: { label: 'Concluído',  cls: 'bg-violet-500/20 text-violet-400 border-violet-500/20' },
  archived:  { label: 'Arquivado', cls: 'bg-zinc-500/20   text-zinc-400   border-zinc-500/20' },
} as const

function getStats(tasks: Task[] = []) {
  const total      = tasks.length
  const done       = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const urgent     = tasks.filter(t => t.priority === 'urgent').length
  const progress   = total > 0 ? Math.round((done / total) * 100) : 0
  return { total, done, inProgress, urgent, progress }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [showNew,  setShowNew]  = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ name: '', type: 'produto', description: '', goal: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) return
      const { data } = await res.json()

      const withTasks = await Promise.all(
        (data || []).map(async (p: Project) => {
          try {
            const tr = await fetch(`/api/projects/${p.id}/tasks`)
            if (tr.ok) {
              const { data: tasks } = await tr.json()
              return { ...p, tasks: tasks || [] }
            }
          } catch { /* ignore */ }
          return { ...p, tasks: [] }
        }),
      )
      setProjects(withTasks)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

  const totalTasks  = projects.reduce((s, p) => s + (p.tasks?.length ?? 0), 0)
  const doneTasks   = projects.reduce((s, p) => s + (p.tasks?.filter(t => t.status === 'done').length ?? 0), 0)
  const inProgTasks = projects.reduce((s, p) => s + (p.tasks?.filter(t => t.status === 'in_progress').length ?? 0), 0)
  const overallPct  = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:        form.name.trim(),
          type:        form.type,
          description: form.description || null,
          goal:        form.goal ? Number(form.goal) : null,
        }),
      })
      if (res.ok) {
        setShowNew(false)
        setForm({ name: '', type: 'produto', description: '', goal: '' })
        load()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch { /* ignore */ }
    setDeleting(null)
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
            <FolderKanban size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Projetos</h1>
            <p className="text-xs text-zinc-500">
              {projects.length} projeto{projects.length !== 1 ? 's' : ''} · {totalTasks} tarefa{totalTasks !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition"
        >
          <Plus size={15} />
          Novo projeto
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Projetos',        value: projects.length, icon: FolderKanban, color: 'text-violet-400' },
          { label: 'Em andamento',    value: inProgTasks,     icon: Clock,        color: 'text-amber-400' },
          { label: 'Conclusão geral', value: `${overallPct}%`, icon: Target,      color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <s.icon size={13} className={s.color} />
              <span className="text-xs text-zinc-500">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar projetos..."
          className="w-full pl-9 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-800/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition"
        />
      </div>

      {/* Projects */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <FolderKanban size={28} className="text-zinc-700" />
          </div>
          <div>
            <p className="text-zinc-400 font-medium">Nenhum projeto encontrado</p>
            <p className="text-zinc-600 text-sm mt-1">Crie seu primeiro projeto para começar</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-sm font-medium rounded-xl transition border border-violet-500/20"
          >
            <Plus size={14} /> Criar projeto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project, i) => {
            const s   = getStats(project.tasks)
            const cfg = STATUS_CFG[project.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.active
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700/50 transition cursor-pointer relative"
                onClick={() => router.push(`/dashboard/projects/${project.id}`)}
              >
                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(project.id) }}
                  disabled={deleting === project.id}
                  className="absolute top-4 right-4 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition"
                >
                  {deleting === project.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} />}
                </button>

                {/* Name */}
                <div className="mb-4 pr-6">
                  <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded-full border mb-1.5', cfg.cls)}>
                    {cfg.label}
                  </span>
                  <h3 className="font-semibold text-white text-sm leading-snug">{project.name}</h3>
                  {project.description && (
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{project.description}</p>
                  )}
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-500">Progresso</span>
                    <span className="font-medium text-white">{s.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-300"
                      style={{ width: `${s.progress}%` }}
                    />
                  </div>
                </div>

                {/* Task chips */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <CheckSquare size={12} className="text-emerald-400" />
                    {s.done}/{s.total} concluídas
                  </div>
                  {s.inProgress > 0 && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Clock size={12} className="text-amber-400" />
                      {s.inProgress} andando
                    </div>
                  )}
                  {s.urgent > 0 && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <AlertCircle size={12} className="text-red-400" />
                      {s.urgent} urgentes
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
                  <span className="text-xs text-zinc-600">
                    {new Date(project.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <ArrowRight size={13} className="text-zinc-600 group-hover:text-violet-400 transition" />
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNew(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-white">Novo Projeto</h2>
                <button onClick={() => setShowNew(false)} className="text-zinc-500 hover:text-white transition">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <Field label="Nome do projeto *">
                  <input
                    autoFocus
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="Ex: Lançamento Produto X"
                    className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                  />
                </Field>
                <Field label="Tipo">
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="produto">Produto</option>
                    <option value="servico">Serviço</option>
                    <option value="marketing">Marketing</option>
                    <option value="interno">Interno</option>
                    <option value="outro">Outro</option>
                  </select>
                </Field>
                <Field label="Descrição">
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Objetivo do projeto..."
                    rows={2}
                    className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 resize-none"
                  />
                </Field>
                <Field label="Meta de receita (R$)">
                  <input
                    type="number"
                    value={form.goal}
                    onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                  />
                </Field>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNew(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name.trim() || saving}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Criar projeto
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
