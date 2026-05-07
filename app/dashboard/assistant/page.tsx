'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, Loader2, Sparkles, Plus,
  User, Zap, TrendingUp, Users, AlertCircle, DollarSign,
  MessageSquare, ChevronRight, ArrowUpRight,
  PanelLeftClose, PanelLeft, X,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'
import {
  useChatStore,
  type ChatMessage,
  type ActionCard,
  type ConversationSummary,
} from '@/lib/store/chat-store'

// ─── Quick suggestions ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: Users,       text: 'Quem me deve dinheiro?' },
  { icon: AlertCircle, text: 'Clientes em atraso' },
  { icon: DollarSign,  text: 'Total a receber' },
  { icon: TrendingUp,  text: 'Como aumentar faturamento?' },
  { icon: Zap,         text: 'Taxa de inadimplência' },
]

// ─── Markdown renderer ────────────────────────────────────────────────────────

function inlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic text-zinc-200">{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="rounded bg-zinc-700 px-1 py-0.5 font-mono text-[11px] text-violet-300">{part.slice(1, -1)}</code>
    return part
  })
}

function renderMarkdown(text: string): React.ReactNode {
  const paragraphs = text.split(/\n{2,}/)
  return (
    <div className="space-y-2">
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n').filter(Boolean)
        if (!lines.length) return null

        if (lines.every(l => /^[•\-\*] /.test(l.trim()))) {
          return (
            <ul key={pi} className="space-y-1 pl-1">
              {lines.map((item, ii) => (
                <li key={ii} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                  <span>{inlineMarkdown(item.replace(/^[•\-\*]\s/, ''))}</span>
                </li>
              ))}
            </ul>
          )
        }

        if (lines.every(l => /^\d+\.\s/.test(l.trim()))) {
          return (
            <ol key={pi} className="space-y-1 pl-1">
              {lines.map((item, ii) => (
                <li key={ii} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="min-w-[18px] shrink-0 text-xs font-semibold text-violet-400">{ii + 1}.</span>
                  <span>{inlineMarkdown(item.replace(/^\d+\.\s/, ''))}</span>
                </li>
              ))}
            </ol>
          )
        }

        if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
          return (
            <p key={pi} className="text-sm font-bold text-white">
              {inlineMarkdown(lines[0].replace(/^#{1,3} /, ''))}
            </p>
          )
        }

        return (
          <p key={pi} className="text-sm leading-relaxed">
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

// ─── Action card ─────────────────────────────────────────────────────────────

function ActionCardWidget({ card }: { card: ActionCard }) {
  const fmtVal = card.value !== undefined
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.value)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 320, damping: 22 }}
      className="mt-3 overflow-hidden rounded-xl border border-violet-500/25 bg-violet-500/8 backdrop-blur"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-violet-400/80">
            Ação recomendada
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">{card.title}</p>
          {fmtVal && (
            <p className="mt-0.5 text-xs font-bold text-emerald-400">{fmtVal}</p>
          )}
        </div>
        {card.href ? (
          <Link
            href={card.href}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 active:scale-95"
          >
            {card.button}
            <ArrowUpRight size={11} />
          </Link>
        ) : (
          <button className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 active:scale-95">
            {card.button}
            <ChevronRight size={11} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isLast }: { msg: ChatMessage; isLast: boolean }) {
  const isUser = msg.role === 'user'
  const time   = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, type: 'spring', stiffness: 340, damping: 26 }}
      className={cn('group flex items-end gap-2.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/30 to-violet-500/10 ring-1 ring-violet-500/30">
          <Bot size={13} className="text-violet-300" />
        </div>
      )}

      <div className={cn('max-w-[78%]', isUser && 'flex flex-col items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3',
          isUser
            ? 'bg-gradient-to-br from-violet-600 to-violet-700 text-white rounded-br-sm shadow-lg shadow-violet-900/40'
            : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/40 rounded-bl-sm shadow-sm',
        )}>
          {isUser
            ? <p className="text-sm leading-relaxed">{msg.content}</p>
            : renderMarkdown(msg.content)
          }
        </div>

        {!isUser && msg.action_card && (
          <div className="w-full">
            <ActionCardWidget card={msg.action_card} />
          </div>
        )}

        <span className={cn(
          'mt-1 px-1 text-[10px] text-zinc-600 transition-opacity',
          isLast ? 'opacity-60' : 'opacity-0 group-hover:opacity-100',
          isUser ? 'text-right' : 'text-left',
        )}>
          {time}
        </span>
      </div>

      {isUser && (
        <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-700 shadow-md shadow-violet-900/30">
          <User size={12} className="text-white" />
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
      exit={{ opacity: 0, y: 8 }}
      className="flex items-end gap-2.5"
    >
      <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/30 to-violet-500/10 ring-1 ring-violet-500/30">
        <Bot size={13} className="text-violet-300" />
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-zinc-700/40 bg-zinc-800/80 px-4 py-3.5">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-violet-400"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Chat input ───────────────────────────────────────────────────────────────

function ChatInput({
  value, onChange, onSend, loading, disabled,
}: {
  value:    string
  onChange: (v: string) => void
  onSend:   () => void
  loading:  boolean
  disabled: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [value])

  return (
    <div className={cn(
      'flex items-end gap-3 rounded-2xl border bg-zinc-900/90 px-4 py-3 transition-all',
      disabled
        ? 'border-zinc-800 opacity-60'
        : 'border-zinc-700/70 focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/20',
    )}>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!loading && !disabled && value.trim()) onSend()
          }
        }}
        disabled={disabled || loading}
        placeholder={disabled ? 'Carregando...' : 'Pergunte sobre seus dados...'}
        className="max-h-36 flex-1 resize-none bg-transparent text-sm text-white placeholder-zinc-600 outline-none disabled:cursor-not-allowed leading-relaxed"
      />
      <button
        onClick={onSend}
        disabled={loading || !value.trim() || disabled}
        className={cn(
          'mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all',
          value.trim() && !loading && !disabled
            ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-md shadow-violet-900/40 active:scale-95'
            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
        )}
      >
        {loading
          ? <Loader2 size={14} className="animate-spin text-violet-400" />
          : <Send size={14} />
        }
      </button>
    </div>
  )
}

// ─── Conversation item ────────────────────────────────────────────────────────

function ConversationItem({
  conv, isActive, onClick,
}: {
  conv:     ConversationSummary
  isActive: boolean
  onClick:  () => void
}) {
  const time = (() => {
    const d   = new Date(conv.updated_at ?? conv.created_at)
    const now = new Date()
    const diffH = (now.getTime() - d.getTime()) / (1000 * 60 * 60)
    if (diffH < 24)   return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (diffH < 168)  return d.toLocaleDateString('pt-BR', { weekday: 'short' })
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  })()

  const preview = (conv.last_message?.content ?? '')
    .replace(/\*\*/g, '').replace(/\*/g, '').slice(0, 55)

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full rounded-xl px-3 py-2.5 text-left transition-all',
        isActive
          ? 'border border-violet-500/25 bg-violet-600/15'
          : 'border border-transparent hover:border-zinc-700/40 hover:bg-zinc-800/60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn(
          'truncate text-xs font-medium leading-snug',
          isActive ? 'text-violet-200' : 'text-zinc-300',
        )}>
          {conv.title}
        </p>
        <span className="shrink-0 text-[10px] text-zinc-600">{time}</span>
      </div>
      {preview && (
        <p className="mt-0.5 truncate text-[11px] leading-snug text-zinc-600">{preview}</p>
      )}
    </button>
  )
}

// ─── Sidebar panel (shared desktop/mobile) ───────────────────────────────────

function SidebarPanel({
  onClose, conversationId, onNewChat, onSelectConversation,
}: {
  onClose:              () => void
  conversationId:       string | null
  onNewChat:            () => void
  onSelectConversation: (id: string) => void
}) {
  const { conversations, loadingConversations } = useChatStore()

  return (
    <div className="flex h-full w-72 flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/60 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/20 ring-1 ring-violet-500/30">
            <Sparkles size={13} className="text-violet-400" />
          </div>
          <span className="text-sm font-bold text-white">NEXUS IA</span>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-800 hover:text-white lg:hidden"
        >
          <X size={14} />
        </button>
      </div>

      {/* New conversation */}
      <div className="shrink-0 px-3 py-3">
        <button
          onClick={() => { onNewChat(); onClose() }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/60 py-2.5 text-xs font-medium text-zinc-400 transition hover:border-violet-500/50 hover:bg-violet-500/8 hover:text-violet-300 active:scale-[0.98]"
        >
          <Plus size={13} />
          Nova conversa
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {loadingConversations ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-zinc-600" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquare size={20} className="text-zinc-700" />
            <p className="text-xs text-zinc-600">Nenhuma conversa ainda</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Recentes
            </p>
            {conversations.map(conv => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === conversationId}
                onClick={() => { onSelectConversation(conv.id); onClose() }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-zinc-800/60 px-4 py-3">
        <p className="text-[10px] text-zinc-700">Histórico salvo automaticamente</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const {
    messages, loading, companyId, conversationId,
    setCompanyId, sendMessage, startNewConversation, loadConversation, fetchConversations,
  } = useChatStore()

  const [input,       setInput]       = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Resolve company on mount
  useEffect(() => {
    if (companyId) return
    void resolveCompanyId().then(cid => setCompanyId(cid))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch conversation history when company resolves
  useEffect(() => {
    if (!companyId) return
    void fetchConversations()
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    await sendMessage(msg)
  }, [input, loading, sendMessage])

  const ready           = Boolean(companyId)
  const showSuggestions = messages.length <= 1 && !loading

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const handleNewChat = useCallback(() => { startNewConversation(); setSidebarOpen(false) }, [startNewConversation])
  const handleSelectConv = useCallback((id: string) => { void loadConversation(id); setSidebarOpen(false) }, [loadConversation])

  return (
    <div className="flex h-[calc(100vh-52px)] overflow-hidden bg-zinc-950 lg:h-screen">

      {/* ── Desktop sidebar (always rendered, width-transition) ── */}
      <div className={cn(
        'hidden overflow-hidden border-r border-zinc-800/80 transition-all duration-300 lg:flex',
        sidebarOpen ? 'w-72' : 'w-0',
      )}>
        <SidebarPanel
          onClose={closeSidebar}
          conversationId={conversationId}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConv}
        />
      </div>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSidebar}
              className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              key="sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="fixed inset-y-0 left-0 z-30 border-r border-zinc-800/80 lg:hidden"
            >
              <SidebarPanel
                onClose={closeSidebar}
                conversationId={conversationId}
                onNewChat={handleNewChat}
                onSelectConversation={handleSelectConv}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main chat area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/60 bg-zinc-950/95 px-4 py-3.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
              title={sidebarOpen ? 'Fechar histórico' : 'Abrir histórico'}
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/20 to-violet-500/5 ring-1 ring-violet-500/25">
                <Sparkles size={15} className="text-violet-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">Assistente Financeiro</h1>
                <p className="text-[10px] text-zinc-500">Dados em tempo real · NEXUS IA</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]',
              ready
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-400',
            )}>
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                ready ? 'bg-emerald-400 animate-pulse' : 'animate-pulse bg-amber-400',
              )} />
              {ready ? 'Conectado' : 'Conectando'}
            </div>

            <button
              onClick={startNewConversation}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
              title="Nova conversa"
            >
              <Plus size={12} />
              <span className="hidden sm:inline">Nova</span>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
            <AnimatePresence mode="wait">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isLast={i === messages.length - 1}
                />
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {loading && <TypingIndicator />}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Suggestions */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="shrink-0 px-4 pb-2"
            >
              <div className="mx-auto max-w-2xl flex flex-wrap gap-2">
                {SUGGESTIONS.map(({ icon: Icon, text }, i) => (
                  <motion.button
                    key={text}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 360, damping: 26 }}
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSend(text)}
                    disabled={!ready}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon size={11} />
                    {text}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/95 px-4 py-4 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              loading={loading}
              disabled={!ready}
            />
            <p className="mt-2 text-center text-[10px] text-zinc-700">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
