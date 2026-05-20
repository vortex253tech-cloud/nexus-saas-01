'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, FolderKanban, CheckSquare, Clock, Target,
  Trash2, ArrowRight, X, Loader2, Sparkles, Zap,
  Package, TrendingUp, Users, BarChart3, Wand2,
  FileText, Settings, Wrench, Rocket,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task { id: string; status: string; priority: string }
interface Project {
  id: string; name: string; type?: string; description?: string
  goal?: number; status?: string; created_at: string; tasks?: Task[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

type TypeKey = 'lancamento'|'produto'|'marketing'|'automacao'|'crm'|'trafego'|'conteudo'|'operacao'|'servico'|'interno'|'outro'

const TYPE_CFG: Record<TypeKey, { label: string; color: string; icon: React.ElementType }> = {
  lancamento: { label: 'Lançamento', color: '#f97316', icon: Rocket    },
  produto:    { label: 'Produto',    color: '#8b5cf6', icon: Package   },
  marketing:  { label: 'Marketing',  color: '#ec4899', icon: Target    },
  automacao:  { label: 'Automação',  color: '#06b6d4', icon: Zap       },
  crm:        { label: 'CRM',        color: '#10b981', icon: Users     },
  trafego:    { label: 'Tráfego',    color: '#f59e0b', icon: TrendingUp},
  conteudo:   { label: 'Conteúdo',   color: '#0ea5e9', icon: FileText  },
  operacao:   { label: 'Operação',   color: '#6b7280', icon: Settings  },
  servico:    { label: 'Serviço',    color: '#3b82f6', icon: Wrench    },
  interno:    { label: 'Interno',    color: '#71717a', icon: FolderKanban },
  outro:      { label: 'Outro',      color: '#71717a', icon: BarChart3 },
}

const TYPE_WIZARD: TypeKey[] = ['lancamento','produto','marketing','automacao','crm','trafego','conteudo','operacao','servico']

function getTypeCfg(type?: string) {
  return TYPE_CFG[(type as TypeKey) ?? 'outro'] ?? TYPE_CFG.outro
}

function getStats(tasks: Task[] = []) {
  const total = tasks.length
  const done  = tasks.filter(t => t.status === 'done').length
  const active = tasks.filter(t => t.status === 'in_progress').length
  return { total, done, active, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r = 20, circ = 2 * Math.PI * r
  return (
    <svg width={52} height={52} style={{ transform: 'rotate(-90deg)' }} className="shrink-0">
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <circle cx={26} cy={26} r={r} fill="none"
        stroke="#8b5cf6" strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  )
}

function AnimatedCount({ value }: { value: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (value === 0) { setN(0); return }
    const step = value / 24
    let cur = 0
    const t = setInterval(() => {
      cur += step
      if (cur >= value) { setN(value); clearInterval(t) } else setN(Math.floor(cur))
    }, 20)
    return () => clearInterval(t)
  }, [value])
  return <>{n}</>
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

function NewProjectWizard({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [step,    setStep]    = useState<1|2>(1)
  const [type,    setType]    = useState<TypeKey>('produto')
  const [name,    setName]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [goal,    setGoal]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [status,  setStatus]  = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      setStatus('Criando projeto...')
      const r1 = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, description: desc || null, goal: goal ? Number(goal) : null }),
      })
      if (!r1.ok) throw new Error('create failed')
      const { data: proj } = await r1.json()

      setStatus('IA configurando estrutura...')
      await fetch(`/api/projects/${proj.id}/ai-setup`, { method: 'POST' })

      setStatus('')
      onCreated(proj.id)
    } catch {
      setStatus('')
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800/60 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient top bar */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <FolderKanban size={15} className="text-violet-400" />
              </div>
              <h2 className="font-bold text-white">Novo Projeto</h2>
            </div>
            <button onClick={onClose} className="text-zinc-600 hover:text-white transition p-1">
              <X size={16} />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-7">
            {([1, 2] as const).map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition',
                  step >= s
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-600',
                )}>
                  {s}
                </div>
                {s < 2 && <div className={cn('h-px w-8 transition', step > s ? 'bg-violet-600' : 'bg-zinc-800')} />}
              </div>
            ))}
            <span className="text-xs text-zinc-500 ml-2">
              {step === 1 ? 'Tipo do projeto' : 'Detalhes'}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Type selection */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <p className="text-sm text-zinc-400 mb-4">Qual é o tipo deste projeto?</p>
                <div className="grid grid-cols-3 gap-3">
                  {TYPE_WIZARD.map(k => {
                    const cfg = TYPE_CFG[k]
                    const Icon = cfg.icon
                    const sel = type === k
                    return (
                      <button
                        key={k}
                        onClick={() => setType(k)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-xl border transition text-center',
                          sel
                            ? 'border-violet-500/60 bg-violet-500/10'
                            : 'border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40',
                        )}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ background: `${cfg.color}18` }}
                        >
                          <Icon size={16} style={{ color: cfg.color }} />
                        </div>
                        <span className="text-xs font-medium text-zinc-300 leading-tight">{cfg.label}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={onClose} className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-sm font-medium rounded-xl transition">
                    Cancelar
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition"
                  >
                    Continuar →
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Details + create */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                {saving ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Sparkles size={24} className="text-violet-400 animate-pulse" />
                      </div>
                      <div className="absolute -inset-1 rounded-2xl border border-violet-500/20 animate-ping" />
                    </div>
                    <p className="text-sm text-zinc-300 font-medium">{status}</p>
                    <p className="text-xs text-zinc-600">A IA está montando a estrutura do projeto</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Selected type badge */}
                    <button
                      onClick={() => setStep(1)}
                      className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition"
                    >
                      <span style={{ color: getTypeCfg(type).color }}>●</span>
                      {getTypeCfg(type).label}
                      <span className="text-zinc-700">· Alterar tipo</span>
                    </button>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nome do projeto *</label>
                      <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Lançamento Produto X"
                        className="w-full px-3.5 py-2.5 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Objetivo</label>
                      <textarea
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        placeholder="Qual é o objetivo principal deste projeto?"
                        rows={2}
                        className="w-full px-3.5 py-2.5 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 resize-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Meta de receita (R$)</label>
                      <input
                        type="number"
                        value={goal}
                        onChange={e => setGoal(e.target.value)}
                        placeholder="0,00"
                        className="w-full px-3.5 py-2.5 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition"
                      />
                    </div>

                    <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-3 flex items-start gap-2.5">
                      <Sparkles size={13} className="text-violet-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-zinc-400">
                        A IA vai criar automaticamente a estrutura inicial de tarefas baseada no tipo e objetivo do projeto.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setStep(1)}
                        className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-sm font-medium rounded-xl transition"
                      >
                        ← Voltar
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={!name.trim()}
                        className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <Sparkles size={14} />
                        Criar com IA
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()

  const [projects,  setProjects]  = useState<Project[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')
  const [showNew,   setShowNew]   = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)

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
            if (tr.ok) { const { data: t } = await tr.json(); return { ...p, tasks: t || [] } }
          } catch { /* ignore */ }
          return { ...p, tasks: [] }
        }),
      )
      setProjects(withTasks)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch { /* ignore */ }
    setDeleting(null)
  }

  // Aggregate stats
  const totalTasks   = projects.reduce((s, p) => s + (p.tasks?.length ?? 0), 0)
  const doneTasks    = projects.reduce((s, p) => s + (p.tasks?.filter(t => t.status === 'done').length ?? 0), 0)
  const activeTasks  = projects.reduce((s, p) => s + (p.tasks?.filter(t => t.status === 'in_progress').length ?? 0), 0)
  const globalPct    = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const filtered = filter === 'all' ? projects : projects.filter(p => (p.type ?? 'outro') === filter)

  const typesInUse = [...new Set(projects.map(p => p.type ?? 'outro'))]

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">

      {/* Ambient gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-96 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(139,92,246,0.08) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 p-6 max-w-7xl mx-auto">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Projetos</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {loading ? '—' : `${projects.length} projeto${projects.length !== 1 ? 's' : ''} · centro operacional`}
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-violet-900/30"
          >
            <Plus size={15} strokeWidth={2.5} />
            Novo projeto
          </button>
        </div>

        {/* ── Hero stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: 'Projetos', value: projects.length, icon: FolderKanban,
              color: '#8b5cf6', sub: `${typesInUse.length} tipo${typesInUse.length !== 1 ? 's' : ''}`,
            },
            {
              label: 'Em andamento', value: activeTasks, icon: Clock,
              color: '#f59e0b', sub: 'tarefas ativas',
            },
            {
              label: 'Concluídas', value: doneTasks, icon: CheckSquare,
              color: '#10b981', sub: `de ${totalTasks} totais`,
            },
            {
              label: 'Progresso geral', value: globalPct, icon: Target,
              color: '#06b6d4', sub: 'conclusão', suffix: '%',
            },
          ].map(s => (
            <div
              key={s.label}
              className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 relative overflow-hidden group hover:border-zinc-700/50 transition"
            >
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 blur-2xl transition group-hover:opacity-10"
                style={{ background: s.color, transform: 'translate(30%, -30%)' }}
              />
              <div className="flex items-center gap-2 mb-3">
                <s.icon size={14} style={{ color: s.color }} />
                <span className="text-xs text-zinc-500">{s.label}</span>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums">
                {loading ? '—' : <><AnimatedCount value={s.value} />{s.suffix ?? ''}</>}
              </div>
              <p className="text-xs text-zinc-600 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── AI status bar ── */}
        {!loading && activeTasks > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-violet-500/5 border border-violet-500/15 rounded-xl px-4 py-3 mb-6"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-400" />
            </span>
            <p className="text-xs text-zinc-400">
              <span className="text-violet-300 font-medium">IA NEXUS ativa</span>
              {' — '}{activeTasks} tarefa{activeTasks !== 1 ? 's' : ''} em andamento em {projects.filter(p => (p.tasks?.some(t => t.status === 'in_progress'))).length} projeto{projects.filter(p => (p.tasks?.some(t => t.status === 'in_progress'))).length !== 1 ? 's' : ''}
            </p>
          </motion.div>
        )}

        {/* ── Type filters ── */}
        {typesInUse.length > 1 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'shrink-0 px-3.5 py-1.5 text-xs font-medium rounded-lg border transition',
                filter === 'all'
                  ? 'bg-zinc-800 border-zinc-600 text-white'
                  : 'bg-transparent border-zinc-800/50 text-zinc-500 hover:text-zinc-300',
              )}
            >
              Todos ({projects.length})
            </button>
            {typesInUse.map(t => {
              const cfg = getTypeCfg(t)
              return (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg border transition',
                    filter === t
                      ? 'border-zinc-600 bg-zinc-800 text-white'
                      : 'bg-transparent border-zinc-800/50 text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={22} className="animate-spin text-violet-400" />
              <p className="text-xs text-zinc-600">Carregando projetos...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div
              className="w-20 h-20 rounded-2xl border flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.15)' }}
            >
              <FolderKanban size={30} className="text-violet-400/40" />
            </div>
            <div className="text-center">
              <p className="text-zinc-300 font-semibold">Nenhum projeto ainda</p>
              <p className="text-zinc-600 text-sm mt-1">Crie seu primeiro projeto e deixe a IA montar a estrutura</p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-sm font-medium rounded-xl transition border border-violet-500/20"
            >
              <Sparkles size={14} />
              Criar com IA
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((project, i) => {
              const cfg  = getTypeCfg(project.type)
              const Icon = cfg.icon
              const s    = getStats(project.tasks)
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden hover:border-zinc-700/50 transition cursor-pointer"
                  onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                >
                  {/* Gradient top accent */}
                  <div
                    className="h-1 w-full"
                    style={{ background: `linear-gradient(90deg, ${cfg.color}80 0%, ${cfg.color}20 100%)` }}
                  />

                  <div className="p-5">
                    {/* Type + delete */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${cfg.color}18` }}
                        >
                          <Icon size={15} style={{ color: cfg.color }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <ProgressRing pct={s.pct} />
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(project.id) }}
                          disabled={deleting === project.id}
                          className="p-1.5 opacity-0 group-hover:opacity-100 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition"
                        >
                          {deleting === project.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Name */}
                    <h3 className="font-bold text-white text-base leading-snug mb-1">{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-zinc-500 line-clamp-2 mb-4">{project.description}</p>
                    )}

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${s.pct}%`,
                            background: `linear-gradient(90deg, ${cfg.color}cc, ${cfg.color}80)`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats chips */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <CheckSquare size={11} className="text-emerald-500" />
                          {s.done}/{s.total}
                        </span>
                        {s.active > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-amber-500" />
                            {s.active} ativa{s.active !== 1 ? 's' : ''}
                          </span>
                        )}
                        {s.total === 0 && (
                          <span className="text-zinc-700 text-xs italic">sem tarefas</span>
                        )}
                      </div>
                      <ArrowRight
                        size={15}
                        className="text-zinc-700 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all"
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}

            {/* "New project" card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: filtered.length * 0.05 }}
              className="flex flex-col items-center justify-center gap-3 bg-zinc-900/20 border border-dashed border-zinc-800/50 rounded-2xl p-8 hover:border-violet-500/30 hover:bg-violet-500/[0.02] transition cursor-pointer group"
              onClick={() => setShowNew(true)}
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 group-hover:border-violet-500/30 flex items-center justify-center transition">
                <Plus size={16} className="text-zinc-600 group-hover:text-violet-400 transition" />
              </div>
              <div className="text-center">
                <p className="text-sm text-zinc-600 group-hover:text-zinc-400 transition font-medium">Novo projeto</p>
                <p className="text-xs text-zinc-700 mt-0.5">IA configura automaticamente</p>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Wizard */}
      <AnimatePresence>
        {showNew && (
          <NewProjectWizard
            onClose={() => setShowNew(false)}
            onCreated={id => {
              setShowNew(false)
              router.push(`/dashboard/projects/${id}`)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
