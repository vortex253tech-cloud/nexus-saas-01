'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, Loader2, Sparkles, RefreshCw,
  User, Zap, TrendingUp, Users, AlertCircle, DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'
import { useChatStore, type ChatMessage } from '@/lib/store/chat-store'
import { AIStatus } from '@/components/ui/ai-status'

// ─── Suggestions ─────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: Users,       text: 'Quem me deve dinheiro?' },
  { icon: AlertCircle, text: 'Clientes em atraso?' },
  { icon: DollarSign,  text: 'Total a receber' },
  { icon: TrendingUp,  text: 'Como aumentar faturamento?' },
  { icon: Zap,         text: 'Taxa de inadimplência' },
]

// ─── Markdown renderer ────────────────────────────────────────────
// Handles **bold**, *italic*, `code`, ## headers, - lists, 1. lists

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

        // Bullet list
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

        // Numbered list
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

        // Header
        if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
          return (
            <p key={pi} className="text-sm font-bold text-white">
              {inlineMarkdown(lines[0].replace(/^#{1,3} /, ''))}
            </p>
          )
        }

        // Regular paragraph
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

// ─── Message bubble ───────────────────────────────────────────────

function MessageBubble({ msg, isLast }: { msg: ChatMessage; isLast: boolean }) {
  const isUser = msg.role === 'user'
  const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn('group flex items-end gap-2.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/20 ring-1 ring-violet-500/20">
          <Bot size={13} className="text-violet-300" />
        </div>
      )}

      <div className={cn('max-w-[78%]', isUser && 'flex flex-col items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3',
          isUser
            ? 'bg-violet-600 text-white rounded-br-sm shadow-lg shadow-violet-900/30'
            : 'bg-zinc-800/70 text-zinc-200 border border-zinc-700/40 rounded-bl-sm',
        )}>
          {isUser
            ? <p className="text-sm leading-relaxed">{msg.content}</p>
            : renderMarkdown(msg.content)
          }
        </div>
        <span className={cn(
          'mt-1 px-1 text-[10px] text-zinc-600 transition-opacity',
          isLast ? 'opacity-60' : 'opacity-0 group-hover:opacity-100',
          isUser ? 'text-right' : 'text-left',
        )}>
          {time}
        </span>
      </div>

      {isUser && (
        <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600">
          <User size={12} className="text-white" />
        </div>
      )}
    </motion.div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-end gap-2.5"
    >
      <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/20 ring-1 ring-violet-500/20">
        <Bot size={13} className="text-violet-300" />
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-zinc-700/40 bg-zinc-800/70 px-4 py-3.5">
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

// ─── Input ────────────────────────────────────────────────────────

function ChatInput({
  value,
  onChange,
  onSend,
  loading,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  loading: boolean
  disabled: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [value])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!loading && !disabled && value.trim()) onSend()
    }
  }

  return (
    <div className={cn(
      'flex items-end gap-3 rounded-2xl border bg-zinc-900/80 px-4 py-3 transition-colors',
      disabled
        ? 'border-zinc-800 opacity-60'
        : 'border-zinc-700/70 focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/20',
    )}>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled || loading}
        placeholder={
          disabled
            ? 'Carregando sessão...'
            : 'Pergunte sobre seus dados financeiros...'
        }
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

// ─── Page ─────────────────────────────────────────────────────────

export default function AssistantPage() {
  const { messages, loading, companyId, setCompanyId, sendMessage, clearMessages } = useChatStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Resolve company on mount (only if not already set)
  useEffect(() => {
    if (companyId) return
    void resolveCompanyId().then(cid => setCompanyId(cid))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const ready = Boolean(companyId)
  const showSuggestions = messages.length <= 1 && !loading

  return (
    <div className="flex h-[calc(100vh-52px)] flex-col overflow-hidden bg-zinc-950 lg:h-screen">

      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-950/95 px-5 py-3.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/15 ring-1 ring-violet-500/20">
            <Sparkles size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Assistente Financeiro</h1>
            <p className="text-[10px] text-zinc-500">Análise em tempo real · NEXUS AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] border',
            ready
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          )}>
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              ready ? 'bg-emerald-400 ai-pulse' : 'animate-pulse bg-amber-400',
            )} />
            {ready ? 'Conectado' : 'Conectando'}
          </div>
          <AIStatus
            state={loading ? 'processing' : messages.length > 0 ? 'analyzing' : 'idle'}
            label={loading ? 'IA respondendo' : undefined}
          />
          <button
            onClick={clearMessages}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <RefreshCw size={11} />
            Limpar
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id} msg={msg} isLast={i === messages.length - 1} />
          ))}
          <AnimatePresence>
            {loading && <TypingIndicator />}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Suggestions (only when chat is fresh) ── */}
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

      {/* ── Input ── */}
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
  )
}
