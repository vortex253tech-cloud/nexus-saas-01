'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Loader2, Sparkles, X,
  List, DollarSign, BarChart3, MessageSquare,
  Calendar, Send, Bot, CheckCircle2, LayoutGrid,
  Flag, Clock, AlertCircle, CheckSquare, Circle,
  Zap, Target, Activity, TrendingUp, TrendingDown,
  AlertTriangle, ShoppingBag, ChevronDown,
} from 'lucide-react'
import {
  DragDropContext, Droppable, Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts'
import { cn } from '@/lib/cn'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Type config ─────────────────────────────────────────────────────────────

type TypeKey =
  | 'lancamento' | 'produto' | 'marketing' | 'automacao'
  | 'crm' | 'trafego' | 'conteudo' | 'operacao' | 'servico' | 'interno' | 'outro'

const TYPE_CFG: Record<TypeKey, { label: string; color: string; bg: string; glow: string }> = {
  lancamento: { label: 'Lançamento',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  glow: 'rgba(245,158,11,0.15)' },
  produto:    { label: 'Produto',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  glow: 'rgba(139,92,246,0.15)' },
  marketing:  { label: 'Marketing',   color: '#ec4899', bg: 'rgba(236,72,153,0.08)',  glow: 'rgba(236,72,153,0.15)' },
  automacao:  { label: 'Automação',   color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   glow: 'rgba(6,182,212,0.15)'  },
  crm:        { label: 'CRM',         color: '#10b981', bg: 'rgba(16,185,129,0.08)',  glow: 'rgba(16,185,129,0.15)' },
  trafego:    { label: 'Tráfego',     color: '#f97316', bg: 'rgba(249,115,22,0.08)',  glow: 'rgba(249,115,22,0.15)' },
  conteudo:   { label: 'Conteúdo',    color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', glow: 'rgba(167,139,250,0.15)'},
  operacao:   { label: 'Operação',    color: '#64748b', bg: 'rgba(100,116,139,0.08)', glow: 'rgba(100,116,139,0.15)'},
  servico:    { label: 'Serviço',     color: '#14b8a6', bg: 'rgba(20,184,166,0.08)',  glow: 'rgba(20,184,166,0.15)' },
  interno:    { label: 'Interno',     color: '#6366f1', bg: 'rgba(99,102,241,0.08)',  glow: 'rgba(99,102,241,0.15)' },
  outro:      { label: 'Projeto',     color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  glow: 'rgba(124,58,237,0.15)' },
}

function getTypeCfg(type?: string) {
  return TYPE_CFG[(type ?? 'outro') as TypeKey] ?? TYPE_CFG.outro
}

// ─── Task constants ───────────────────────────────────────────────────────────

const TASK_STATUS = {
  todo:        { label: 'A fazer',      cls: 'bg-zinc-500/20  text-zinc-300  border-zinc-500/20',   dot: 'bg-zinc-500',    col: '#71717a' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/20',  dot: 'bg-amber-400',   col: '#f59e0b' },
  in_review:   { label: 'Em revisão',   cls: 'bg-blue-500/20  text-blue-400  border-blue-500/20',   dot: 'bg-blue-400',    col: '#3b82f6' },
  done:        { label: 'Concluído',    cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400', col: '#10b981' },
  cancelled:   { label: 'Cancelado',    cls: 'bg-red-500/20   text-red-400   border-red-500/20',    dot: 'bg-red-400',     col: '#ef4444' },
} as const

const TASK_PRIORITY = {
  low:    { label: 'Baixa',   dot: 'bg-zinc-500',   col: '#71717a' },
  medium: { label: 'Média',   dot: 'bg-amber-400',  col: '#f59e0b' },
  high:   { label: 'Alta',    dot: 'bg-orange-500', col: '#f97316' },
  urgent: { label: 'Urgente', dot: 'bg-red-500',    col: '#ef4444' },
} as const

type Tab = 'tasks' | 'kanban' | 'dashboard' | 'copilot' | 'atividade' | 'financeiro'

const KANBAN_COLS: Array<{ id: keyof typeof TASK_STATUS; emoji: string }> = [
  { id: 'todo',        emoji: '○' },
  { id: 'in_progress', emoji: '◐' },
  { id: 'in_review',   emoji: '◉' },
  { id: 'done',        emoji: '●' },
]

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── AI Project Status ────────────────────────────────────────────────────────

function getProjectStatus(tasks: Task[], progress: number) {
  if (tasks.length === 0) return { label: 'Aguardando início', color: '#71717a', icon: Circle }
  const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length
  if (urgent >= 2) return { label: 'Projeto em risco', color: '#ef4444', icon: AlertTriangle }
  if (progress >= 75) return { label: 'Projeto acelerando', color: '#10b981', icon: TrendingUp }
  if (progress === 0) return { label: 'Projeto parado', color: '#f59e0b', icon: Clock }
  const active = tasks.filter(t => t.status === 'in_progress').length
  if (active >= 3) return { label: 'Alta atividade', color: '#6366f1', icon: Zap }
  return { label: 'Projeto ativo', color: '#3b82f6', icon: Activity }
}

// ─── Circular Progress ────────────────────────────────────────────────────────

function CircularProgress({ value, size = 72, color, stroke = 5 }: { value: number; size?: number; color: string; stroke?: number }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  const cx = size / 2
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <motion.circle
        cx={cx} cy={cx} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.4, ease: [0.34, 1.56, 0.64, 1] }}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
      <text x={cx} y={cx + 4} textAnchor="middle" fill="white" fontSize={13} fontWeight="700">{value}%</text>
    </svg>
  )
}

// ─── Task Badge ───────────────────────────────────────────────────────────────

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

// ─── Custom Tooltip for Charts ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-0.5">{label}</p>
      <p className="text-white font-semibold">{payload[0]?.value}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const router       = useRouter()
  const { id }       = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const isWelcome    = searchParams.get('welcome') === '1'

  const [project,  setProject]  = useState<Project | null>(null)
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])

  const [tab,        setTab]       = useState<Tab>('tasks')
  const [loading,    setLoading]   = useState(true)
  const [taskFilter, setTaskFilter]= useState<string>('all')

  // Task modal
  const [showTask,     setShowTask]    = useState(false)
  const [editTask,     setEditTask]    = useState<Task | null>(null)
  const [savingTask,   setSavingTask]  = useState(false)
  const [deletingTask, setDeletingTask]= useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assignee_name: '',
  })

  // Copilot
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([])
  const [chatInput,   setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Load ──
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
      if (projRes.ok)  { const { data } = await projRes.json(); setProject(data); }
      if (tasksRes.ok) { const { data } = await tasksRes.json(); setTasks(data ?? []) }
      if (prodRes.ok)  { const { data } = await prodRes.json();  setProducts(data ?? []) }
      if (revRes.ok)   { const { data } = await revRes.json();   setRevenues(data ?? []) }
      if (expRes.ok)   { const { data } = await expRes.json();   setExpenses(data ?? []) }
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  useEffect(() => { loadProject() }, [loadProject])

  // Auto-copilot on welcome
  const welcomeSent = useRef(false)
  useEffect(() => {
    if (!isWelcome || loading || !project || welcomeSent.current) return
    welcomeSent.current = true
    setTab('copilot')
    const initialMsg = `Este projeto acabou de ser criado com IA. Faça um briefing operacional completo: analise o nome, tipo e objetivo do projeto, liste as 3 prioridades imediatas, identifique possíveis riscos, e sugira os primeiros passos concretos para os próximos 7 dias.`
    setTimeout(async () => {
      setChatLoading(true)
      try {
        const res = await fetch(`/api/projects/${id}/copilot`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: initialMsg, history: [] }),
        })
        if (res.ok) {
          const data = await res.json()
          setChatHistory([
            { role: 'user', content: initialMsg },
            { role: 'assistant', content: data.message, tasks_created: data.tasks_created?.length ? data.tasks_created : undefined },
          ])
          if (data.tasks_created?.length) setTasks(prev => [...prev, ...data.tasks_created])
        }
      } catch { /* ignore */ }
      setChatLoading(false)
    }, 600)
  }, [isWelcome, loading, project, id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, chatLoading])

  // ── Chat ──
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      })
      if (res.ok) {
        const data = await res.json()
        setChatHistory(prev => [...prev, {
          role: 'assistant', content: data.message,
          tasks_created: data.tasks_created?.length ? data.tasks_created : undefined,
        }])
        if (data.tasks_created?.length) setTasks(prev => [...prev, ...data.tasks_created])
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
    setTaskForm({ title: task.title, description: task.description ?? '', status: task.status, priority: task.priority, due_date: task.due_date ?? '', assignee_name: task.assignee_name ?? '' })
    setShowTask(true)
  }
  async function saveTask() {
    if (!taskForm.title.trim()) return
    setSavingTask(true)
    try {
      const body = { title: taskForm.title.trim(), description: taskForm.description || null, status: taskForm.status, priority: taskForm.priority, due_date: taskForm.due_date || null, assignee_name: taskForm.assignee_name || null }
      if (editTask) {
        const res = await fetch(`/api/projects/${id}/tasks/${editTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.ok) { const { data } = await res.json(); setTasks(prev => prev.map(t => t.id === data.id ? data : t)) }
      } else {
        const res = await fetch(`/api/projects/${id}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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
      await fetch(`/api/projects/${id}/tasks/${tid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    } catch { /* ignore */ }
  }

  // ── Kanban DnD ──
  function onDragEnd(result: DropResult) {
    const { draggableId, destination } = result
    if (!destination) return
    const newStatus = destination.droppableId
    if (tasks.find(t => t.id === draggableId)?.status === newStatus) return
    updateTaskStatus(draggableId, newStatus)
  }

  // ── Derived ──
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
  const filteredTasks = taskFilter === 'all' ? tasks : tasks.filter(t => t.status === taskFilter)
  const cfg = project ? getTypeCfg(project.type) : getTypeCfg()
  const projectStatus = getProjectStatus(tasks, progress)

  // ── Activity feed (derived from tasks) ──
  const activityFeed = [...tasks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map(t => ({
      id: t.id,
      label: `Tarefa criada: ${t.title}`,
      sub: `${TASK_PRIORITY[t.priority as keyof typeof TASK_PRIORITY]?.label ?? ''} · ${TASK_STATUS[t.status as keyof typeof TASK_STATUS]?.label ?? ''}`,
      ts: t.created_at,
      icon: t.status === 'done' ? CheckCircle2 : t.priority === 'urgent' ? AlertTriangle : Target,
      color: t.status === 'done' ? '#10b981' : t.priority === 'urgent' ? '#ef4444' : '#6366f1',
    }))

  // chart data
  const statusChartData = [
    { name: 'A fazer',     value: taskStats.todo,        fill: '#71717a' },
    { name: 'Andamento',   value: taskStats.in_progress, fill: '#f59e0b' },
    { name: 'Revisão',     value: taskStats.in_review,   fill: '#3b82f6' },
    { name: 'Concluído',   value: taskStats.done,        fill: '#10b981' },
  ]
  const priorityChartData = [
    { name: 'Urgente', value: priorityStats.urgent, fill: '#ef4444' },
    { name: 'Alta',    value: priorityStats.high,   fill: '#f97316' },
    { name: 'Média',   value: priorityStats.medium, fill: '#f59e0b' },
    { name: 'Baixa',   value: priorityStats.low,    fill: '#71717a' },
  ]

  // ── Loading / not found ──
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
    <div
      className="min-h-screen bg-zinc-950"
      style={{ background: `radial-gradient(ellipse 90% 50% at 50% 0%, ${cfg.glow} 0%, transparent 60%), #09090b` }}
    >

      {/* ══ HERO HEADER ══════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden border-b border-zinc-800/40"
        style={{ background: `linear-gradient(135deg, ${cfg.bg} 0%, rgba(0,0,0,0) 70%)` }}
      >
        {/* accent line */}
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${cfg.color} 0%, transparent 55%)` }} />

        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start gap-4">
            {/* back button */}
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="mt-1 p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition shrink-0"
            >
              <ArrowLeft size={16} />
            </button>

            {/* circular progress */}
            <CircularProgress value={progress} color={cfg.color} size={72} />

            {/* title block */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border"
                  style={{ color: cfg.color, borderColor: `${cfg.color}35`, background: `${cfg.color}15` }}
                >
                  {cfg.label}
                </span>
                {/* AI status pill */}
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border"
                  style={{ color: projectStatus.color, borderColor: `${projectStatus.color}30`, background: `${projectStatus.color}12` }}
                >
                  <projectStatus.icon size={10} />
                  {projectStatus.label}
                </motion.span>
                {project.goal && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-400 border border-zinc-700/50 rounded-full bg-zinc-800/40">
                    <Target size={10} />
                    Meta {parseFloat(project.goal) > 0 ? `R$ ${parseFloat(project.goal).toLocaleString('pt-BR')}` : project.goal}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight truncate">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-zinc-400 mt-0.5 line-clamp-1">{project.description}</p>
              )}

              {/* quick stats */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {[
                  { label: 'A fazer',     count: taskStats.todo,        color: '#71717a' },
                  { label: 'Andamento',   count: taskStats.in_progress, color: '#f59e0b' },
                  { label: 'Revisão',     count: taskStats.in_review,   color: '#3b82f6' },
                  { label: 'Concluídas',  count: doneTasks,             color: '#10b981' },
                ].map(s => (
                  <button
                    key={s.label}
                    onClick={() => { setTab('tasks'); setTaskFilter(s.label === 'A fazer' ? 'todo' : s.label === 'Andamento' ? 'in_progress' : s.label === 'Revisão' ? 'in_review' : 'done') }}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="group-hover:text-zinc-200">{s.count} {s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openNewTask()}
              className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl shadow-lg transition shrink-0"
              style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`, boxShadow: `0 4px 20px ${cfg.color}30` }}
            >
              <Plus size={14} /> Nova tarefa
            </motion.button>
          </div>
        </div>
      </div>

      {/* ══ CONTENT ══════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Tabs */}
        <div className="flex items-center gap-0.5 mb-6 border-b border-zinc-800/40">
          {([
            { id: 'tasks',      label: 'Tarefas',    icon: CheckSquare,  count: tasks.length },
            { id: 'kanban',     label: 'Kanban',     icon: LayoutGrid,   count: 0 },
            { id: 'dashboard',  label: 'Dashboard',  icon: BarChart3,    count: 0 },
            { id: 'atividade',  label: 'Atividade',  icon: Activity,     count: activityFeed.length },
            { id: 'copilot',    label: 'Copilot IA', icon: Sparkles,     count: 0 },
            { id: 'financeiro', label: 'Financeiro', icon: DollarSign,   count: 0 },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap',
                tab === t.id
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300',
              )}
            >
              {t.id === 'copilot'
                ? <span className="relative inline-flex"><t.icon size={14} />{chatHistory.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />}</span>
                : <t.icon size={14} />
              }
              {t.label}
              {(t.id === 'tasks' || t.id === 'atividade') && t.count > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded-full">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Tab: Tarefas ──────────────────────────────────────────────────── */}
          {tab === 'tasks' && (
            <motion.div key="tasks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {/* filters */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {[
                  { id: 'all',         label: 'Todas',      count: tasks.length },
                  { id: 'todo',        label: 'A fazer',    count: taskStats.todo },
                  { id: 'in_progress', label: 'Andamento',  count: taskStats.in_progress },
                  { id: 'in_review',   label: 'Revisão',    count: taskStats.in_review },
                  { id: 'done',        label: 'Concluídas', count: doneTasks },
                ].map(f => (
                  <button key={f.id} onClick={() => setTaskFilter(f.id)}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition',
                      taskFilter === f.id ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:text-zinc-300')}
                  >
                    {f.label} <span className="opacity-50">{f.count}</span>
                  </button>
                ))}
              </div>

              {/* task list */}
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <CheckSquare size={32} className="text-zinc-700" />
                  <p className="text-zinc-500 text-sm">{taskFilter === 'all' ? 'Nenhuma tarefa ainda' : 'Nenhuma tarefa com este filtro'}</p>
                  {taskFilter === 'all' && (
                    <button onClick={() => openNewTask()} className="flex items-center gap-1.5 px-3 py-2 text-xs text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:bg-violet-500/10 rounded-lg transition">
                      <Plus size={12} /> Criar tarefa
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredTasks.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      onClick={() => openEditTask(task)}
                      className="group flex items-start gap-3 p-3.5 rounded-xl border border-zinc-800/40 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700/50 cursor-pointer transition-all"
                    >
                      <PriorityDot priority={task.priority} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className={cn('text-sm font-medium flex-1 truncate', task.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-200')}>{task.title}</p>
                          <TaskStatusBadge status={task.status} />
                        </div>
                        {task.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-600">
                          {task.due_date && <span className="flex items-center gap-1"><Calendar size={10} />{task.due_date}</span>}
                          {task.assignee_name && <span className="flex items-center gap-1"><MessageSquare size={10} />{task.assignee_name}</span>}
                          <span>{TASK_PRIORITY[task.priority as keyof typeof TASK_PRIORITY]?.label}</span>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition"
                      >
                        {deletingTask === task.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Tab: Kanban ───────────────────────────────────────────────────── */}
          {tab === 'kanban' && (
            <motion.div key="kanban" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-4 gap-4 min-h-[60vh]">
                  {KANBAN_COLS.map(col => {
                    const colTasks = tasks.filter(t => t.status === col.id)
                    const colCfg = TASK_STATUS[col.id]
                    return (
                      <div key={col.id} className="flex flex-col">
                        {/* column header */}
                        <div className="flex items-center justify-between mb-3 px-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm" style={{ color: colCfg.col }}>{col.emoji}</span>
                            <span className="text-xs font-semibold text-zinc-300">{colCfg.label}</span>
                            <span className="text-xs text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                          </div>
                          <button onClick={() => openNewTask(col.id)} className="p-0.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 transition">
                            <Plus size={12} />
                          </button>
                        </div>

                        <Droppable droppableId={col.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                'flex-1 rounded-xl p-2 space-y-2 transition-colors min-h-[120px]',
                                snapshot.isDraggingOver ? 'bg-zinc-800/30 border border-dashed border-zinc-700/50' : 'bg-zinc-900/20 border border-zinc-800/20'
                              )}
                            >
                              {colTasks.map((task, index) => (
                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                  {(prov, snap) => (
                                    <div
                                      ref={prov.innerRef}
                                      {...prov.draggableProps}
                                      {...prov.dragHandleProps}
                                      onClick={() => openEditTask(task)}
                                      className={cn(
                                        'p-3 rounded-lg border bg-zinc-900 cursor-grab active:cursor-grabbing transition-all',
                                        snap.isDragging
                                          ? 'border-violet-500/40 shadow-xl shadow-violet-500/10 rotate-1 scale-105'
                                          : 'border-zinc-800/40 hover:border-zinc-700/50'
                                      )}
                                    >
                                      <div className="flex items-start gap-2">
                                        <PriorityDot priority={task.priority} />
                                        <p className={cn('text-xs font-medium leading-snug flex-1', task.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-200')}>{task.title}</p>
                                      </div>
                                      {task.description && (
                                        <p className="text-xs text-zinc-600 mt-1.5 line-clamp-2">{task.description}</p>
                                      )}
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs text-zinc-600">{TASK_PRIORITY[task.priority as keyof typeof TASK_PRIORITY]?.label}</span>
                                        {task.due_date && <span className="ml-auto text-xs text-zinc-600 flex items-center gap-0.5"><Calendar size={9} />{task.due_date}</span>}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              {colTasks.length === 0 && !snapshot.isDraggingOver && (
                                <div className="flex items-center justify-center h-16 text-xs text-zinc-700">
                                  Arraste tarefas aqui
                                </div>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )
                  })}
                </div>
              </DragDropContext>
            </motion.div>
          )}

          {/* ── Tab: Dashboard ────────────────────────────────────────────────── */}
          {tab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Progresso geral', value: `${progress}%`, icon: Target, color: cfg.color, sub: `${doneTasks}/${tasks.length} tarefas` },
                  { label: 'Em andamento',    value: taskStats.in_progress, icon: Clock, color: '#f59e0b', sub: 'tarefas ativas' },
                  { label: 'Urgentes',        value: priorityStats.urgent,  icon: AlertTriangle, color: '#ef4444', sub: 'precisam atenção' },
                  { label: 'Status IA',       value: projectStatus.label,   icon: projectStatus.icon, color: projectStatus.color, sub: 'análise automática' },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="relative overflow-hidden p-4 rounded-2xl border border-zinc-800/40 bg-zinc-900/40"
                    style={{ boxShadow: `inset 0 0 30px ${kpi.color}06` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-xs text-zinc-500 font-medium">{kpi.label}</p>
                      <div className="p-1.5 rounded-lg" style={{ background: `${kpi.color}15` }}>
                        <kpi.icon size={12} style={{ color: kpi.color }} />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-white truncate">{kpi.value}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{kpi.sub}</p>
                    <div className="absolute bottom-0 left-0 h-px w-full" style={{ background: `linear-gradient(90deg, ${kpi.color}50, transparent)` }} />
                  </motion.div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Status bar chart */}
                <div className="p-5 rounded-2xl border border-zinc-800/40 bg-zinc-900/40">
                  <p className="text-sm font-semibold text-zinc-200 mb-4">Tarefas por status</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={statusChartData} barSize={28}>
                      <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {statusChartData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Priority pie */}
                <div className="p-5 rounded-2xl border border-zinc-800/40 bg-zinc-900/40">
                  <p className="text-sm font-semibold text-zinc-200 mb-4">Distribuição de prioridade</p>
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={priorityChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                          {priorityChartData.map((d, i) => (
                            <Cell key={i} fill={d.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2.5 flex-1">
                      {priorityChartData.map(d => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                            <span className="text-xs text-zinc-400">{d.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-white">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress area + velocity */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Completion progress */}
                <div className="md:col-span-2 p-5 rounded-2xl border border-zinc-800/40 bg-zinc-900/40">
                  <p className="text-sm font-semibold text-zinc-200 mb-1">Velocity operacional</p>
                  <p className="text-xs text-zinc-500 mb-4">Tarefas concluídas vs. abertas</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={[
                      { name: 'Abertas',    value: tasks.length - doneTasks },
                      { name: 'Concluídas', value: doneTasks },
                    ]}>
                      <defs>
                        <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={cfg.color} stopOpacity={0}  />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="value" stroke={cfg.color} fill="url(#colorGrad)" strokeWidth={2} dot={{ fill: cfg.color, r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* AI score card */}
                <div className="p-5 rounded-2xl border border-zinc-800/40 bg-zinc-900/40 flex flex-col items-center justify-center text-center">
                  <p className="text-xs text-zinc-500 mb-4 font-medium">Score de saúde IA</p>
                  <CircularProgress
                    value={tasks.length === 0 ? 0 : Math.max(0, 100 - (priorityStats.urgent * 15) - (taskStats.todo > tasks.length * 0.8 ? 20 : 0) + (progress > 50 ? 20 : 0))}
                    size={100}
                    stroke={7}
                    color={projectStatus.color}
                  />
                  <p className="text-xs text-zinc-400 mt-3 font-medium" style={{ color: projectStatus.color }}>{projectStatus.label}</p>
                  <p className="text-xs text-zinc-600 mt-1">Análise automática</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Tab: Atividade ────────────────────────────────────────────────── */}
          {tab === 'atividade' && (
            <motion.div key="atividade" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <div className="max-w-2xl">
                <p className="text-xs text-zinc-500 mb-5 font-medium">Feed operacional · {activityFeed.length} eventos</p>

                {activityFeed.length === 0 ? (
                  <div className="flex flex-col items-center py-20 gap-3 text-zinc-600">
                    <Activity size={28} />
                    <p className="text-sm">Nenhuma atividade ainda</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* timeline line */}
                    <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800/60" />

                    <div className="space-y-1">
                      {activityFeed.map((item, i) => {
                        const Icon = item.icon
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-start gap-4 py-3 px-1"
                          >
                            <div className="relative z-10 shrink-0 w-10 h-10 rounded-full border border-zinc-800/60 bg-zinc-950 flex items-center justify-center" style={{ boxShadow: `0 0 12px ${item.color}20` }}>
                              <Icon size={14} style={{ color: item.color }} />
                            </div>
                            <div className="flex-1 min-w-0 pt-2">
                              <p className="text-sm text-zinc-300 font-medium line-clamp-1">{item.label}</p>
                              <p className="text-xs text-zinc-600 mt-0.5">{item.sub}</p>
                            </div>
                            <p className="text-xs text-zinc-700 shrink-0 pt-2.5">
                              {new Date(item.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </p>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* AI copilot summary */}
                {chatHistory.filter(m => m.role === 'assistant').length > 0 && (
                  <div className="mt-6 p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={12} className="text-violet-400" />
                      <p className="text-xs font-semibold text-violet-400">Copilot IA ativado</p>
                    </div>
                    <p className="text-xs text-zinc-400">{chatHistory.filter(m => m.role === 'assistant').length} análises realizadas neste projeto</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Tab: Copilot IA ───────────────────────────────────────────────── */}
          {tab === 'copilot' && (
            <motion.div key="copilot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className="flex flex-col h-[calc(100vh-280px)] min-h-[480px]"
            >
              {/* messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
                {chatHistory.length === 0 && !chatLoading && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}30` }}>
                      <Sparkles size={22} style={{ color: cfg.color }} />
                    </div>
                    <div>
                      <p className="text-zinc-300 font-semibold text-sm">Copilot IA pronto</p>
                      <p className="text-xs text-zinc-500 mt-1">Pergunte sobre tarefas, riscos, estratégia ou peça para criar ações.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center max-w-md">
                      {[
                        'Quais são os principais riscos?',
                        'Crie um plano de ação para esta semana',
                        'Analise o progresso atual',
                        'Quais tarefas priorizar?',
                      ].map(s => (
                        <button key={s} onClick={() => { setChatInput(s); }}
                          className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600/50 hover:bg-zinc-800/40 transition">
                          {s}
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
                    transition={{ duration: 0.2 }}
                    className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5" style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}30` }}>
                        <Bot size={12} style={{ color: cfg.color }} />
                      </div>
                    )}
                    <div className={cn('max-w-[75%]', msg.role === 'user' ? 'order-first' : '')}>
                      <div className={cn('px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                        msg.role === 'user'
                          ? 'bg-violet-600/90 text-white rounded-tr-sm'
                          : 'bg-zinc-900/80 border border-zinc-800/50 text-zinc-200 rounded-tl-sm'
                      )}>
                        {msg.content}
                      </div>
                      {msg.tasks_created && msg.tasks_created.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                          className="mt-2 px-3 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/8 text-xs text-emerald-400">
                          <div className="flex items-center gap-1.5 font-semibold mb-1">
                            <CheckCircle2 size={12} /> {msg.tasks_created.length} {msg.tasks_created.length === 1 ? 'tarefa criada' : 'tarefas criadas'}
                          </div>
                          <div className="space-y-0.5 text-emerald-500/70">
                            {msg.tasks_created.slice(0, 3).map(t => <div key={t.id}>· {t.title}</div>)}
                            {msg.tasks_created.length > 3 && <div>+ {msg.tasks_created.length - 3} mais</div>}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {chatLoading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center" style={{ background: `${cfg.color}20` }}>
                      <Bot size={12} style={{ color: cfg.color }} />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-900/80 border border-zinc-800/50">
                      <div className="flex gap-1 items-center h-4">
                        {[0, 1, 2].map(j => (
                          <motion.span key={j} className="w-1.5 h-1.5 rounded-full bg-zinc-500"
                            animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* input */}
              <div className="flex gap-2 items-end">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Pergunte ao Copilot IA... (Enter para enviar)"
                  rows={1}
                  className="flex-1 px-4 py-3 bg-zinc-900/60 border border-zinc-800/50 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500/50 transition"
                  style={{ minHeight: 48, maxHeight: 120 }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="p-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ background: cfg.color, boxShadow: `0 4px 16px ${cfg.color}30` }}
                >
                  {chatLoading ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white" />}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Tab: Financeiro ───────────────────────────────────────────────── */}
          {tab === 'financeiro' && (
            <motion.div key="financeiro" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

              {/* summary cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Receita total', value: fmt(totalRev), icon: TrendingUp, color: '#10b981', delta: totalRev > 0 },
                  { label: 'Despesas',      value: fmt(totalExp), icon: TrendingDown, color: '#ef4444', delta: false },
                  { label: 'Lucro líquido', value: fmt(profit),   icon: DollarSign, color: profit >= 0 ? '#10b981' : '#ef4444', delta: profit >= 0 },
                ].map((card, i) => (
                  <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className="p-5 rounded-2xl border border-zinc-800/40 bg-zinc-900/40">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-zinc-500">{card.label}</p>
                      <card.icon size={14} style={{ color: card.color }} />
                    </div>
                    <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Revenues */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-zinc-200">Receitas</p>
                    <a href={`/api/projects/${id}/revenues`} className="text-xs text-emerald-400 hover:underline">+ Adicionar</a>
                  </div>
                  {revenues.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-8 text-center border border-zinc-800/40 rounded-xl">Nenhuma receita registrada</p>
                  ) : (
                    <div className="space-y-2">
                      {revenues.map(r => (
                        <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-800/40 bg-zinc-900/30">
                          <div>
                            <p className="text-xs font-medium text-zinc-300">{r.name}</p>
                            <p className="text-xs text-zinc-600">{r.source} · {r.date}</p>
                          </div>
                          <p className="text-sm font-semibold text-emerald-400">{fmt(r.value)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expenses */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-zinc-200">Despesas</p>
                    <a href={`/api/projects/${id}/expenses`} className="text-xs text-red-400 hover:underline">+ Adicionar</a>
                  </div>
                  {expenses.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-8 text-center border border-zinc-800/40 rounded-xl">Nenhuma despesa registrada</p>
                  ) : (
                    <div className="space-y-2">
                      {expenses.map(e => (
                        <div key={e.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-800/40 bg-zinc-900/30">
                          <div>
                            <p className="text-xs font-medium text-zinc-300">{e.name}</p>
                            <p className="text-xs text-zinc-600">{e.category} · {e.date}</p>
                          </div>
                          <p className="text-sm font-semibold text-red-400">{fmt(e.value)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ══ TASK MODAL ═══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showTask && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowTask(false) }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-lg bg-zinc-900 border border-zinc-800/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
                <h3 className="text-sm font-semibold text-white">{editTask ? 'Editar tarefa' : 'Nova tarefa'}</h3>
                <button onClick={() => setShowTask(false)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition">
                  <X size={14} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* title */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Título *</label>
                  <input
                    autoFocus
                    value={taskForm.title}
                    onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveTask()}
                    placeholder="Nome da tarefa"
                    className="w-full px-3 py-2.5 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition"
                  />
                </div>

                {/* description */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Descrição</label>
                  <textarea
                    value={taskForm.description}
                    onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Detalhes da tarefa..."
                    rows={2}
                    className="w-full px-3 py-2.5 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition resize-none"
                  />
                </div>

                {/* status + priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Status</label>
                    <select
                      value={taskForm.status}
                      onChange={e => setTaskForm(p => ({ ...p, status: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-violet-500/50 transition"
                    >
                      {Object.entries(TASK_STATUS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Prioridade</label>
                    <select
                      value={taskForm.priority}
                      onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-violet-500/50 transition"
                    >
                      {Object.entries(TASK_PRIORITY).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* due date + assignee */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Prazo</label>
                    <input
                      type="date"
                      value={taskForm.due_date}
                      onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-violet-500/50 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Responsável</label>
                    <input
                      value={taskForm.assignee_name}
                      onChange={e => setTaskForm(p => ({ ...p, assignee_name: e.target.value }))}
                      placeholder="Nome..."
                      className="w-full px-3 py-2.5 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition"
                    />
                  </div>
                </div>
              </div>

              {/* modal footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800/50">
                {editTask ? (
                  <button onClick={() => { deleteTask(editTask.id); setShowTask(false) }} className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 hover:bg-red-400/10 rounded-lg transition">
                    <Trash2 size={12} /> Excluir
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowTask(false)} className="px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 rounded-lg transition">Cancelar</button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={saveTask}
                    disabled={savingTask || !taskForm.title.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition"
                    style={{ background: cfg.color }}
                  >
                    {savingTask ? <Loader2 size={12} className="animate-spin" /> : null}
                    {editTask ? 'Salvar' : 'Criar tarefa'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
