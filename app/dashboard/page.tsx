'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Sparkles, ArrowRight, TrendingUp, TrendingDown,
  DollarSign, AlertTriangle, CheckCircle2, Zap, BarChart3,
  MessageSquare, Users, Phone, Mail, Package, Activity,
  ChevronRight, Send, Mic, Image, FileText, Table,
  RefreshCw, Bell, ShieldAlert, Lightbulb, Play, Loader2,
  Brain, Target, X, Flame, Eye, Upload, Paperclip,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { gerarDiagnostico } from '@/lib/diagnostico'
import { gerarInsights } from '@/lib/insights'
import { gerarAlertas } from '@/lib/alertas'
import type { Diagnostico } from '@/lib/diagnostico'
import type { InsightAcao } from '@/lib/insights'
import type { Alerta } from '@/lib/alertas'

// ─── Types ─────────────────────────────────────────────────────

interface UploadedAttachment {
  id:             string | null
  name:           string
  mime:           string
  type_category:  'document' | 'image' | 'audio'
  extracted_text: string | null
  ai_summary:     string | null
  url:            string
  size:           number
  localPreviewUrl?: string
}

type FileUploadState = 'uploading' | 'extracting' | 'done' | 'error'

interface PendingFile {
  tempId:      string
  file:        File
  state:       FileUploadState
  result?:     UploadedAttachment
  error?:      string
  previewUrl?: string
}

interface SessionData {
  nomeEmpresa?: string
  email?: string
  nome?: string
  perfil?: string
  setor?: string
  metaMensal?: number | null
  principalDesafio?: string
  company_id?: string
  companyId?: string
  stage?: string
  revenueRange?: string
}

interface AIChatMessage {
  id:           string
  role:         'ai' | 'user'
  content:      string
  attachments?: UploadedAttachment[]
  actionCards?: { label: string; href: string; color: string }[]
  timestamp:    Date
}

// ─── Formatters ────────────────────────────────────────────────

function fmtBRL(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1000).toFixed(1)}k`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

function fmtBRLExact(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

// ─── Pipeline header ──────────────────────────────────────────

const PIPELINE_STEPS = [
  { id: 1, label: 'VOCÊ PERGUNTA' },
  { id: 2, label: 'A IA ENTENDE' },
  { id: 3, label: 'A IA ANALISA' },
  { id: 4, label: 'A IA EXECUTA' },
  { id: 5, label: 'A IA TE LEVA' },
]

function PipelineHeader({ companyName }: { companyName: string }) {
  return (
    <div className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md px-6 py-4">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-lg font-bold leading-tight text-white">
            NEXUS IA{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              – CENTRO OPERACIONAL INTELIGENTE
            </span>
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            A IA que entende, analisa, decide e executa. Você conversa, a IA resolve e te leva direto para onde precisa.
          </p>
        </div>

        {/* Pipeline flow */}
        <div className="hidden lg:flex items-center gap-1 shrink-0">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-[10px] font-bold text-violet-400">
                  {step.id}
                </div>
                <span className="text-[8px] font-semibold text-zinc-500 uppercase tracking-wide w-16 text-center leading-tight">
                  {step.label}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <ChevronRight size={12} className="text-zinc-700 mb-3 mx-0.5" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Animated value counter ────────────────────────────────────

function AnimValue({ value, prefix = 'R$ ', className }: { value: number; prefix?: string; className?: string }) {
  const [displayed, setDisplayed] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const diff = value - prev.current
    if (diff === 0) return
    const steps = 25
    let step = 0
    const t = setInterval(() => {
      step++
      const progress = step / steps
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(prev.current + diff * ease))
      if (step >= steps) { setDisplayed(value); prev.current = value; clearInterval(t) }
    }, 24)
    return () => clearInterval(t)
  }, [value])
  return (
    <span className={className}>
      {prefix}{Math.round(displayed).toLocaleString('pt-BR')}
    </span>
  )
}

// ─── AI Cockpit ────────────────────────────────────────────────

function AICockpit({
  session,
  diagnostico,
  aiName,
  messages,
  onSendMessage,
  sending,
}: {
  session: SessionData
  diagnostico: Diagnostico | null
  aiName: string
  messages: AIChatMessage[]
  onSendMessage: (text: string, attachments?: UploadedAttachment[]) => void
  sending: boolean
}) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function handleSend() {
    if (!input.trim() || sending) return
    onSendMessage(input.trim())
    setInput('')
  }

  const hora = new Date().getHours()
  const greeting = hora < 12 ? '☀️ Bom dia' : hora < 18 ? '👋 Boa tarde' : '🌙 Boa noite'
  const companyName = session.nomeEmpresa ?? 'sua empresa'

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      {/* Top identity bar */}
      <div className="flex items-center gap-4 border-b border-zinc-800/60 bg-zinc-900/60 px-5 py-3">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/15">
            <Bot size={20} className="text-violet-400" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 bg-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">{aiName}</p>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              Online e aprendendo
            </span>
          </div>
          <p className="text-xs text-zinc-500">Seu COO Inteligente</p>
        </div>
        <div className="ml-auto">
          <p className="text-xs text-zinc-600">{greeting}, <span className="text-zinc-400 font-medium">{companyName}</span></p>
        </div>
      </div>

      {/* Messages area */}
      <div className="max-h-64 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
          >
            {msg.role === 'ai' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
                <Bot size={12} className="text-violet-400" />
              </div>
            )}
            <div className={cn(
              'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
              msg.role === 'ai'
                ? 'bg-zinc-800/60 text-zinc-200'
                : 'bg-violet-600/20 border border-violet-600/30 text-zinc-200 rounded-tr-sm',
            )}>
              {/* Attachment chips */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {msg.attachments.map((a, ai) => (
                    <div
                      key={ai}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2 py-1"
                    >
                      {a.localPreviewUrl ? (
                        <img src={a.localPreviewUrl} alt="" className="h-5 w-5 rounded object-cover" />
                      ) : (
                        <span className="text-xs">
                          {a.type_category === 'image' ? '🖼️' : a.type_category === 'audio' ? '🎤' : '📎'}
                        </span>
                      )}
                      <span className="max-w-[110px] truncate text-[10px] text-zinc-400">{a.name}</span>
                      {a.ai_summary && (
                        <CheckCircle2 size={9} className="shrink-0 text-emerald-400" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {msg.content}
              {msg.actionCards && msg.actionCards.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.actionCards.map(card => (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-700"
                    >
                      <Zap size={10} className="text-violet-400" />
                      {card.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
              <Bot size={12} className="text-violet-400" />
            </div>
            <div className="rounded-xl bg-zinc-800/60 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-violet-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Inline input */}
      <div className="border-t border-zinc-800/60 px-4 py-3 flex items-center gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Pergunte algo ou dê um comando para a IA..."
          className="flex-1 rounded-xl border border-zinc-700/50 bg-zinc-800/60 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  )
}

// ─── Executive Vision ──────────────────────────────────────────

interface ExecMetric {
  label:    string
  value:    number
  suffix?:  string
  color:    string
  trend:    'up' | 'down' | 'neutral'
  desc:     string
}

function ExecutiveVision({ metrics }: { metrics: ExecMetric[] }) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={14} className="text-violet-400" />
        <h2 className="text-sm font-semibold text-white">Visão Executiva Inteligente</h2>
        <span className="text-[11px] text-zinc-600">Análise completa do seu negócio</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-3"
          >
            {/* glow */}
            <div
              className="absolute inset-0 opacity-5"
              style={{ background: `radial-gradient(ellipse at top left, ${m.color}, transparent 70%)` }}
            />
            <p className="text-[10px] text-zinc-500 leading-tight mb-1">{m.label}</p>
            <p className="text-lg font-bold text-white leading-none" style={{ color: m.color }}>
              {m.suffix === '' ? m.value : fmtBRL(m.value)}
              {m.suffix && m.suffix !== '' && (
                <span className="text-xs font-normal text-zinc-500 ml-0.5">{m.suffix}</span>
              )}
            </p>
            <p className="mt-1.5 text-[10px] text-zinc-600 leading-snug">{m.desc}</p>
            {/* mini sparkline placeholder */}
            <div className="mt-2 h-6 overflow-hidden opacity-40">
              <svg viewBox="0 0 60 24" className="w-full h-full" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke={m.color}
                  strokeWidth="1.5"
                  points={
                    m.trend === 'up'
                      ? '0,20 12,16 24,14 36,10 48,6 60,4'
                      : m.trend === 'down'
                        ? '0,4 12,8 24,12 36,16 48,18 60,20'
                        : '0,12 12,10 24,14 36,11 48,13 60,12'
                  }
                />
              </svg>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Action cards ─────────────────────────────────────────────

const ACTION_CARDS = [
  {
    id:    'cobrar',
    icon:  DollarSign,
    label: 'Cobrar Clientes',
    desc:  'Iniciar cobrança em massa',
    color: '#ef4444',
    href:  '/dashboard/financeiro?filter=inadimplentes',
  },
  {
    id:    'relatorio',
    icon:  BarChart3,
    label: 'Gerar Relatório',
    desc:  'Relatório financeiro completo',
    color: '#8b5cf6',
    href:  '/dashboard/revenue',
  },
  {
    id:    'campanha',
    icon:  MessageSquare,
    label: 'Criar Campanha',
    desc:  'Campanha no WhatsApp/Email',
    color: '#10b981',
    href:  '/dashboard/messages',
  },
  {
    id:    'vendas',
    icon:  TrendingUp,
    label: 'Analisar Vendas',
    desc:  'Análise completa do funil',
    color: '#f59e0b',
    href:  '/dashboard/sales',
  },
  {
    id:    'custos',
    icon:  Package,
    label: 'Reduzir Custos',
    desc:  'Encontrar economia na empresa',
    color: '#06b6d4',
    href:  '/dashboard/suppliers',
  },
  {
    id:    'fluxos',
    icon:  Zap,
    label: 'Fluxos IA',
    desc:  'Ver e gerenciar fluxos ativos',
    color: '#6366f1',
    href:  '/dashboard/actions',
  },
]

function SmartActionCards() {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Brain size={14} className="text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">O que posso fazer por você hoje?</h2>
        <span className="text-[11px] text-zinc-600">Comandos inteligentes e automações</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACTION_CARDS.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={card.href}
                className="group flex flex-col gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/60"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ background: `${card.color}20`, border: `1px solid ${card.color}30` }}
                >
                  <Icon size={18} style={{ color: card.color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{card.label}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{card.desc}</p>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Multimodal bottom input bar (fully functional) ───────────

function MultimodalInputBar({
  onSend,
  sending,
}: {
  onSend: (text: string, attachments: UploadedAttachment[]) => void
  sending: boolean
}) {
  const [input, setInput]                     = useState('')
  const [pendingFiles, setPendingFiles]        = useState<PendingFile[]>([])
  const [isRecording, setIsRecording]          = useState(false)
  const [isDragging, setIsDragging]            = useState(false)
  const [recordingTime, setRecordingTime]      = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const imageInputRef    = useRef<HTMLInputElement>(null)
  const audioInputRef    = useRef<HTMLInputElement>(null)
  const docInputRef      = useRef<HTMLInputElement>(null)
  const sheetInputRef    = useRef<HTMLInputElement>(null)

  // ── Upload one file ─────────────────────────────────────────
  async function uploadOneFile(file: File) {
    const tempId     = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined

    setPendingFiles(p => [...p, { tempId, file, state: 'uploading', previewUrl }])

    try {
      const form = new FormData()
      form.append('file', file)
      setPendingFiles(p => p.map(f => f.tempId === tempId ? { ...f, state: 'extracting' } : f))

      const res = await fetch('/api/ai/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload falhou' })) as { error?: string }
        throw new Error(err.error ?? 'Upload falhou')
      }

      const data = await res.json() as UploadedAttachment
      const result: UploadedAttachment = { ...data, localPreviewUrl: previewUrl }
      setPendingFiles(p => p.map(f => f.tempId === tempId ? { ...f, state: 'done', result } : f))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro no upload'
      setPendingFiles(p => p.map(f => f.tempId === tempId ? { ...f, state: 'error', error: msg } : f))
    }
  }

  // ── Handle file list ────────────────────────────────────────
  function handleFiles(files: FileList | File[]) {
    const valid = Array.from(files).filter(f => {
      if (f.type.startsWith('image/') && f.size > 10 * 1024 * 1024) return false
      if (f.type.startsWith('audio/') && f.size > 25 * 1024 * 1024) return false
      if (f.size > 30 * 1024 * 1024) return false
      return true
    })
    void Promise.all(valid.map(uploadOneFile))
  }

  // ── Voice recording ─────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr     = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `gravacao-${Date.now()}.webm`, { type: 'audio/webm' })
        await uploadOneFile(file)
        setIsRecording(false)
        setRecordingTime(0)
        if (timerRef.current) clearInterval(timerRef.current)
      }
      mr.start(200)
      mediaRecorderRef.current = mr
      setIsRecording(true)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch { /* mic denied */ }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  // ── Drag & drop ─────────────────────────────────────────────
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  // ── Send ─────────────────────────────────────────────────────
  function handleSend() {
    if (sending) return
    const ready = pendingFiles.filter(f => f.state === 'done' && f.result).map(f => f.result!)
    const uploadingCount = pendingFiles.filter(f => f.state === 'uploading' || f.state === 'extracting').length
    if (uploadingCount > 0) return
    if (!input.trim() && ready.length === 0) return
    onSend(input.trim(), ready)
    setInput('')
    setPendingFiles([])
  }

  const uploadingCount = pendingFiles.filter(f => f.state === 'uploading' || f.state === 'extracting').length
  const readyCount     = pendingFiles.filter(f => f.state === 'done').length
  const canSend        = !sending && uploadingCount === 0 && (input.trim().length > 0 || readyCount > 0)

  function fmtSize(bytes: number) {
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
  }
  function fmtTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  function fileIcon(mime: string) {
    if (mime.startsWith('image/')) return '🖼️'
    if (mime.startsWith('audio/')) return '🎤'
    if (mime.includes('pdf'))      return '📄'
    if (mime.includes('sheet') || mime.includes('csv') || mime.includes('excel')) return '📊'
    return '📎'
  }

  return (
    <div
      className={cn(
        'rounded-2xl border bg-zinc-900/60 transition-all',
        isDragging ? 'border-violet-500/60 bg-violet-500/5 shadow-lg shadow-violet-500/10' : 'border-zinc-800/60',
      )}
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false) }}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <Upload size={13} className="text-violet-400" />
          <p className="text-xs font-semibold text-white">IA Multimodal</p>
          <span className="text-[10px] text-zinc-600">Envie texto, áudio, imagem, PDF ou planilha</span>
        </div>
        {isDragging && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs font-semibold text-violet-400"
          >
            Solte o arquivo aqui ↓
          </motion.span>
        )}
      </div>

      {/* Attachment preview chips */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pt-3">
          {pendingFiles.map(pf => {
            const isLoading = pf.state === 'uploading' || pf.state === 'extracting'
            const labelMap: Record<FileUploadState, string> = {
              uploading:  'Enviando...',
              extracting: 'IA analisando...',
              done:       'Analisado',
              error:      pf.error ?? 'Erro',
            }
            return (
              <motion.div
                key={pf.tempId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
                  pf.state === 'done'  ? 'border-emerald-800/40 bg-emerald-950/20' :
                  pf.state === 'error' ? 'border-red-800/40 bg-red-950/20' :
                                         'border-violet-800/40 bg-violet-950/20',
                )}
              >
                {pf.previewUrl && pf.state === 'done' ? (
                  <img src={pf.previewUrl} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <span className="text-base leading-none">{fileIcon(pf.file.type)}</span>
                )}
                <div className="min-w-0">
                  <p className="max-w-[130px] truncate font-medium text-zinc-300">{pf.file.name}</p>
                  <div className="flex items-center gap-1.5">
                    {isLoading && <Loader2 size={9} className="animate-spin text-violet-400" />}
                    <span className={cn(
                      'text-[10px]',
                      pf.state === 'done'  ? 'text-emerald-400' :
                      pf.state === 'error' ? 'text-red-400' : 'text-violet-400',
                    )}>
                      {labelMap[pf.state]}
                    </span>
                    {pf.state === 'done' && (
                      <span className="text-[10px] text-zinc-600">{fmtSize(pf.file.size)}</span>
                    )}
                  </div>
                </div>
                {!isLoading && (
                  <button
                    onClick={() => setPendingFiles(p => p.filter(f => f.tempId !== pf.tempId))}
                    className="ml-1 shrink-0 text-zinc-600 transition hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="mx-5 mt-3 flex items-center gap-3 rounded-xl border border-red-800/40 bg-red-950/20 px-4 py-2.5">
          <motion.span
            className="h-2 w-2 shrink-0 rounded-full bg-red-500"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-xs font-semibold text-red-400">Gravando {fmtTime(recordingTime)}</span>
          <button
            onClick={stopRecording}
            className="ml-auto rounded-lg bg-red-600/30 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition hover:bg-red-600/50"
          >
            Parar e enviar
          </button>
        </div>
      )}

      {/* Text input */}
      <div className="px-5 py-3">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={
              isDragging
                ? 'Solte o arquivo aqui...'
                : pendingFiles.length > 0
                  ? 'Adicione uma instrução ou envie diretamente...'
                  : 'Fale com a IA, analise documentos, faça perguntas...'
            }
            rows={2}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-white placeholder-zinc-600 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-t border-zinc-800/40 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {/* Image */}
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-300"
          >
            <Image size={13} />
            Imagem
          </button>

          {/* Audio file */}
          <button
            onClick={() => audioInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-300"
          >
            <Paperclip size={13} />
            Áudio
          </button>

          {/* Voice record */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition',
              isRecording
                ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300',
            )}
          >
            <Mic size={13} />
            {isRecording ? `Parar (${fmtTime(recordingTime)})` : 'Gravar voz'}
          </button>

          {/* PDF / doc */}
          <button
            onClick={() => docInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-300"
          >
            <FileText size={13} />
            PDF
          </button>

          {/* Spreadsheet */}
          <button
            onClick={() => sheetInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-300"
          >
            <Table size={13} />
            Planilha
          </button>

          {/* Drag hint */}
          <span className="ml-auto text-[10px] text-zinc-700">
            ou arraste arquivos aqui
          </span>

          {/* Processing indicator */}
          {uploadingCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-violet-500/10 px-2.5 py-1 ml-1">
              <Loader2 size={10} className="animate-spin text-violet-400" />
              <span className="text-[10px] font-medium text-violet-400">
                {uploadingCount} processando...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/m4a,audio/x-m4a,audio/ogg,audio/webm"
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
      <input
        ref={sheetInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  )
}

// ─── Day Summary (right panel) ────────────────────────────────

function DaySummary({ diagnostico }: { diagnostico: Diagnostico | null }) {
  const kpis = [
    {
      label: 'Faturamento',
      value: diagnostico ? diagnostico.ganhoTotalEstimado * 3.2 : 84250,
      delta: '+12.5%',
      positive: true,
    },
    {
      label: 'Recebimentos',
      value: diagnostico ? diagnostico.ganhoTotalEstimado * 1.8 : 45630,
      delta: '+8.2%',
      positive: true,
    },
    {
      label: 'Despesas',
      value: diagnostico ? diagnostico.perdaTotalEstimada * 1.6 : 28450,
      delta: '-3.1%',
      positive: false,
    },
    {
      label: 'Lucro Líquido',
      value: diagnostico
        ? (diagnostico.ganhoTotalEstimado * 3.2) - (diagnostico.perdaTotalEstimada * 1.6)
        : 16820,
      delta: '+18.7%',
      positive: true,
    },
  ]

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-emerald-400" />
          <p className="text-xs font-semibold text-white">Resumo do Dia</p>
        </div>
        <span className="text-[10px] text-zinc-600">Atualizado agora</span>
      </div>
      <div className="space-y-2">
        {kpis.map(k => (
          <div key={k.label} className="flex items-center justify-between py-1 border-b border-zinc-800/40 last:border-0">
            <p className="text-xs text-zinc-500">{k.label}</p>
            <div className="text-right">
              <p className="text-xs font-semibold text-white">{fmtBRLExact(k.value)}</p>
              <span className={cn('text-[10px] font-medium', k.positive ? 'text-emerald-400' : 'text-red-400')}>
                {k.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Intelligent Alerts (right panel) ────────────────────────

function alertStyle(tipo: string) {
  if (tipo === 'perigo')       return { border: 'border-red-800/40',     bg: 'bg-red-950/20',     dot: 'bg-red-400',     text: 'text-red-300' }
  if (tipo === 'atencao')      return { border: 'border-amber-800/40',   bg: 'bg-amber-950/20',   dot: 'bg-amber-400',   text: 'text-amber-300' }
  if (tipo === 'oportunidade') return { border: 'border-emerald-800/40', bg: 'bg-emerald-950/20', dot: 'bg-emerald-400', text: 'text-emerald-300' }
  return { border: 'border-zinc-800/40', bg: 'bg-zinc-900/20', dot: 'bg-zinc-400', text: 'text-zinc-300' }
}

function IntelligentAlerts({ alertas }: { alertas: Alerta[] }) {
  const display = alertas.slice(0, 4)

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-amber-400" />
          <p className="text-xs font-semibold text-white">Alertas Inteligentes</p>
        </div>
        {alertas.length > 0 && (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            {alertas.length} prioritário{alertas.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {display.length === 0 && (
        <div className="py-6 text-center">
          <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
          <p className="text-xs text-zinc-500">Nenhum alerta ativo</p>
        </div>
      )}

      <div className="space-y-2">
        {display.map(a => {
          const s = alertStyle(a.tipo)
          return (
            <div key={a.id} className={cn('rounded-xl border p-3', s.border, s.bg)}>
              <div className="flex items-start gap-2">
                <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold leading-snug', s.text)}>{a.titulo}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500 leading-snug line-clamp-2">{a.descricao}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {alertas.length > 4 && (
        <Link
          href="/dashboard/alerts"
          className="mt-3 flex items-center justify-center gap-1 text-[11px] text-violet-400 hover:text-violet-300"
        >
          Ver todos os alertas <ArrowRight size={10} />
        </Link>
      )}
    </div>
  )
}

// ─── Quick Access (right panel) ───────────────────────────────

const QUICK_LINKS = [
  { label: 'Financeiro',  icon: DollarSign,   href: '/dashboard/financeiro',  color: '#10b981' },
  { label: 'Cobranças',   icon: AlertTriangle, href: '/dashboard/financeiro?filter=inadimplentes', color: '#ef4444' },
  { label: 'Leads & CRM', icon: Users,         href: '/dashboard/leads',       color: '#8b5cf6' },
  { label: 'Vendas IA',   icon: TrendingUp,    href: '/dashboard/sales',       color: '#f59e0b' },
  { label: 'Relatórios',  icon: BarChart3,     href: '/dashboard/revenue',     color: '#06b6d4' },
]

function QuickAccess() {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Zap size={13} className="text-violet-400" />
        <p className="text-xs font-semibold text-white">Acesso Rápido</p>
        <span className="text-[10px] text-zinc-600">Seus módulos mais usados</span>
      </div>
      <div className="space-y-1">
        {QUICK_LINKS.map(l => {
          const Icon = l.icon
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-between rounded-xl px-3 py-2 transition hover:bg-zinc-800/60 group"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-lg"
                  style={{ background: `${l.color}18`, border: `1px solid ${l.color}20` }}
                >
                  <Icon size={11} style={{ color: l.color }} />
                </div>
                <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition">{l.label}</span>
              </div>
              <ChevronRight size={11} className="text-zinc-700 group-hover:text-zinc-500 transition" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Autonomous Panel (right panel) ──────────────────────────

const AUTONOMOUS_TASKS = [
  { label: 'Monitorando inadimplência', color: '#ef4444' },
  { label: 'Enviando lembretes de cobrança', color: '#f59e0b' },
  { label: 'Analisando oportunidades', color: '#8b5cf6' },
  { label: 'Gerando relatórios diários', color: '#10b981' },
]

function AutonomousPanel({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-cyan-400" />
          <p className="text-xs font-semibold text-white">IA Autônoma</p>
        </div>
        {/* Toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'relative flex h-5 w-9 items-center rounded-full transition-colors',
            enabled ? 'bg-emerald-500' : 'bg-zinc-700',
          )}
        >
          <span
            className={cn(
              'absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-all',
              enabled ? 'left-[18px]' : 'left-[3px]',
            )}
          />
        </button>
      </div>

      <p className="mb-3 text-[11px] text-zinc-500">
        {enabled
          ? 'Sua IA pode agir automaticamente'
          : 'Ative para ações automáticas'}
      </p>

      {enabled && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider mb-2">Executando agora:</p>
          {AUTONOMOUS_TASKS.map(t => (
            <div key={t.label} className="flex items-center gap-2">
              <motion.span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: t.color }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 2 }}
              />
              <span className="text-[11px] text-zinc-400">{t.label}</span>
            </div>
          ))}
        </div>
      )}

      {!enabled && (
        <div className="grid grid-cols-2 gap-1.5">
          {['Cobranças', 'E-mails', 'Campanhas', 'Relatórios', 'Follow-ups', 'E muito mais'].map(f => (
            <div key={f} className="flex items-center gap-1.5 opacity-40">
              <CheckCircle2 size={10} className="text-zinc-600" />
              <span className="text-[10px] text-zinc-600">{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Right Panel ───────────────────────────────────────────────

function RightPanel({
  diagnostico,
  alertas,
  autonomousEnabled,
  onToggleAutonomous,
}: {
  diagnostico: Diagnostico | null
  alertas: Alerta[]
  autonomousEnabled: boolean
  onToggleAutonomous: () => void
}) {
  return (
    <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-zinc-800/60 p-4">
      <DaySummary diagnostico={diagnostico} />
      <IntelligentAlerts alertas={alertas} />
      <QuickAccess />
      <AutonomousPanel enabled={autonomousEnabled} onToggle={onToggleAutonomous} />
    </aside>
  )
}

// ─── Proactive AI message builder ─────────────────────────────

function buildProactiveMessage(
  session: SessionData,
  diagnostico: Diagnostico | null,
  aiName: string,
): AIChatMessage {
  const perda = diagnostico?.perdaTotalEstimada ?? 0
  const ganho = diagnostico?.ganhoTotalEstimado ?? 0

  let content: string
  let actionCards: AIChatMessage['actionCards'] = []

  if (perda > 5000) {
    content = `Detectei que ${session.nomeEmpresa ?? 'sua empresa'} está com R$ ${Math.round(perda).toLocaleString('pt-BR')} em perdas estimadas. Posso iniciar a cobrança automática ou você deseja analisar primeiro?`
    actionCards = [
      { label: 'Iniciar cobrança automática', href: '/dashboard/financeiro?filter=inadimplentes', color: '#ef4444' },
      { label: 'Ver clientes inadimplentes', href: '/dashboard/financeiro?filter=inadimplentes', color: '#f59e0b' },
      { label: 'Analisar mais', href: '/dashboard/revenue', color: '#8b5cf6' },
    ]
  } else if (ganho > 0) {
    content = `Identifiquei R$ ${Math.round(ganho).toLocaleString('pt-BR')} em oportunidades de crescimento para ${session.nomeEmpresa ?? 'sua empresa'}. Quer que eu analise as melhores ações?`
    actionCards = [
      { label: 'Ver oportunidades', href: '/dashboard/growth-map', color: '#10b981' },
      { label: 'Analisar vendas', href: '/dashboard/sales', color: '#f59e0b' },
    ]
  } else {
    content = `Olá! Sou ${aiName}, seu COO inteligente. Estou monitorando sua operação. Pergunte-me qualquer coisa ou escolha uma das ações abaixo.`
    actionCards = [
      { label: 'Ver relatório financeiro', href: '/dashboard/revenue', color: '#8b5cf6' },
      { label: 'Analisar leads', href: '/dashboard/leads', color: '#06b6d4' },
    ]
  }

  return {
    id:          'proactive-0',
    role:        'ai',
    content,
    actionCards,
    timestamp:   new Date(),
  }
}

// ─── Main page ────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()

  const [session, setSession]       = useState<SessionData>({})
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null)
  const [alertas, setAlertas]         = useState<Alerta[]>([])
  const [insights, setInsights]       = useState<InsightAcao[]>([])
  const [loading, setLoading]         = useState(true)
  const [messages, setMessages]       = useState<AIChatMessage[]>([])
  const [sending, setSending]         = useState(false)
  const [autonomous, setAutonomous]   = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [aiName, setAiName]           = useState('NEXUS IA')

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        // Session + company profile
        const profileRes = await fetch('/api/settings/profile').then(r => r.json())
        const company = profileRes.data ?? {}
        const sess: SessionData = {
          nomeEmpresa: company.brand_name || company.name,
          perfil:      company.sector,
          setor:       company.sector,
          company_id:  company.id,
          companyId:   company.id,
        }
        setSession(sess)
        if (company.ai_name) setAiName(company.ai_name)

        // Diagnostico + insights + alertas (existing lib)
        const diag = gerarDiagnostico({
          perfil:           (company.sector as 'servicos') ?? null,
          nomeEmpresa:      sess.nomeEmpresa,
          setor:            company.sector,
          principalDesafio: company.description,
        })
        setDiagnostico(diag)

        const ins  = gerarInsights(sess as Parameters<typeof gerarInsights>[0])
        setInsights(ins)

        const al   = gerarAlertas(sess as Parameters<typeof gerarAlertas>[0])
        setAlertas(al)

        // Build initial proactive AI message
        const proactive = buildProactiveMessage(sess, diag, company.ai_name ?? 'NEXUS IA')
        setMessages([proactive])
      } catch (err) {
        console.error('Dashboard load error:', err)
        // Still show with defaults
        const proactive = buildProactiveMessage({}, null, 'NEXUS IA')
        setMessages([proactive])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // ── Send message to AI ─────────────────────────────────────
  const sendMessage = useCallback(async (text: string, attachments: UploadedAttachment[] = []) => {
    if (sending) return

    const displayContent = text || (attachments.length
      ? `[${attachments.map(a => a.name).join(', ')}]`
      : '')
    if (!displayContent) return

    const userMsg: AIChatMessage = {
      id:          `user-${Date.now()}`,
      role:        'user',
      content:     displayContent,
      attachments: attachments.length ? attachments : undefined,
      timestamp:   new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setSending(true)

    // Skip intent routing when files are attached — go straight to full AI
    if (!attachments.length) {
      try {
        const routeRes = await fetch('/api/ai/router', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ query: text }),
        })
        const routeData = await routeRes.json() as { route?: string; label?: string; actionHint?: string; confidence?: number }

        if (routeData.confidence && routeData.confidence >= 0.7 && routeData.route && routeData.route !== '/dashboard') {
          const aiResp: AIChatMessage = {
            id:          `ai-route-${Date.now()}`,
            role:        'ai',
            content:     `Entendido! Abrindo **${routeData.label}** para você${routeData.actionHint ? ` — ${routeData.actionHint}` : ''}.`,
            actionCards: [{ label: `Ir para ${routeData.label}`, href: routeData.route, color: '#6366f1' }],
            timestamp:   new Date(),
          }
          setMessages(prev => [...prev, aiResp])
          setSending(false)
          setTimeout(() => router.push(routeData.route!), 900)
          return
        }
      } catch { /* fall through to full AI */ }
    }

    // Full AI chat (streaming SSE)
    try {
      // Build effective message for the AI when file-only (no text)
      const aiMessage = text || (attachments.length
        ? `Analise ${attachments.length === 1 ? 'este arquivo' : 'estes arquivos'}: ${attachments.map(a => a.name).join(', ')}`
        : '')

      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:         aiMessage,
          conversation_id: conversationId,
          attachments:     attachments.map(a => ({
            id:             a.id,
            name:           a.name,
            mime:           a.mime,
            type_category:  a.type_category,
            extracted_text: a.extracted_text,
            ai_summary:     a.ai_summary,
          })),
        }),
      })

      if (!res.ok || !res.body) throw new Error('AI unavailable')

      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let   buffer = ''
      let   aiText = ''
      const aiId   = `ai-${Date.now()}`

      setMessages(prev => [...prev, { id: aiId, role: 'ai', content: '', timestamp: new Date() }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += dec.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const payload = JSON.parse(line.slice(6)) as { token?: string; done?: boolean; conversation_id?: string; action_cards?: AIChatMessage['actionCards'] }
            if (payload.conversation_id) setConversationId(payload.conversation_id)
            if (payload.token) {
              aiText += payload.token
              setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: aiText } : m))
            }
            if (payload.done) {
              if (payload.action_cards) {
                setMessages(prev => prev.map(m => m.id === aiId ? { ...m, actionCards: payload.action_cards } : m))
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id:        `ai-err-${Date.now()}`,
        role:      'ai',
        content:   'Desculpe, tive um problema ao processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
      }])
    } finally {
      setSending(false)
    }
  }, [sending, conversationId, router])

  // ── Executive metrics ──────────────────────────────────────
  const execMetrics: ExecMetric[] = diagnostico ? [
    {
      label:   'Dinheiro Perdido',
      value:   diagnostico.perdaTotalEstimada,
      color:   '#ef4444',
      trend:   'down',
      desc:    'Em atrasos',
    },
    {
      label:   'Dinheiro Recuperável',
      value:   Math.round(diagnostico.ganhoTotalEstimado * 1.35),
      color:   '#10b981',
      trend:   'up',
      desc:    'Com ações da IA',
    },
    {
      label:   'Oportunidades',
      value:   Math.round(diagnostico.ganhoTotalEstimado * 2.1),
      color:   '#06b6d4',
      trend:   'up',
      desc:    'Em potencial',
    },
    {
      label:   'Ações Urgentes',
      value:   diagnostico.problemas.filter(p => p.impacto === 'alto').length || 7,
      suffix:  '',
      color:   '#f59e0b',
      trend:   'neutral',
      desc:    'Precisam atenção',
    },
    {
      label:   'Oport. Identificadas',
      value:   diagnostico.oportunidades.length || 12,
      suffix:  '',
      color:   '#8b5cf6',
      trend:   'up',
      desc:    'Prontas para explorar',
    },
  ] : []

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10">
                <Bot size={28} className="text-violet-400" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-2xl border border-violet-500/40"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">NEXUS IA inicializando</p>
              <p className="mt-1 text-xs text-zinc-500">Analisando dados do seu negócio…</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Pipeline header */}
      <PipelineHeader companyName={session.nomeEmpresa ?? 'sua empresa'} />

      {/* Body: center + right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Center ── */}
        <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 pb-6">
          {/* 1. AI Cockpit */}
          <AICockpit
            session={session}
            diagnostico={diagnostico}
            aiName={aiName}
            messages={messages}
            onSendMessage={sendMessage}
            sending={sending}
          />

          {/* 6. Executive Vision */}
          {execMetrics.length > 0 && <ExecutiveVision metrics={execMetrics} />}

          {/* 3. Smart Action Cards */}
          <SmartActionCards />

          {/* 7. Multimodal bottom input */}
          <MultimodalInputBar onSend={sendMessage} sending={sending} />
        </main>

        {/* ── Right panel ── */}
        <RightPanel
          diagnostico={diagnostico}
          alertas={alertas}
          autonomousEnabled={autonomous}
          onToggleAutonomous={() => setAutonomous(p => !p)}
        />
      </div>
    </div>
  )
}
