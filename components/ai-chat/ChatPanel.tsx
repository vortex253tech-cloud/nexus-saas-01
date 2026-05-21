'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, Loader2, Sparkles, X, Plus,
  User, Zap, TrendingUp, Users, DollarSign,
  ArrowRight, ChevronRight, Crown, Megaphone,
  FolderKanban, Headphones, PenLine, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ──────────────────────────────────────────────────────

interface AgentAction {
  tool:    string
  summary: string
}

interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  actions?:  string[]
  navigateTo?: string
  timestamp: number
}

// ─── Agent meta for message display ─────────────────────────────

const AGENT_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  ceo:       { icon: Crown,        color: '#7c3aed', label: 'CEO' },
  sales:     { icon: TrendingUp,   color: '#059669', label: 'Sales' },
  marketing: { icon: Megaphone,    color: '#f59e0b', label: 'Marketing' },
  finance:   { icon: DollarSign,   color: '#dc2626', label: 'Finance' },
  projects:  { icon: FolderKanban, color: '#0891b2', label: 'Projects' },
  support:   { icon: Headphones,   color: '#8b5cf6', label: 'Support' },
  content:   { icon: PenLine,      color: '#ec4899', label: 'Content' },
  analytics: { icon: BarChart3,    color: '#16a34a', label: 'Analytics' },
}

function detectAgent(text: string): string | null {
  const lower = text.toLowerCase()
  if (lower.includes('ceo agent') || lower.includes('[ceo]')) return 'ceo'
  if (lower.includes('sales agent') || lower.includes('[sales]')) return 'sales'
  if (lower.includes('finance agent') || lower.includes('[finance]')) return 'finance'
  if (lower.includes('marketing agent') || lower.includes('[marketing]')) return 'marketing'
  if (lower.includes('projects agent') || lower.includes('[projects]')) return 'projects'
  if (lower.includes('support agent') || lower.includes('[support]')) return 'support'
  if (lower.includes('content agent') || lower.includes('[content]')) return 'content'
  if (lower.includes('analytics agent') || lower.includes('[analytics]')) return 'analytics'
  return null
}

// ─── Quick actions ───────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Sparkles,    text: 'Resumo executivo do dia' },
  { icon: TrendingUp,  text: 'Leads quentes agora' },
  { icon: DollarSign,  text: 'Status financeiro' },
  { icon: FolderKanban, text: 'Projetos em atraso' },
  { icon: Users,       text: 'Equipe e tarefas' },
  { icon: Zap,         text: 'O que precisa de atenção?' },
]

// ─── Markdown renderer ────────────────────────────────────────────

function inlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic text-zinc-200">{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="rounded bg-zinc-700/60 px-1 py-0.5 font-mono text-[10px] text-violet-300">{part.slice(1, -1)}</code>
    return part
  })
}

function RenderMarkdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/)
  return (
    <div className="space-y-1.5">
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n').filter(Boolean)
        if (!lines.length) return null

        if (lines.every(l => /^[•\-\*] /.test(l.trim()))) {
          return (
            <ul key={pi} className="space-y-0.5 pl-1">
              {lines.map((item, ii) => (
                <li key={ii} className="flex items-start gap-1.5 text-xs leading-relaxed">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                  <span>{inlineMarkdown(item.replace(/^[•\-\*]\s/, ''))}</span>
                </li>
              ))}
            </ul>
          )
        }

        if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
          return (
            <p key={pi} className="text-xs font-bold text-white">
              {inlineMarkdown(lines[0].replace(/^#{1,3} /, ''))}
            </p>
          )
        }

        return (
          <p key={pi} className="text-xs leading-relaxed text-zinc-200">
            {lines.map((line, li) => (
              <span key={li}>
                {inlineMarkdown(line)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

// ─── Typing indicator ────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-end gap-2"
    >
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/20 ring-1 ring-violet-500/30"
        style={{ boxShadow: '0 0 8px rgba(124,58,237,0.4)' }}
      >
        <Bot size={11} className="text-violet-300" />
      </div>
      <div className="rounded-xl rounded-bl-sm border border-zinc-700/40 bg-zinc-800/70 px-3 py-2.5">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="h-1 w-1 rounded-full bg-violet-400"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
              transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────

function MessageBubble({ msg, isLast }: { msg: Message; isLast: boolean }) {
  const isUser   = msg.role === 'user'
  const time     = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const agentId  = !isUser ? detectAgent(msg.content) : null
  const agentMeta = agentId ? AGENT_ICONS[agentId] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={cn('group flex items-end gap-1.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div
          className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1"
          style={{
            background: agentMeta ? `${agentMeta.color}22` : 'rgba(124,58,237,0.2)',
            borderColor: agentMeta ? `${agentMeta.color}44` : 'rgba(124,58,237,0.3)',
            boxShadow: `0 0 8px ${agentMeta?.color ?? '#7c3aed'}44`,
          }}
        >
          {agentMeta
            ? <agentMeta.icon size={11} style={{ color: agentMeta.color }} />
            : <Bot size={11} className="text-violet-300" />
          }
        </div>
      )}

      <div className={cn('max-w-[85%]', isUser && 'flex flex-col items-end')}>
        {/* Agent label */}
        {!isUser && agentMeta && (
          <p className="mb-0.5 ml-0.5 text-[9px] font-semibold uppercase tracking-wider" style={{ color: agentMeta.color }}>
            {agentMeta.label} Agent
          </p>
        )}

        <div className={cn(
          'rounded-2xl px-3 py-2',
          isUser
            ? 'bg-violet-600 text-white rounded-br-sm shadow-lg shadow-violet-900/30'
            : 'bg-zinc-800/70 text-zinc-200 border border-zinc-700/40 rounded-bl-sm',
        )}>
          {isUser
            ? <p className="text-xs leading-relaxed">{msg.content}</p>
            : <RenderMarkdown text={msg.content} />
          }
        </div>

        {/* Actions taken */}
        {!isUser && msg.actions && msg.actions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-1.5 flex flex-wrap gap-1"
          >
            {msg.actions.map((action, i) => (
              <span
                key={i}
                className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400"
              >
                ✓ {action}
              </span>
            ))}
          </motion.div>
        )}

        {/* Navigation card */}
        {!isUser && msg.navigateTo && (
          <motion.a
            href={msg.navigateTo}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-medium text-violet-300 transition hover:bg-violet-500/20"
          >
            <ArrowRight size={10} />
            Abrir no painel
            <ChevronRight size={9} className="ml-auto" />
          </motion.a>
        )}

        <span className={cn(
          'mt-0.5 px-1 text-[9px] text-zinc-600 transition-opacity',
          isLast ? 'opacity-60' : 'opacity-0 group-hover:opacity-100',
          isUser ? 'text-right' : 'text-left',
        )}>
          {time}
        </span>
      </div>

      {isUser && (
        <div className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600">
          <User size={10} className="text-white" />
        </div>
      )}
    </motion.div>
  )
}

// ─── Welcome screen ───────────────────────────────────────────────

function WelcomeScreen({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-start overflow-y-auto px-3 py-5">
      {/* Hero */}
      <div className="mb-5 text-center">
        <div
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 ring-2 ring-violet-500/30"
          style={{ boxShadow: '0 0 32px rgba(124,58,237,0.5)' }}
        >
          <Sparkles size={26} className="text-violet-300" />
        </div>
        <p className="text-sm font-bold text-white">NEXUS Copilot</p>
        <p className="mt-0.5 text-[10px] text-zinc-500">8 agentes especializados · execução real</p>
      </div>

      {/* Agent pills */}
      <div className="mb-5 flex flex-wrap justify-center gap-1.5">
        {Object.entries(AGENT_ICONS).map(([id, meta]) => {
          const Icon = meta.icon
          return (
            <div
              key={id}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
              style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}33` }}
            >
              <Icon size={8} />
              {meta.label}
            </div>
          )
        })}
      </div>

      {/* Quick action chips */}
      <div className="w-full space-y-1.5">
        <p className="mb-2 text-center text-[9px] font-semibold uppercase tracking-widest text-zinc-600">Comandos rápidos</p>
        {QUICK_ACTIONS.map(({ icon: Icon, text }) => (
          <button
            key={text}
            onClick={() => onSend(text)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 text-left text-xs text-zinc-300 transition hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-white"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-600/15">
              <Icon size={11} className="text-violet-400" />
            </div>
            {text}
            <ChevronRight size={11} className="ml-auto text-zinc-600" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Chat view ────────────────────────────────────────────────────

function ChatView({
  messages,
  loading,
  input,
  onInput,
  onSend,
}: {
  messages: Message[]
  loading:  boolean
  input:    string
  onInput:  (v: string) => void
  onSend:   (text?: string) => void
}) {
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'
  }, [input])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id} msg={msg} isLast={i === messages.length - 1} />
          ))}
          <AnimatePresence>
            {loading && <TypingIndicator />}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Quick actions row */}
      <div className="shrink-0 flex gap-1.5 overflow-x-auto px-3 pb-2 pt-1 [&::-webkit-scrollbar]:hidden">
        {QUICK_ACTIONS.slice(0, 4).map(({ icon: Icon, text }) => (
          <button
            key={text}
            onClick={() => onSend(text)}
            disabled={loading}
            className="flex shrink-0 items-center gap-1 rounded-full border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-1 text-[10px] text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 disabled:pointer-events-none disabled:opacity-40"
          >
            <Icon size={9} />
            {text.length > 18 ? text.slice(0, 18) + '…' : text}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800/60 p-3">
        <div className={cn(
          'flex items-end gap-2 rounded-xl border bg-zinc-900/80 px-3 py-2 transition-colors',
          'border-zinc-700/60 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20',
        )}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => onInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!loading && input.trim()) onSend()
              }
            }}
            disabled={loading}
            placeholder="Fale com o NEXUS Copilot..."
            className="max-h-24 flex-1 resize-none bg-transparent text-xs text-white placeholder-zinc-600 outline-none disabled:cursor-not-allowed leading-relaxed"
          />
          <button
            onClick={() => onSend()}
            disabled={loading || !input.trim()}
            className={cn(
              'mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all',
              input.trim() && !loading
                ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-md shadow-violet-900/40 active:scale-95'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
            )}
          >
            {loading
              ? <Loader2 size={12} className="animate-spin text-violet-400" />
              : <Send size={12} />
            }
          </button>
        </div>
        <p className="mt-1.5 text-center text-[9px] text-zinc-700">Enter para enviar · os agentes executam ações reais</p>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading,  setLoading]  = useState(false)
  const [input,    setInput]    = useState('')

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = {
      id:        Math.random().toString(36).slice(2),
      role:      'user',
      content:   msg,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/agents/orchestrate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg }),
      })

      const data = await res.json() as {
        message?:    string
        error?:      string
        actions?:    string[]
        navigateTo?: string
      }

      const aiMsg: Message = {
        id:          Math.random().toString(36).slice(2),
        role:        'assistant',
        content:     data.message?.trim() || data.error || 'Não consegui gerar uma resposta. Tente novamente.',
        actions:     data.actions?.filter(Boolean),
        navigateTo:  data.navigateTo,
        timestamp:   Date.now(),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setMessages(prev => [...prev, {
        id:        Math.random().toString(36).slice(2),
        role:      'assistant',
        content:   'Erro de conexão. Verifique sua internet e tente novamente.',
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading])

  const showChat = messages.length > 0 || input.length > 0

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] lg:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="chat-panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[360px] max-w-[92vw] flex-col border-l border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/60"
            style={{ background: 'linear-gradient(180deg, #0c0c14 0%, #09090f 100%)' }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-4 py-3.5"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, transparent 100%)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 ring-1 ring-violet-500/40"
                  style={{ boxShadow: '0 0 20px rgba(124,58,237,0.6)' }}
                >
                  <Sparkles size={18} className="text-violet-300" />
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-1 ring-zinc-950" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">NEXUS Copilot</p>
                  <p className="text-[10px] text-zinc-500">8 agentes · execução real</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {showChat && (
                  <button
                    onClick={() => { setMessages([]); setInput('') }}
                    title="Nova conversa"
                    className="flex items-center gap-1 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-2 py-1.5 text-[10px] text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300"
                  >
                    <Plus size={10} />
                    Nova
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Body */}
            {showChat ? (
              <ChatView
                messages={messages}
                loading={loading}
                input={input}
                onInput={setInput}
                onSend={sendMessage}
              />
            ) : (
              <WelcomeScreen onSend={sendMessage} />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
