'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot, Send, Zap, CheckCircle2, FolderKanban,
  Users, DollarSign, BarChart3, ArrowRight,
  Sparkles, RefreshCw, AlertCircle, Terminal,
  ChevronRight, Clock, Command,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionExecuted {
  tool:   string
  result: Record<string, unknown>
}

interface Message {
  id:       string
  role:     'user' | 'assistant'
  content:  string
  actions?: ActionExecuted[]
  navigate?: string | null
  error?:   boolean
  ts:       number
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: 'Visão geral do negócio',     command: 'Dê uma visão geral do meu negócio hoje',           icon: BarChart3 },
  { label: 'Leads quentes',              command: 'Quais são meus leads mais quentes agora?',           icon: Users },
  { label: 'Criar projeto',             command: 'Crie um projeto de lançamento chamado "Produto X"',  icon: FolderKanban },
  { label: 'Resumo financeiro',          command: 'Mostre o resumo financeiro da empresa',             icon: DollarSign },
  { label: 'Atividade recente',          command: 'Mostre as últimas ações da equipe',                icon: Zap },
  { label: 'Adicionar lead',            command: 'Crie um lead chamado João Silva da empresa ABC',    icon: Users },
]

// ─── Tool label map ───────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  get_business_overview: { label: 'Visão Geral',     icon: BarChart3,    color: 'text-violet-400' },
  get_leads:             { label: 'Leads',           icon: Users,        color: 'text-blue-400'   },
  create_lead:           { label: 'Lead Criado',     icon: Users,        color: 'text-emerald-400'},
  get_projects:          { label: 'Projetos',        icon: FolderKanban, color: 'text-orange-400' },
  create_project:        { label: 'Projeto Criado',  icon: FolderKanban, color: 'text-emerald-400'},
  create_task:           { label: 'Tarefa Criada',   icon: CheckCircle2, color: 'text-emerald-400'},
  get_financial_summary: { label: 'Financeiro',      icon: DollarSign,   color: 'text-amber-400'  },
  get_recent_activity:   { label: 'Atividade',       icon: Zap,          color: 'text-zinc-400'   },
  navigate_to:           { label: 'Navegando',       icon: ArrowRight,   color: 'text-violet-400' },
}

// ─── Action chip ──────────────────────────────────────────────────────────────

function ActionChip({ action }: { action: ActionExecuted }) {
  const meta = TOOL_META[action.tool] ?? { label: action.tool, icon: Zap, color: 'text-zinc-400' }
  const Icon  = meta.icon
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] bg-zinc-800/80 border border-zinc-700/60 rounded-full px-2.5 py-1 font-medium">
      <Icon className={cn('w-3 h-3 shrink-0', meta.color)} />
      <span className="text-zinc-300">{meta.label}</span>
      <span className="w-1 h-1 rounded-full bg-emerald-400" />
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onNavigate }: { msg: Message; onNavigate: (path: string) => void }) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-violet-400" />
        </div>
      )}

      <div className={cn('max-w-[80%] space-y-2', isUser && 'items-end flex flex-col')}>
        {/* Bubble */}
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-violet-600/20 border border-violet-500/20 text-violet-100 rounded-tr-sm'
            : msg.error
              ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm'
              : 'bg-zinc-900 border border-zinc-800/80 text-zinc-200 rounded-tl-sm',
        )}>
          {msg.error && (
            <div className="flex items-center gap-1.5 mb-1 text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-medium">Erro</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>

        {/* Actions executed */}
        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.actions.map((a, i) => (
              <ActionChip key={i} action={a} />
            ))}
          </div>
        )}

        {/* Navigate button */}
        {msg.navigate && (
          <button
            onClick={() => onNavigate(msg.navigate!)}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-600/10 border border-violet-500/20 rounded-full px-3 py-1.5 transition-all hover:bg-violet-600/20"
          >
            <ArrowRight className="w-3 h-3" />
            Abrir página
            <ChevronRight className="w-3 h-3" />
          </button>
        )}

        {/* Timestamp */}
        <p className="text-[10px] text-zinc-700 px-1">
          {new Date(msg.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-zinc-400">
          EU
        </div>
      )}
    </motion.div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-violet-400" />
      </div>
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
          <span className="text-xs text-zinc-500 italic">Nexus Engine processando…</span>
          <span className="flex gap-0.5 ml-1">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                className="w-1 h-1 rounded-full bg-violet-400"
              />
            ))}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onSuggest }: { onSuggest: (cmd: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-4">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center mx-auto">
          <Terminal className="w-8 h-8 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">NEXUS Engine</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-xs">
            Execute ações reais com linguagem natural. Crie leads, projetos, tarefas — tudo sem sair desta tela.
          </p>
        </div>
        <div className="flex items-center gap-2 justify-center text-xs text-zinc-600">
          <Command className="w-3 h-3" />
          <span>Pressione Enter para enviar</span>
        </div>
      </div>

      <div className="w-full max-w-lg">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3 text-center">
          Comandos rápidos
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SUGGESTIONS.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.label}
                onClick={() => onSuggest(s.command)}
                className="flex items-center gap-2.5 text-left bg-zinc-900 border border-zinc-800/60 hover:border-violet-500/30 hover:bg-violet-600/5 rounded-xl px-3.5 py-3 text-xs text-zinc-400 hover:text-zinc-200 transition-all group"
              >
                <Icon className="w-3.5 h-3.5 text-zinc-600 group-hover:text-violet-400 transition-colors shrink-0" />
                <span className="leading-snug">{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NexusEnginePage() {
  const router = useRouter()
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // History for the engine (last 6 turns)
  const history = useRef<Array<{ role: string; content: string }>>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id:      crypto.randomUUID(),
      role:    'user',
      content: trimmed,
      ts:      Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Update history
    history.current.push({ role: 'user', content: trimmed })

    try {
      const res = await fetch('/api/nexus/engine', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message: trimmed,
          history: history.current.slice(-6),
        }),
      })

      const data = await res.json() as {
        message?:          string
        actions_executed?: ActionExecuted[]
        navigate_to?:      string | null
        error?:            string
      }

      if (!res.ok || data.error) {
        const errMsg: Message = {
          id:      crypto.randomUUID(),
          role:    'assistant',
          content: data.error ?? 'Ocorreu um erro. Tente novamente.',
          error:   true,
          ts:      Date.now(),
        }
        setMessages(prev => [...prev, errMsg])
        return
      }

      const assistantMsg: Message = {
        id:       crypto.randomUUID(),
        role:     'assistant',
        content:  data.message ?? 'Ação executada.',
        actions:  data.actions_executed ?? [],
        navigate: data.navigate_to ?? null,
        ts:       Date.now(),
      }

      setMessages(prev => [...prev, assistantMsg])

      // Update history with assistant reply
      history.current.push({ role: 'assistant', content: data.message ?? '' })

      // Auto-navigate after a short delay if requested
      if (data.navigate_to) {
        setTimeout(() => router.push(data.navigate_to!), 1500)
      }
    } catch {
      const errMsg: Message = {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: 'Falha de conexão. Verifique sua rede e tente novamente.',
        error:   true,
        ts:      Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [loading, router])

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  function handleNavigate(path: string) {
    router.push(path)
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800/60 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-violet-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-zinc-950" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">NEXUS Engine</h1>
            <p className="text-[10px] text-zinc-500">Comando central · Execução com IA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); history.current = [] }}
              className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700"
            >
              <RefreshCw className="w-3 h-3" />
              Limpar
            </button>
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onSuggest={(cmd) => { setInput(cmd); inputRef.current?.focus() }} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onNavigate={handleNavigate} />
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {loading && <TypingIndicator />}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Quick suggestions (visible when there are messages) */}
      {!isEmpty && !loading && (
        <div className="shrink-0 border-t border-zinc-800/40 px-4 sm:px-6 py-2">
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.slice(0, 4).map(s => (
              <button
                key={s.label}
                onClick={() => send(s.command)}
                className="shrink-0 flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800/60 hover:border-zinc-700 rounded-full px-3 py-1.5 transition-all whitespace-nowrap"
              >
                <s.icon className="w-3 h-3" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800/60 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className={cn(
            'flex items-end gap-3 bg-zinc-900 border rounded-2xl px-4 py-3 transition-all',
            loading ? 'border-zinc-800/40 opacity-70' : 'border-zinc-700/60 focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/20',
          )}>
            <Bot className="w-4 h-4 text-zinc-600 shrink-0 mb-1" />
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              placeholder="Digite um comando em português natural… Ex: 'Crie um projeto de marketing'"
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none leading-relaxed max-h-32 scrollbar-none"
              style={{ scrollbarWidth: 'none' }}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className={cn(
                'shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                loading || !input.trim()
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-500 text-white hover:scale-105 shadow-lg shadow-violet-900/30',
              )}
            >
              {loading
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />
              }
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-[10px] text-zinc-700">
              <Clock className="w-2.5 h-2.5 inline mr-1" />
              Ações são executadas em tempo real no banco de dados
            </p>
            <p className="text-[10px] text-zinc-700">↵ Enter para enviar · Shift+↵ nova linha</p>
          </div>
        </div>
      </div>
    </div>
  )
}
