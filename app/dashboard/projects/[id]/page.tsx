'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Loader2, Sparkles, X,
  List, Kanban, DollarSign, BarChart3, MessageSquare,
  TrendingUp, TrendingDown, ShoppingBag,
  Calendar, User, Send, Bot, CheckCircle2,
  Flag, Clock, AlertCircle, CheckSquare, Circle,
  Zap, Target, Activity,
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
interface ChatMsg  { role: 'user' | 'assistant'; content: string; tasks_created?: Task[] }

// ─── Type config (matches projects list page) ─────────────────────────────────

type TypeKey =
  | 'lancamento' | 'produto' | 'marketing' | 'automacao'
  | 'crm' | 'trafego' | 'conteudo' | 'operacao' | 'servico' | 'interno' | 'outro'

const TYPE_CFG: Record<TypeKey, { label: string; color: string; bg: string }> = {
  lancamento: { label: 'Lançamento',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  produto:    { label: 'Produto',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  marketing:  { label: 'Marketing',   color: '#ec4899', bg: 'rgba(236,72,153,0.08)' },
  automacao:  { label: 'Automação',   color: '#06b6d4', bg: 'rgba(6,182,212,0.08)'  },
  crm:        { label: 'CRM',         color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  trafego:    { label: 'Tráfego',     color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
  conteudo:   { label: 'Conteúdo',    color: '#a78bfa', bg: 'rgba(167,139,250,0.08)'},
  operacao:   { label: 'Operação',    color: '#64748b', bg: 'rgba(100,116,139,0.08)'},
  servico:    { label: 'Serviço',     color: '#14b8a6', bg: 'rgba(20,184,166,0.08)' },
  interno:    { label: 'Interno',     color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  outro:      { label: 'Projeto',     color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
}

function getTypeCfg(type?: string) {
  return TYPE_CFG[(type ?? 'outro') as TypeKey] ?? TYPE_CFG.outro
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_STATUS = {
  todo:        { label: 'A fazer',      cls: 'bg-zinc-500/20  text-zinc-400  border-zinc-500/20',   dot: 'bg-zinc-500' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/20',  dot: 'bg-amber-500' },
  in_review:   { label: 'Em revisão',   cls: 'bg-blue-500/20  text-blue-400  border-blue-500/20',   dot: 'bg-blue-500' },
  done:        { label: 'Concluído',    cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' },
  cancelled:   { label: 'Cancelado',    cls: 'bg-red-500/20   text-red-400   border-red-500/20',    dot: 'bg-red-500' },
} as const

const TASK_PRIORITY = {
  low:    { label: 'Baixa',   dot: 'bg-zinc-500' },
  medium: { label: 'Média',   dot: 'bg-amber-500' },
  high:   { label: 'Alta',    dot: 'bg-orange-500' },
  urgent: { label: 'Urgente', dot: 'bg-red-500' },
} as const

type Tab = 'tasks' | 'kanban' | 'dashboard' | 'copilot' | 'financeiro'

const KANBAN_COLS: (keyof typeof TASK_STATUS)[] = ['todo', 'in_progress', 'in_review', 'done']

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
  return <span className={cn('inline-block w-2 h-2 rounded-full shrink-0 mt-0.5', cfg.dot)} />
}

function TaskField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const router       = useRouter()
  const { id }       = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const isWelcome    = searchParams.get('welcome') === '1'
  const typeCfg      = useRef(TYPE_CFG.outro)

  const [project,  setProject]  = useState<Project | null>(null)
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])

  const [tab,          setTab]         = useState<Tab>('tasks')
  const [loading,      setLoading]     = useState(true)
  const [taskFilter,   setTaskFilter]  = useState<string>('all')

  // Task modal
  const [showTask,     setShowTask]    = useState(false)
  const [editTask,     setEditTask]    = useState<Task | null>(null)
  const [savingTask,   setSavingTask]  = useState(false)
  const [deletingTask, setDeletingTask]= useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assignee_name: '',
  })

  // Copilot
  const [chatHistory,  setChatHistory] = useState<ChatMsg[]>([])
  const [chatInput,    setChatInput]   = useState('')
  const [chatLoading,  setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

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
      if (projRes.ok)  {
        const { data } = await projRes.json()
        setProject(data)
        typeCfg.current = getTypeCfg(data?.type)
      }
      if (tasksRes.ok) { const { data } = await tasksRes.json(); setTasks(data ?? []) }
      if (prodRes.ok)  { const { data } = await prodRes.json();  setProducts(data ?? []) }
      if (revRes.ok)   { const { data } = await revRes.json();   setRevenues(data ?? []) }
      if (expRes.ok)   { const { data } = await expRes.json();   setExpenses(data ?? []) }
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  useEffect(() => { loadProject() }, [loadProject])

  // Auto-trigger copilot briefing when project just created
  const welcomeSent = useRef(false)
  useEffect(() => {
    if (!isWelcome || loading || !project || welcomeSent.current) return
    welcomeSent.current = true
    setTab('copilot')
    const initialMsg = `Este projeto acabou de ser criado. Faça um briefing operacional completo: analise o nome, tipo e objetivo do projeto, liste as 3 prioridades imediatas, identifique possíveis riscos, e sugira os primeiros passos concretos para os próximos 7 dias.`
    const sendWelcome = async () => {
      setChatLoading(true)
      try {
        const res = await fetch(`/api/projects/${id}/copilot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: initialMsg, history: [] }),
        })
        if (res.ok) {
          const data = await res.json()
          setChatHistory([
            { role: 'user',      content: initialMsg },
            { role: 'assistant', content: data.message, tasks_created: data.tasks_created?.length ? data.tasks_created : undefined },
          ])
          if (data.tasks_created?.length) setTasks(prev => [...prev, ...data.tasks_created])
        }
      } catch { /* ignore */ }
      setChatLoading(false)
    }
    // Small delay so the page finishes rendering
    setTimeout(sendWelcome, 600)
  }, [isWelcome, loading, project, id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, chatLoading])

  // ── Chat send ──
  async function sendMessage() {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return

    const userMsg: ChatMsg = { role: 'user', content: msg }
    setChatHistory(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    try {
      const history = chatHistory.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(`/api/projects/${id}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      })
      if (res.ok) {
        const data = await res.json()
        const assistantMsg: ChatMsg = {
          role: 'assistant',
          content: data.message,
          tasks_created: data.tasks_created?.length ? data.tasks_created : undefined,
        }
        setChatHistory(prev => [...prev, assistantMsg])
        if (data.tasks_created?.length) {
          setTasks(prev => [...prev, ...data.tasks_created])
        }
      }
    } catch { /* ignore */ }
    setChatLoading(false)
  }

  // ── Task CRUD ──
  function openNewTask(defaultStatus = 'todo') {
    setEditTask(null)
    setTaskForm({ title: '', description: '', status: defaultStatus, priority: 'medium', due_date: '', assignee_name: '' })
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
        if (res.ok) { const { data } = await res.json(); setTasks(prev => prev.map(t => t.id === data.id ? data : t)) }
      } else {
        const res = await fetch(`/api/projects/${id}/tasks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        if (res.ok) { const { data } = await res.json(); setTasks(prev => [...prev, data]) }
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

  // ── Derived stats ──
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const progress  = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0

  const taskStats = {
    todo:        tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    in_review:   tasks.filter(t => t.status === 'in_review').length,
    done:        doneTasks,
    cancelled:   tasks.filter(t => t.status === 'cancelled').length,
  }

  const priorityStats = {
    urgent: tasks.filter(t => t.priority === 'urgent').length,
    high:   tasks.filter(t => t.priority === 'high').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    low:    tasks.filter(t => t.priority === 'low').length,
  }

  const totalRev  = revenues.reduce((s, r) => s + r.value, 0)
  const totalExp  = expenses.reduce((s, e) => s + e.value, 0)
  const profit    = totalRev - totalExp
  const margin    = totalRev > 0 ? (profit / totalRev) * 100 : 0

  const filteredTasks = taskFilter === 'all' ? tasks : tasks.filter(t => t.status === taskFilter)

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

  const cfg = getTypeCfg(project.type)

  return (
    <div className="min-h-screen bg-zinc-950" style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(124,58,237,0.06) 0%, transparent 70%), #09090b' }}>

      {/* ── Hero Header ── */}
      <div
        className="relative overflow-hidden border-b border-zinc-800/50"
        style={{ background: `linear-gradient(135deg, ${cfg.bg} 0%, transparent 60%)` }}
      >
        {/* Accent line at top */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${cfg.color}cc 0%, transparent 60%)` }} />

        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Back + title row */}
          <div className="flex items-start gap-3 mb-5">
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="mt-0.5 p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition shrink-0"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full border"
                  style={{ color: cfg.color, borderColor: `${cfg.color}30`, background: `${cfg.color}15` }}
                >
                  {cfg.label}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{project.description}</p>
              )}
            </div>

            <button
              onClick={() => openNewTask()}
              className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl transition shrink-0"
              style={{ background: cfg.color }}
            >
              <Plus size={14} /> Nova tarefa
            </button>
          </div>

          {/* Progress bar */}
          <div className="ml-11 mb-4">
            <div className="flex items-center gap-3 mb-1.5">
              <div className="flex-1 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: cfg.color }}
                />
              </div>
              <span className="text-xs text-zinc-500 shrink-0 font-medium">{progress}%</span>
            </div>
            <p className="text-xs text-zinc-600">{doneTasks} de {tasks.length} tarefas concluídas</p>
          </div>

          {/* Quick stats strip */}
          <div className="ml-11 flex items-center gap-4 flex-wrap">
            {[
              { icon: Circle,       label: 'A fazer',     count: taskStats.todo,        color: '#71717a' },
              { icon: Clock,        label: 'Andamento',   count: taskStats.in_progress, color: '#f59e0b' },
              { icon: AlertCircle,  label: 'Em revisão',  count: taskStats.in_review,   color: '#3b82f6' },
              { icon: CheckCircle2, label: 'Concluídas',  count: doneTasks,             color: '#10b981' },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => { setTab('tasks'); setTaskFilter(s.icon === Circle ? 'todo' : s.icon === Clock ? 'in_progress' : s.icon === AlertCircle ? 'in_review' : 'done') }}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
              >
                <s.icon size={12} style={{ color: s.color }} />
                <span>{s.count} {s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-zinc-800/50 pb-0">
          {[
            { id: 'tasks',      label: 'Tarefas',    icon: List,          count: tasks.length },
            { id: 'kanban',     label: 'Kanban',     icon: Kanban,        count: 0 },
            { id: 'dashboard',  label: 'Dashboard',  icon: BarChart3,     count: 0 },
            { id: 'copilot',    label: 'Copilot IA', icon: Sparkles,      count: 0 },
            { id: 'financeiro', label: 'Financeiro', icon: DollarSign,    count: 0 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap',
                tab === t.id
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300',
              )}
            >
              {t.id === 'copilot'
                ? <span className="relative inline-flex"><t.icon size={14} />{chatHistory.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-violet-400" />}</span>
                : <t.icon size={14} />
              }
              {t.label}
              {t.id === 'tasks' && tasks.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded-full">{tasks.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Tarefas ── */}
        {tab === 'tasks' && (
          <div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {[
                { id: 'all',         label: 'Todas',      count: tasks.length },
                { id: 'todo',        label: 'A fazer',    count: taskStats.todo },
                { id: 'in_progress', label: 'Andamento',  count: taskStats.in_progress },
                { id: 'in_review',   label: 'Revisão',    count: taskStats.in_review },
                { id: 'done',        label: 'Concluídas', count: doneTasks },
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
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <CheckSquare size={32} className="text-zinc-700" />
                <p className="text-zinc-500 text-sm">
                  {taskFilter === 'all' ? 'Nenhuma tarefa ainda' : 'Nenhuma tarefa com este filtro'}
                </p>
                {taskFilter === 'all' && (
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => openNewTask()}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:bg-violet-500/10 rounded-lg transition"
                    >
                      <Plus size={13} /> Criar tarefa manualmente
                    </button>
                    <button
                      onClick={() => setTab('copilot')}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg transition"
                    >
                      <Sparkles size={13} /> Criar com IA
                    </button>
                  </div>
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
              const colCfg  = TASK_STATUS[col]
              const colTasks = tasks.filter(t => t.status === col)
              return (
                <div key={col} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', colCfg.dot)} />
                      <span className="text-xs font-semibold text-zinc-300">{colCfg.label}</span>
                      <span className="text-xs text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                    </div>
                    <button
                      onClick={() => openNewTask(col)}
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

        {/* ── Tab: Dashboard ── */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total de tarefas',   value: tasks.length,             icon: CheckSquare, color: '#a78bfa' },
                { label: 'Em andamento',        value: taskStats.in_progress,    icon: Activity,    color: '#f59e0b' },
                { label: 'Concluídas',          value: doneTasks,                icon: CheckCircle2,color: '#10b981' },
                { label: 'Progresso geral',     value: `${progress}%`,           icon: Target,      color: cfg.color },
              ].map(s => (
                <div
                  key={s.label}
                  className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4"
                  style={{ boxShadow: `0 0 20px ${s.color}08` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-zinc-500">{s.label}</p>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}18` }}>
                      <s.icon size={13} style={{ color: s.color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status distribution */}
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Distribuição por Status</h3>
                {tasks.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-8">Crie tarefas para ver a distribuição</p>
                ) : (
                  <div className="space-y-3">
                    {[
                      { key: 'todo',        label: 'A fazer',      count: taskStats.todo,        color: '#71717a' },
                      { key: 'in_progress', label: 'Em andamento', count: taskStats.in_progress, color: '#f59e0b' },
                      { key: 'in_review',   label: 'Em revisão',   count: taskStats.in_review,   color: '#3b82f6' },
                      { key: 'done',        label: 'Concluído',    count: doneTasks,             color: '#10b981' },
                    ].map(row => {
                      const pct = tasks.length > 0 ? (row.count / tasks.length) * 100 : 0
                      return (
                        <div key={row.key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-400">{row.label}</span>
                            <span className="text-xs text-zinc-500">{row.count}</span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.7, delay: 0.1 }}
                              className="h-full rounded-full"
                              style={{ background: row.color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Priority distribution */}
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Distribuição por Prioridade</h3>
                {tasks.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-8">Crie tarefas para ver a distribuição</p>
                ) : (
                  <div className="space-y-3">
                    {[
                      { key: 'urgent', label: 'Urgente', count: priorityStats.urgent, color: '#ef4444' },
                      { key: 'high',   label: 'Alta',    count: priorityStats.high,   color: '#f97316' },
                      { key: 'medium', label: 'Média',   count: priorityStats.medium, color: '#f59e0b' },
                      { key: 'low',    label: 'Baixa',   count: priorityStats.low,    color: '#71717a' },
                    ].map(row => {
                      const pct = tasks.length > 0 ? (row.count / tasks.length) * 100 : 0
                      return (
                        <div key={row.key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-400">{row.label}</span>
                            <span className="text-xs text-zinc-500">{row.count}</span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.7, delay: 0.15 }}
                              className="h-full rounded-full"
                              style={{ background: row.color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Recent tasks */}
            {tasks.length > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Tarefas Recentes</h3>
                <div className="space-y-2">
                  {[...tasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5).map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/40 transition cursor-pointer"
                      onClick={() => { setTab('tasks'); openEditTask(task) }}
                    >
                      <PriorityDot priority={task.priority} />
                      <p className={cn('text-sm flex-1 truncate', task.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-200')}>
                        {task.title}
                      </p>
                      <TaskStatusBadge status={task.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project info */}
            {(project.goal || project.description) && (
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap size={14} className="text-violet-400" /> Sobre o Projeto
                </h3>
                {project.goal && (
                  <div className="mb-3">
                    <p className="text-xs text-zinc-500 mb-1">Objetivo</p>
                    <p className="text-sm text-zinc-300">{project.goal}</p>
                  </div>
                )}
                {project.description && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Descrição</p>
                    <p className="text-sm text-zinc-300">{project.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Copilot IA ── */}
        {tab === 'copilot' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 340px)', minHeight: '480px' }}>
            {/* Chat area */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
              {chatHistory.length === 0 && !chatLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
                  >
                    <Bot size={28} style={{ color: cfg.color }} />
                  </div>
                  <div>
                    <p className="text-white font-semibold">NEXUS Copilot</p>
                    <p className="text-zinc-500 text-sm mt-1 max-w-sm">
                      Seu assistente de IA para este projeto. Pode criar tarefas, analisar progresso, sugerir estratégias e muito mais.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      'Qual o status atual do projeto?',
                      'Crie tarefas para as próximas 2 semanas',
                      'Identifique riscos e bloqueios',
                      'Quais são as prioridades agora?',
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => { setChatInput(suggestion) }}
                        className="px-3 py-1.5 text-xs bg-zinc-900/60 border border-zinc-800/50 text-zinc-400 hover:text-white hover:border-zinc-700 rounded-lg transition"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatHistory.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'assistant' && (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
                    >
                      <Bot size={14} style={{ color: cfg.color }} />
                    </div>
                  )}

                  <div className={cn('max-w-[78%] space-y-2', msg.role === 'user' ? 'items-end' : 'items-start')}>
                    <div
                      className={cn(
                        'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-violet-600/30 border border-violet-500/20 text-white rounded-tr-sm'
                          : 'bg-zinc-900/80 border border-zinc-800/50 text-zinc-200 rounded-tl-sm',
                      )}
                    >
                      {msg.content}
                    </div>

                    {msg.tasks_created && msg.tasks_created.length > 0 && (
                      <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span className="text-xs font-semibold text-emerald-400">
                            {msg.tasks_created.length} tarefa{msg.tasks_created.length > 1 ? 's' : ''} criada{msg.tasks_created.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {msg.tasks_created.map(t => (
                            <li key={t.id} className="text-xs text-zinc-400 flex items-center gap-2">
                              <span className={cn('w-1.5 h-1.5 rounded-full', TASK_PRIORITY[t.priority as keyof typeof TASK_PRIORITY]?.dot ?? 'bg-zinc-500')} />
                              {t.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {chatLoading && (
                <div className="flex gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
                  >
                    <Bot size={14} style={{ color: cfg.color }} />
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-zinc-500"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-zinc-800/50 pt-4 mt-2">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                    }}
                    placeholder="Pergunte algo, peça análises ou diga 'crie tarefas para...'"
                    rows={2}
                    className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-800/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/40 resize-none"
                    style={{ scrollbarWidth: 'none' }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="p-3 rounded-xl text-white transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5"
                  style={{ background: cfg.color }}
                >
                  {chatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <p className="text-xs text-zinc-700 mt-2 text-center">Enter para enviar · Shift+Enter para nova linha</p>
            </div>
          </div>
        )}

        {/* ── Tab: Financeiro ── */}
        {tab === 'financeiro' && (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Receita total', value: fmt(totalRev), color: '#10b981' },
                { label: 'Custos totais', value: fmt(totalExp), color: '#ef4444' },
                { label: 'Lucro',          value: fmt(profit),  color: profit >= 0 ? '#10b981' : '#ef4444' },
                { label: 'Margem',         value: `${margin.toFixed(1)}%`, color: margin >= 30 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444' },
              ].map(m => (
                <div key={m.label} className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4">
                  <p className="text-xs text-zinc-500 mb-1">{m.label}</p>
                  <p className="text-xl font-bold" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>

      {/* ── Task Modal ── */}
      <AnimatePresence>
        {showTask && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTask(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
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
                  className="flex-1 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
                  style={{ background: cfg.color }}
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
