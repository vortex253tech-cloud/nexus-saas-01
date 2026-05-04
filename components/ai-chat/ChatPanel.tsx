'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, Loader2, Sparkles, X, Plus, MessageSquare,
  User, Zap, TrendingUp, Users, AlertCircle, DollarSign,
  Package, ArrowRight, ChevronRight, Clock,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── Types ────────────────────────────────────────────────────

interface ActionCard {
  type:   string
  title:  string
  value?: number
  button: string
  href?:  string
}

interface Message {
  id:          string
  role:        'user' | 'assistant'
  content:     string
  action_card?: ActionCard | null
  timestamp:   number
}

interface Conversation {
  id:          string
  title:       string
  updated_at:  string
  last_message: { role: string; content: string } | null
}

// ─── Suggestions ─────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: Users,       text: 'Quem me deve dinheiro?' },
  { icon: AlertCircle, text: 'Clientes em atraso?' },
  { icon: DollarSign,  text: 'Total a receber' },
  { icon: TrendingUp,  text: 'Como aumentar faturamento?' },
  { icon: Package,     text: 'Otimizar fornecedores' },
  { icon: Zap,         text: 'Recuperar inadimplentes' },
]

// ─── Markdown renderer ────────────────────────────────────────

function inlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic text-zinc-200">{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="rounded bg-zinc-700 px-1 py-0.5 font-mono text-[10px] text-violet-300">{part.slice(1, -1)}</code>
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

// ─── Action Card ──────────────────────────────────────────────

function ActionCardWidget({ card }: { card: ActionCard }) {
  const fmt = (n: number) =>
    `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15, duration: 0.25 }}
      className="mt-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3"
      style={{ boxShadow: '0 0 20px rgba(124,58,237,0.15)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-violet-300 leading-tight">{card.title}</p>
          {card.value != null && (
            <p
              className="mt-0.5 text-sm font-bold text-white"
              style={{ textShadow: '0 0 12px rgba(124,58,237,0.6)' }}
            >
              {fmt(card.value)}
            </p>
          )}
        </div>
        {card.href ? (
          <a
            href={card.href}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-violet-500 active:scale-95"
          >
            {card.button}
            <ArrowRight size={9} />
          </a>
        ) : (
          <button
            className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-violet-500 active:scale-95"
          >
            {card.button}
            <ArrowRight size={9} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-end gap-2"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/20 ring-1 ring-violet-500/20">
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

// ─── Message bubble ───────────────────────────────────────────

function MessageBubble({ msg, isLast }: { msg: Message; isLast: boolean }) {
  const isUser = msg.role === 'user'
  const time   = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={cn('group flex items-end gap-1.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/20 ring-1 ring-violet-500/20">
          <Bot size={11} className="text-violet-300" />
        </div>
      )}

      <div className={cn('max-w-[85%]', isUser && 'flex flex-col items-end')}>
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

        {!isUser && msg.action_card && (
          <div className="w-full">
            <ActionCardWidget card={msg.action_card} />
          </div>
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

// ─── Conversations list ───────────────────────────────────────

function ConversationList({
  conversations,
  loading,
  onSelect,
  onNew,
}: {
  conversations: Conversation[]
  loading: boolean
  onSelect: (id: string, title: string) => void
  onNew: () => void
}) {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffH = (now.getTime() - d.getTime()) / 3600000
    if (diffH < 24) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Welcome */}
      <div className="px-4 py-5 text-center">
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/20 ring-2 ring-violet-500/30"
          style={{ boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}
        >
          <Sparkles size={22} className="text-violet-400" />
        </div>
        <p className="text-sm font-bold text-white">Como posso ajudar?</p>
        <p className="mt-1 text-[11px] text-zinc-500">Análise financeira em tempo real</p>
      </div>

      {/* Suggestion chips */}
      <div className="px-3 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(({ icon: Icon, text }) => (
            <button
              key={text}
              onClick={() => onSelect('__new__', text)}
              className="flex items-center gap-1 rounded-full border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-1 text-[10px] text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300"
            >
              <Icon size={9} />
              {text}
            </button>
          ))}
        </div>
      </div>

      {/* Recent conversations */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={16} className="animate-spin text-violet-400" />
        </div>
      ) : conversations.length > 0 ? (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Conversas recentes</p>
          <ul className="space-y-1.5">
            {conversations.map(conv => (
              <li key={conv.id}>
                <button
                  onClick={() => onSelect(conv.id, conv.title)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/60"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                    <MessageSquare size={12} className="text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-200">{conv.title}</p>
                    {conv.last_message && (
                      <p className="truncate text-[10px] text-zinc-500 mt-0.5">
                        {conv.last_message.content.slice(0, 50)}
                        {conv.last_message.content.length > 50 && '…'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[9px] text-zinc-600">{fmt(conv.updated_at)}</span>
                    <ChevronRight size={10} className="text-zinc-600" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Clock size={18} className="text-zinc-700" />
          <p className="text-xs text-zinc-600">Nenhuma conversa ainda</p>
          <button
            onClick={onNew}
            className="mt-1 flex items-center gap-1.5 rounded-full bg-violet-600/20 px-3 py-1.5 text-[11px] text-violet-300 transition hover:bg-violet-600/30"
          >
            <Plus size={11} />
            Iniciar conversa
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Chat view ────────────────────────────────────────────────

function ChatView({
  messages,
  loading,
  input,
  onInput,
  onSend,
  onSuggestion,
}: {
  messages:     Message[]
  loading:      boolean
  input:        string
  onInput:      (v: string) => void
  onSend:       () => void
  onSuggestion: (text: string) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
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

  const showSuggestions = messages.length === 0 && !loading

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-4 text-center"
            >
              <div
                className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 ring-1 ring-violet-500/30"
                style={{ boxShadow: '0 0 16px rgba(124,58,237,0.3)' }}
              >
                <Bot size={18} className="text-violet-300" />
              </div>
              <p className="text-xs text-zinc-400">Como posso ajudar?</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {SUGGESTIONS.slice(0, 4).map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    onClick={() => onSuggestion(text)}
                    className="flex items-center gap-1 rounded-full border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-1 text-[10px] text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300"
                  >
                    <Icon size={9} />
                    {text}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={msg.id} msg={msg} isLast={i === messages.length - 1} />
          ))}

          <AnimatePresence>
            {loading && <TypingIndicator />}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
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
            placeholder="Pergunte sobre seus dados..."
            className="max-h-24 flex-1 resize-none bg-transparent text-xs text-white placeholder-zinc-600 outline-none disabled:cursor-not-allowed leading-relaxed"
          />
          <button
            onClick={onSend}
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
        <p className="mt-1.5 text-center text-[9px] text-zinc-700">Enter para enviar</p>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [companyId,      setCompanyId]      = useState<string | null>(null)
  const [conversations,  setConversations]  = useState<Conversation[]>([])
  const [convLoading,    setConvLoading]    = useState(false)
  const [activeConvId,   setActiveConvId]   = useState<string | null>(null)
  const [activeTitle,    setActiveTitle]    = useState<string>('Nova conversa')
  const [messages,       setMessages]       = useState<Message[]>([])
  const [loading,        setLoading]        = useState(false)
  const [input,          setInput]          = useState('')

  // Resolve company on open
  useEffect(() => {
    if (!open || companyId) return
    resolveCompanyId().then(cid => setCompanyId(cid))
  }, [open, companyId])

  // Load conversations list when panel opens and no active conversation
  const loadConversations = useCallback(() => {
    setConvLoading(true)
    fetch('/api/ai/conversations')
      .then(r => r.ok ? r.json() : { data: [] })
      .then((j: { data?: Conversation[] }) => setConversations(j.data ?? []))
      .catch(() => setConversations([]))
      .finally(() => setConvLoading(false))
  }, [])

  useEffect(() => {
    if (open && !activeConvId) {
      loadConversations()
    }
  }, [open, activeConvId, loadConversations])

  // Close panel on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const loadConvMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`)
      if (!res.ok) return
      const j = await res.json() as { data?: Array<{ id: string; role: string; content: string; action_card: ActionCard | null; created_at: string }> }
      const msgs: Message[] = (j.data ?? []).map(m => ({
        id:          m.id,
        role:        m.role as 'user' | 'assistant',
        content:     m.content,
        action_card: m.action_card,
        timestamp:   new Date(m.created_at).getTime(),
      }))
      setMessages(msgs)
    } catch { /* ok */ }
  }, [])

  const openConversation = useCallback((convId: string, title: string) => {
    if (convId === '__new__') {
      // Start new conversation with a suggestion as initial input
      setActiveConvId(null)
      setActiveTitle('Nova conversa')
      setMessages([])
      setInput(title)
      return
    }
    setActiveConvId(convId)
    setActiveTitle(title)
    setMessages([])
    loadConvMessages(convId)
  }, [loadConvMessages])

  const startNew = useCallback(() => {
    setActiveConvId(null)
    setActiveTitle('Nova conversa')
    setMessages([])
    setInput('')
  }, [])

  const goBack = useCallback(() => {
    setActiveConvId(null)
    setActiveTitle('Nova conversa')
    setMessages([])
    setInput('')
    loadConversations()
  }, [loadConversations])

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
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:         msg,
          company_id:      companyId,
          conversation_id: activeConvId,
        }),
      })

      const data = await res.json() as {
        reply?: string
        action_card?: ActionCard | null
        conversation_id?: string
      }

      // If a new conversation was created, store its ID
      if (data.conversation_id && !activeConvId) {
        setActiveConvId(data.conversation_id)
      }

      const aiMsg: Message = {
        id:          Math.random().toString(36).slice(2),
        role:        'assistant',
        content:     data.reply?.trim() || 'Não consegui gerar uma resposta. Tente novamente.',
        action_card: data.action_card ?? null,
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
  }, [input, loading, companyId, activeConvId])

  const showChat = activeConvId !== null || messages.length > 0 || input.length > 0

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
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] lg:hidden"
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
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-4 py-3.5"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, transparent 100%)' }}
            >
              <div className="flex items-center gap-2.5">
                {/* AI avatar with glow */}
                <div
                  className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 ring-1 ring-violet-500/40"
                  style={{ boxShadow: '0 0 14px rgba(124,58,237,0.5)' }}
                >
                  <Bot size={16} className="text-violet-300" />
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-zinc-950" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">NEXUS IA</p>
                  <p className="text-[10px] text-zinc-500">Beta · Análise em tempo real</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {showChat && (
                  <button
                    onClick={startNew}
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

            {/* Back / breadcrumb when in a conversation */}
            {showChat && (
              <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/40 px-4 py-2">
                <button
                  onClick={goBack}
                  className="text-[10px] text-zinc-500 transition hover:text-zinc-300"
                >
                  ← Conversas
                </button>
                <span className="text-[10px] text-zinc-700">/</span>
                <span className="truncate text-[10px] text-zinc-400">{activeTitle}</span>
              </div>
            )}

            {/* Body */}
            {showChat ? (
              <ChatView
                messages={messages}
                loading={loading}
                input={input}
                onInput={setInput}
                onSend={sendMessage}
                onSuggestion={text => {
                  setInput(text)
                  // auto-send the suggestion
                  const msg: Message = {
                    id:        Math.random().toString(36).slice(2),
                    role:      'user',
                    content:   text,
                    timestamp: Date.now(),
                  }
                  setMessages(prev => [...prev, msg])
                  setLoading(true)
                  fetch('/api/ai/chat', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ message: text, company_id: companyId, conversation_id: activeConvId }),
                  })
                    .then(r => r.json())
                    .then((d: { reply?: string; action_card?: ActionCard | null; conversation_id?: string }) => {
                      if (d.conversation_id && !activeConvId) setActiveConvId(d.conversation_id)
                      setMessages(prev => [...prev, {
                        id:          Math.random().toString(36).slice(2),
                        role:        'assistant',
                        content:     d.reply?.trim() || 'Não consegui responder.',
                        action_card: d.action_card ?? null,
                        timestamp:   Date.now(),
                      }])
                    })
                    .catch(() => {
                      setMessages(prev => [...prev, {
                        id:        Math.random().toString(36).slice(2),
                        role:      'assistant',
                        content:   'Erro de conexão.',
                        timestamp: Date.now(),
                      }])
                    })
                    .finally(() => {
                      setInput('')
                      setLoading(false)
                    })
                }}
              />
            ) : (
              <ConversationList
                conversations={conversations}
                loading={convLoading}
                onSelect={openConversation}
                onNew={startNew}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
