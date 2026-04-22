'use client'

import { useState, useRef, useEffect } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Quem me deve dinheiro?',
  'Quais clientes estão atrasados?',
  'Qual meu total a receber?',
  'O que fazer para aumentar faturamento?',
  'Qual minha taxa de inadimplência?',
]

function getCompanyId(): string | null {
  if (typeof window === 'undefined') return null

  // Primary: sessionStorage nexus_resultado (set by dashboard after diagnosis)
  try {
    const raw = sessionStorage.getItem('nexus_resultado')
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const cid = parsed.company_id ?? parsed.companyId
      if (typeof cid === 'string' && cid) return cid
    }
  } catch { /* ignore parse errors */ }

  // Fallback: localStorage nexus_company_id
  return localStorage.getItem('nexus_company_id')
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente financeiro do NEXUS. Pergunte sobre seus clientes, cobranças ou faturamento.' }
  ])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Read company_id after hydration (localStorage/sessionStorage only available client-side)
  useEffect(() => {
    const cid = getCompanyId()
    console.log('[assistant] company_id resolved:', cid)
    setCompanyId(cid)

    if (!cid) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Nenhum diagnóstico encontrado. Complete o diagnóstico no dashboard para que eu possa acessar seus dados.',
        },
      ])
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      console.log('[assistant] sending message, company_id:', companyId, '| message:', msg)

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, message: msg }),
      })

      const data = await res.json() as { reply?: string; message?: string; error?: boolean }

      console.log('[assistant] response status:', res.status, '| data:', data)

      if (!res.ok) {
        const errorText = data.message ?? `Erro ${res.status}`
        console.error('[assistant] API error:', errorText)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply ?? `Não consegui processar: ${errorText}`,
        }])
        return
      }

      if (!data.reply) {
        console.error('[assistant] empty reply in response:', data)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Recebi uma resposta vazia. Tente novamente.',
        }])
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply! }])

    } catch (err) {
      console.error('[assistant] fetch error:', err)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro de conexão. Verifique sua internet e tente novamente.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Assistente Financeiro</h1>

      {/* Sugestões */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => send(s)} disabled={!companyId}
            className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition">
            {s}
          </button>
        ))}
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 bg-gray-50 rounded-xl p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-gray-400 text-sm animate-pulse">
              Analisando dados...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder={companyId ? 'Pergunte sobre seus dados financeiros...' : 'Complete o diagnóstico para usar o assistente'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading || !companyId}
        />
        <button onClick={() => send()}
          disabled={loading || !input.trim() || !companyId}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition">
          Enviar
        </button>
      </div>

      {!companyId && (
        <p className="text-xs text-center text-gray-400 mt-2">
          Sem diagnóstico ativo. Volte ao dashboard e execute o diagnóstico primeiro.
        </p>
      )}
    </div>
  )
}
