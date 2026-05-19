'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Loader2, Sparkles, X,
  RefreshCw, AlertTriangle, Lightbulb, Target,
  CheckSquare, Clock, AlertCircle, ChevronDown,
  List, Kanban, DollarSign, BarChart3, ShoppingBag,
  TrendingUp, TrendingDown, Flag, Calendar, User,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string; name: string; type: string; description: string; goal: string; created_at: string
}
interface Task {
  id: string; title: string; description?: string; status: string; priority: string
  due_date?: string; assignee_name?: string; tags?: string[]; position: number; created_at: string
}
interface Product  { id: string; name: string; price: number; cost: number; margin: number; status: string }
interface Revenue  { id: string; name: string; value: number; source: string; date: string }
interface Expense  { id: string; name: string; value: number; category: string; date: string }
interface Analysis { insights: string[]; alerts: string[]; opportunities: string[] }

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_STATUS = {
  todo:        { label: 'A fazer',      cls: 'bg-zinc-500/20  text-zinc-400  border-zinc-500/20' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/20' },
  in_review:   { label: 'Em revisão',   cls: 'bg-blue-500/20  text-blue-400  border-blue-500/20' },
  done:        { label: 'Concluído',    cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' },
  cancelled:   { label: 'Cancelado',    cls: 'bg-red-500/20   text-red-400   border-red-500/20' },
} as const

const TASK_PRIORITY = {
  low:    { label: 'Baixa',   cls: 'text-zinc-400',   dot: 'bg-zinc-500' },
  medium: { label: 'Média',   cls: 'text-amber-400',  dot: 'bg-amber-500' },
  high:   { label: 'Alta',    cls: 'text-orange-400', dot: 'bg-orange-500' },
  urgent: { label: 'Urgente', cls: 'text-red-400',    dot: 'bg-red-500' },
} as const

type Tab = 'tasks' | 'kanban' | 'financeiro' | 'ia'

const KANBAN_COLS: (keyof typeof TASK_STATUS)[] = ['todo', 'in_progress', 'in_review', 'done']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color = 'text-white' }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={cn('text-xl font-bold', color)}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function TaskStatusBadge({ status }: { status: string }) {
  const cfg = TASK_STATUS[status as keyof typeof TASK_STATUS] ?? TASK_STATUS.todo
  return (
    <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded-full border', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const cfg = TASK_PRIORITY[priority as keyof typeof TASK_PRIORITY] ?? TASK_PRIORITY.medium
  return <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', cfg.dot)} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [project,  setProject]  = useState<Project | null>(null)
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  const [tab,          setTab]         = useState<Tab>('tasks')
  const [loading,      setLoading]     = useState(true)
  const [analysing,    setAnalysing]   = useState(false)
  const [taskFilter,   setTaskFilter]  = useState<string>('all')

  // Task modal state
  const [showTask,     setShowTask]    = useState(false)
  const [editTask,     setEditTask]    = useState<Task | null>(null)
  const [savingTask,   setSavingTask]  = useState(false)
  const [deletingTask, setDeletingTask] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assignee_name: '',
  })

  // ── Load project ──
  const loadProject = useCallback(async () => {
    setLoading(true)
    try {
      const [projRes, tasksRes, prodRes, revRes, expRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/tasks`),
        fetch(`/api/projects/${id}/products`),
        fetch(`/api/projects/${id}/revenues`),
        fetch(`/api/projects/${id}/expenses`),
      ])
      if (projRes.ok)  { const { data } = await projRes.json();  setProject(data) }
      if (tasksRes.ok) { const { data } = await tasksRes.json(); setTasks(data ?? []) }
      if (prodRes.ok)  { const { data } = await prodRes.json();  setProducts(data ?? []) }
      if (revRes.ok)   { const { data } = await revRes.json();   setRevenues(data ?? []) }
      if (expRes.ok)   { const { data } = await expRes.json();   setExpenses(data ?? []) }
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  useEffect(() => { loadProject() }, [loadProject])

  // ── AI analysis ──
  async function runAnalysis() {
    setAnalysing(true)
    try {
      const res = await fetch(`/api/ai/project-analysis?project_id=${id}`)
      if (res.ok) { const data = await res.json(); setAnalysis(data) }
    } catch { /* ignore */ }
    setAnalysing(false)
  }

  // ── Task CRUD ──
  function openNewTask() {
    setEditTask(null)
    setTaskForm({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assignee_name: '' })
    setShowTask(true)
  }

  function openEditTask(task: Task) {
    setEditTask(task)
    setTaskForm({
      title:         task.title,
      description:   task.description ?? '',
      status:        task.status,
      priority:      task.priority,
      due_date:      task.due_date ?? '',
      assignee_name: task.assignee_name ?? '',
    })
    setShowTask(true)
  }

  async function saveTask() {
    if (!taskForm.title.trim()) return
    setSavingTask(true)
    try {
      const body = {
        title:         taskForm.title.trim(),
        description:   taskForm.description || null,
        status:        taskForm.status,
        priority:      taskForm.priority,
        due_date:      taskForm.due_date || null,
        assignee_name: taskForm.assignee_name || null,
      }
      if (editTask) {
        const res = await fetch(`/api/projects/${id}/tasks/${editTask.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        if (res.ok) {
          const { data } = await res.json()
          setTasks(prev => prev.map(t => t.id === data.id ? data : t))
        }
      } else {
        const res = await fetch(`/api/projects/${id}/tasks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        if (res.ok) {
          const { data } = await res.json()
          setTasks(prev => [...prev, data])
        }
      }
      setShowTask(false)
    } catch { /* ignore */ }
    setSavingTask(false)
  }

  async function deleteTask(tid: string) {
    setDeletingTask(tid)
    try {
      const res = await fetch(`/api/projects/${id}/tasks/${tid}`, { method: 'DELETE' })
      if (res.ok) setTasks(prev => prev.filter(t => t.id !== tid))
    } catch { /* ignore */ }
    setDeletingTask(null)
  }

  async function updateTaskStatus(tid: string, status: string) {
    setTasks(prev => prev.map(t => t.id === tid ? { ...t, status } : t))
    try {
      await fetch(`/api/projects/${id}/tasks/${tid}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } catch { /* ignore */ }
  }

  // ── Financial metrics ──
  const totalRev = revenues.reduce((s, r) => s + r.value, 0)
  const totalExp = expenses.reduce((s, e) => s + e.value, 0)
  const profit   = totalRev - totalExp
  const margin   = totalRev > 0 ? (profit / totalRev) * 100 : 0

  // ── Task filter ──
  const filteredTasks = taskFilter === 'all' ? tasks : tasks.filter(t => t.status === taskFilter)
  const taskStats = {
    todo:        tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    in_review:   tasks.filter(t => t.status === 'in_review').length,
    done:        tasks.filter(t => t.status === 'done').length,
    progress:    tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <Loader2 size={24} className="animate-spin text-violet-400" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-4">
        <p className="text-zinc-400">Projeto não encontrado</p>
        <button onClick={() => router.push('/dashboard/projects')} className="text-violet-400 hover:underline text-sm">
          ← Voltar para projetos
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.push('/dashboard/projects')}
          className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-zinc-500 mt-0.5 truncate">{project.description}</p>
          )}
        </div>
        <button
          onClick={openNewTask}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition shrink-0"
        >
          <Plus size={14} /> Nova tarefa
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-6 ml-11">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${taskStats.progress}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 shrink-0">{taskStats.progress}% concluído</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-zinc-800/50 pb-0">
        {[
          { id: 'tasks',     label: 'Lista',      icon: List },
          { id: 'kanban',    label: 'Kanban',     icon: Kanban },
          { id: 'financeiro',label: 'Financeiro', icon: DollarSign },
          { id: 'ia',        label: 'IA NEXUS',   icon: Sparkles },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              tab === t.id
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            <t.icon size={14} />
            {t.label}
            {t.id === 'tasks' && tasks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded-full">
                {tasks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Lista ── */}
      {tab === 'tasks' && (
        <div>
          {/* Filter chips */}
          <div className="flex items-center gap-2 mb-4">
            {[
              { id: 'all',        label: 'Todas',        count: tasks.length },
              { id: 'todo',       label: 'A fazer',      count: taskStats.todo },
              { id: 'in_progress',label: 'Andamento',    count: taskStats.in_progress },
              { id: 'in_review',  label: 'Revisão',      count: taskStats.in_review },
              { id: 'done',       label: 'Concluídas',   count: taskStats.done },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setTaskFilter(f.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition',
                  taskFilter === f.id
                    ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                    : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:text-zinc-300',
                )}
              >
                {f.label}
                <span className="opacity-60">{f.count}</span>
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <CheckSquare size={32} className="text-zinc-700" />
              <p className="text-zinc-500 text-sm">
                {taskFilter === 'all' ? 'Nenhuma tarefa criada' : 'Nenhuma tarefa com este filtro'}
              </p>
              {taskFilter === 'all' && (
                <button
                  onClick={openNewTask}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:bg-violet-500/10 rounded-lg transition"
                >
                  <Plus size={13} /> Criar primeira tarefa
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map(task => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group flex items-start gap-3 bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4 hover:border-zinc-700/50 transition cursor-pointer"
                  onClick={() => openEditTask(task)}
                >
                  <PriorityDot priority={task.priority} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn('text-sm font-medium', task.status === 'done' ? 'line-through text-zinc-500' : 'text-white')}>
                        {task.title}
                      </p>
                      <TaskStatusBadge status={task.status} />
                    </div>
                    {task.description && (
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
                      {task.assignee_name && (
                        <span className="flex items-center gap-1"><User size={11} />{task.assignee_name}</span>
                      )}
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {new Date(task.due_date).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                    disabled={deletingTask === task.id}
                    className="p-1.5 opacity-0 group-hover:opacity-100 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition shrink-0"
                  >
                    {deletingTask === task.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Kanban ── */}
      {tab === 'kanban' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLS.map(col => {
            const cfg = TASK_STATUS[col]
            const colTasks = tasks.filter(t => t.status === col)
            return (
              <div key={col} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold', cfg.cls.includes('emerald') ? 'text-emerald-400' : cfg.cls.includes('amber') ? 'text-amber-400' : cfg.cls.includes('blue') ? 'text-blue-400' : 'text-zinc-400')}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => { openNewTask(); setTaskForm(f => ({ ...f, status: col })) }}
                    className="p-1 text-zinc-600 hover:text-violet-400 transition"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <div className="flex flex-col gap-2 min-h-32">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      className="group bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-3.5 hover:border-zinc-700/50 transition cursor-pointer"
                      onClick={() => openEditTask(task)}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <PriorityDot priority={task.priority} />
                        <p className="text-sm text-white leading-snug line-clamp-2 flex-1">{task.title}</p>
                      </div>
                      {task.due_date && (
                        <p className="text-xs text-zinc-600 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(task.due_date).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      {/* Quick status change */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                        {KANBAN_COLS.filter(s => s !== col).slice(0, 2).map(s => (
                          <button
                            key={s}
                            onClick={e => { e.stopPropagation(); updateTaskStatus(task.id, s) }}
                            className="text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition"
                          >
                            → {TASK_STATUS[s].label.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="border border-dashed border-zinc-800/50 rounded-xl p-4 text-center">
                      <p className="text-xs text-zinc-700">Sem tarefas</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Financeiro ── */}
      {tab === 'financeiro' && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Receita total" value={fmt(totalRev)} color="text-emerald-400" />
            <MetricCard label="Custos totais" value={fmt(totalExp)} color="text-red-400" />
            <MetricCard label="Lucro" value={fmt(profit)} color={profit >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            <MetricCard label="Margem" value={`${margin.toFixed(1)}%`} color={margin >= 30 ? 'text-emerald-400' : margin >= 15 ? 'text-amber-400' : 'text-red-400'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenues */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-400" /> Receitas
              </h3>
              {revenues.length === 0 ? (
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-6 text-center">
                  <p className="text-xs text-zinc-600">Nenhuma receita registrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {revenues.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm text-white">{r.name}</p>
                        <p className="text-xs text-zinc-500">{new Date(r.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-400">{fmt(r.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expenses */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingDown size={14} className="text-red-400" /> Custos
              </h3>
              {expenses.length === 0 ? (
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-6 text-center">
                  <p className="text-xs text-zinc-600">Nenhum custo registrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm text-white">{e.name}</p>
                        <p className="text-xs text-zinc-500">{new Date(e.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className="text-sm font-semibold text-red-400">{fmt(e.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Products */}
          {products.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <ShoppingBag size={14} className="text-violet-400" /> Produtos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {products.map(p => (
                  <div key={p.id} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4">
                    <p className="text-sm font-medium text-white mb-2">{p.name}</p>
                    <div className="flex gap-4 text-xs">
                      <span className="text-zinc-500">Preço: <span className="text-white">{fmt(p.price)}</span></span>
                      <span className="text-zinc-500">Custo: <span className="text-red-400">{fmt(p.cost)}</span></span>
                      <span className="text-zinc-500">Margem: <span className="text-emerald-400">{p.margin.toFixed(1)}%</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: IA NEXUS ── */}
      {tab === 'ia' && (
        <div>
          {!analysis ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Sparkles size={28} className="text-violet-400" />
              </div>
              <div>
                <p className="text-white font-medium">Análise de IA</p>
                <p className="text-zinc-500 text-sm mt-1">Gere insights automáticos sobre este projeto</p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={analysing}
                className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
              >
                {analysing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {analysing ? 'Analisando...' : 'Analisar com IA'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={runAnalysis}
                  disabled={analysing}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg transition"
                >
                  {analysing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Reanalisar
                </button>
              </div>

              {analysis.alerts.length > 0 && (
                <AnalysisSection icon={AlertTriangle} title="Alertas" iconCls="text-amber-400" items={analysis.alerts} itemCls="text-amber-300" bgCls="bg-amber-500/5 border-amber-500/10" />
              )}
              {analysis.insights.length > 0 && (
                <AnalysisSection icon={Sparkles} title="Insights" iconCls="text-violet-400" items={analysis.insights} itemCls="text-zinc-200" bgCls="bg-violet-500/5 border-violet-500/10" />
              )}
              {analysis.opportunities.length > 0 && (
                <AnalysisSection icon={Target} title="Oportunidades" iconCls="text-emerald-400" items={analysis.opportunities} itemCls="text-emerald-300" bgCls="bg-emerald-500/5 border-emerald-500/10" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Task Modal ── */}
      <AnimatePresence>
        {showTask && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTask(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-white">{editTask ? 'Editar tarefa' : 'Nova tarefa'}</h2>
                <button onClick={() => setShowTask(false)} className="text-zinc-500 hover:text-white transition">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <TaskField label="Título *">
                  <input
                    autoFocus
                    value={taskForm.title}
                    onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Descreva a tarefa..."
                    className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                  />
                </TaskField>

                <TaskField label="Descrição">
                  <textarea
                    value={taskForm.description}
                    onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Detalhes adicionais..."
                    rows={2}
                    className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 resize-none"
                  />
                </TaskField>

                <div className="grid grid-cols-2 gap-4">
                  <TaskField label="Status">
                    <select
                      value={taskForm.status}
                      onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50"
                    >
                      {Object.entries(TASK_STATUS).map(([v, c]) => (
                        <option key={v} value={v}>{c.label}</option>
                      ))}
                    </select>
                  </TaskField>
                  <TaskField label="Prioridade">
                    <select
                      value={taskForm.priority}
                      onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50"
                    >
                      {Object.entries(TASK_PRIORITY).map(([v, c]) => (
                        <option key={v} value={v}>{c.label}</option>
                      ))}
                    </select>
                  </TaskField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <TaskField label="Responsável">
                    <input
                      value={taskForm.assignee_name}
                      onChange={e => setTaskForm(f => ({ ...f, assignee_name: e.target.value }))}
                      placeholder="Nome do responsável"
                      className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                    />
                  </TaskField>
                  <TaskField label="Prazo">
                    <input
                      type="date"
                      value={taskForm.due_date}
                      onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </TaskField>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowTask(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveTask}
                  disabled={!taskForm.title.trim() || savingTask}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
                >
                  {savingTask && <Loader2 size={14} className="animate-spin" />}
                  {editTask ? 'Salvar alterações' : 'Criar tarefa'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Minor helpers ─────────────────────────────────────────────────────────────

function TaskField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function AnalysisSection({ icon: Icon, title, iconCls, items, itemCls, bgCls }: {
  icon: React.ElementType; title: string; iconCls: string
  items: string[]; itemCls: string; bgCls: string
}) {
  return (
    <div className={cn('border rounded-xl p-5', bgCls)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className={iconCls} />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className={cn('text-sm flex items-start gap-2', itemCls)}>
            <span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
