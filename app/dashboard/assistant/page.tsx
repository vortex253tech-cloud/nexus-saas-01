'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── Types ────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// ─── Suggestions ──────────────────────────────────────────────

const SUGGESTIONS = [
  'Quem me deve dinheiro?',
  'Quais clientes estão atrasados?',
  'Qual meu total a receber?',
  'O que fazer para aumentar faturamento?',
  'Qual minha taxa de inadimplência?',
]

// ─── Markdown-lite renderer ───────────────────────────────────
// Handles **bold**, bullet points (•), and line breaks

function renderContent(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="font-semibold text-white">{part.slice(2, -2)}</strong>
      }
      return part
    })
    return (
      <span key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </span>
    )
  })
}

// ─── Message bubble ───────────────────────────────────────────

function MessageBubble({ msg, index }: { msg: Message; index: number }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.25 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/30 mt-1">
          <Bot size={14} className="text-violet-300" />
        </div>
      )}
      <div className={cn(
        'max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-violet-600 text-white rounded-tr-sm'
          : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 rounded-tl-sm',
      )}>
        {renderContent(msg.content)}
      </div>
    </motion.div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex gap-3 justify-start"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/30 mt-1">
        <Bot size={14} className="text-violet-300" />
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-zinc-700/60 bg-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-violet-400"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o assistente financeiro do NEXUS.\n\nPosso responder sobre seus clientes, cobranças, inadimplência e faturamento. O que deseja saber?',
    },
  ])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [ready, setReady]         = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void resolveCompanyId().then(cid => {
      if (cid) {
        setCompanyId(cid)
        setReady(true)
      } else {
        setReady(true)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sessão não encontrada. Faça login ou complete o diagnóstico no dashboard para usar o assistente.',
        }])
      }
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading || !companyId) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      console.log('[assistant] sending:', msg, '| company_id:', companyId)

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, message: msg }),
      })

      const data = await res.json() as { reply?: string }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply?.trim() || 'Não consegui gerar uma resposta. Tente novamente.',
      }])

      // Re-focus input after reply
      setTimeout(() => inputRef.current?.focus(), 100)

    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro de conexão. Verifique sua internet e tente novamente.',
      }])
    } finally {
      setLoading(false)
    }
  }

  function clearChat() {
    setMessages([{
      role: 'assistant',
      content: 'Conversa reiniciada. Como posso ajudar?',
    }])
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col p-4 lg:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20">
            <Sparkles size={18} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Assistente Financeiro</h1>
            <p className="text-xs text-zinc-500">Análise em tempo real dos seus dados</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-white"
          title="Limpar conversa"
        >
          <RefreshCw size={12} /> Limpar
        </button>
      </div>

      {/* Suggestions */}
      <div className="mb-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={!companyId || loading}
            className="rounded-full border border-violet-700/40 bg-violet-950/30 px-3 py-1 text-xs text-violet-300 transition hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} index={i} />
          ))}
          <AnimatePresence>
            {loading && <TypingIndicator />}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !loading && send()}
          disabled={loading || !ready || !companyId}
          placeholder={
            !ready ? 'Carregando...'
            : !companyId ? 'Faça login para usar o assistente'
            : 'Pergunte sobre seus dados financeiros...'
          }
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-600 focus:ring-1 focus:ring-violet-600/40 disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim() || !companyId}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </div>
    </div>
  )
}
