import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ──────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ChatState {
  messages: ChatMessage[]
  loading: boolean
  companyId: string | null
  setCompanyId: (id: string | null) => void
  sendMessage: (text: string) => Promise<void>
  clearMessages: () => void
}

// ─── Welcome message ─────────────────────────────────────────────

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Sou o assistente financeiro do **NEXUS**.\n\nPosso analisar seus clientes, cobranças, inadimplência e faturamento em tempo real. O que deseja saber?',
  timestamp: Date.now(),
}

// ─── Store ───────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages:  [WELCOME],
      loading:   false,
      companyId: null,

      setCompanyId: (companyId) => set({ companyId }),

      sendMessage: async (text: string) => {
        const { companyId, loading } = get()
        if (!text.trim() || loading) return

        const userMsg: ChatMessage = {
          id:        Math.random().toString(36).slice(2),
          role:      'user',
          content:   text.trim(),
          timestamp: Date.now(),
        }

        set((s) => ({ messages: [...s.messages, userMsg], loading: true }))

        try {
          const res = await fetch('/api/ai/chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ message: text.trim(), company_id: companyId }),
          })

          const data = await res.json() as { reply?: string; error?: string }
          const content = data.reply?.trim() || 'Não consegui gerar uma resposta. Tente novamente.'

          set((s) => ({
            messages: [...s.messages, {
              id:        Math.random().toString(36).slice(2),
              role:      'assistant',
              content,
              timestamp: Date.now(),
            }],
          }))
        } catch {
          set((s) => ({
            messages: [...s.messages, {
              id:        Math.random().toString(36).slice(2),
              role:      'assistant',
              content:   'Erro de conexão. Verifique sua internet e tente novamente.',
              timestamp: Date.now(),
            }],
          }))
        } finally {
          set({ loading: false })
        }
      },

      clearMessages: () =>
        set({
          messages: [{
            ...WELCOME,
            id:        'welcome-' + Date.now(),
            content:   'Conversa reiniciada. Como posso ajudar?',
            timestamp: Date.now(),
          }],
        }),
    }),
    {
      name:       'nexus-chat-v1',
      partialize: (s) => ({ messages: s.messages }),
    },
  ),
)
