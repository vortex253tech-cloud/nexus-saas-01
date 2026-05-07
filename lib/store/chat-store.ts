import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionCard {
  type:   string
  title:  string
  value?: number
  button: string
  href?:  string
}

export interface ChatMessage {
  id:          string
  role:        'user' | 'assistant'
  content:     string
  timestamp:   number
  action_card?: ActionCard | null
}

export interface ConversationSummary {
  id:           string
  title:        string
  created_at:   string
  updated_at?:  string
  last_message?: { role: string; content: string } | null
}

interface ChatState {
  // Current chat
  messages:       ChatMessage[]
  loading:        boolean
  conversationId: string | null

  // Company
  companyId: string | null

  // Sidebar
  conversations:         ConversationSummary[]
  loadingConversations:  boolean

  // Actions
  setCompanyId:        (id: string | null) => void
  sendMessage:         (text: string) => Promise<void>
  startNewConversation: () => void
  loadConversation:    (id: string) => Promise<void>
  fetchConversations:  () => Promise<void>
}

// ─── Welcome message ──────────────────────────────────────────────────────────

function makeWelcome(): ChatMessage {
  return {
    id:        'welcome',
    role:      'assistant',
    content:   'Olá! Sou o **NEXUS IA** — sua assistente de negócios.\n\nAcesso dados reais da sua empresa: clientes, cobranças, faturamento, fornecedores e muito mais. O que deseja saber?',
    timestamp: Date.now(),
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()((set, get) => ({
  messages:              [makeWelcome()],
  loading:               false,
  conversationId:        null,
  companyId:             null,
  conversations:         [],
  loadingConversations:  false,

  setCompanyId: (companyId) => set({ companyId }),

  // ── Send a message ─────────────────────────────────────────────────────────
  sendMessage: async (text: string) => {
    const { companyId, loading, conversationId } = get()
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   text.trim(),
      timestamp: Date.now(),
    }

    set((s) => ({ messages: [...s.messages, userMsg], loading: true }))

    try {
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:         text.trim(),
          company_id:      companyId,
          conversation_id: conversationId,
        }),
      })

      const data = await res.json() as {
        reply?:           string
        action_card?:     ActionCard | null
        conversation_id?: string
      }

      const content = data.reply?.trim() || 'Não consegui gerar uma resposta. Tente novamente.'

      const aiMsg: ChatMessage = {
        id:          crypto.randomUUID(),
        role:        'assistant',
        content,
        timestamp:   Date.now(),
        action_card: data.action_card ?? null,
      }

      // If API returned a new conversationId (first message), store it
      const newConvId = data.conversation_id ?? conversationId

      set((s) => ({
        messages:       [...s.messages, aiMsg],
        conversationId: newConvId,
      }))

      // Refresh sidebar conversation list after first message
      if (!conversationId && newConvId) {
        void get().fetchConversations()
      }

    } catch {
      set((s) => ({
        messages: [...s.messages, {
          id:        crypto.randomUUID(),
          role:      'assistant',
          content:   'Erro de conexão. Verifique sua internet e tente novamente.',
          timestamp: Date.now(),
        }],
      }))
    } finally {
      set({ loading: false })
    }
  },

  // ── Start a fresh conversation ────────────────────────────────────────────
  startNewConversation: () => {
    set({
      messages:       [makeWelcome()],
      conversationId: null,
      loading:        false,
    })
  },

  // ── Load an existing conversation from DB ─────────────────────────────────
  loadConversation: async (id: string) => {
    const { conversationId } = get()
    if (conversationId === id) return

    set({ loading: true, conversationId: id, messages: [] })

    try {
      const res  = await fetch(`/api/ai/conversations/${id}`)
      const data = await res.json() as { data?: Array<{
        id: string; role: string; content: string; action_card?: ActionCard | null; created_at: string
      }> }

      const msgs: ChatMessage[] = (data.data ?? []).map(m => ({
        id:          m.id,
        role:        m.role as 'user' | 'assistant',
        content:     m.content,
        timestamp:   new Date(m.created_at).getTime(),
        action_card: m.action_card ?? null,
      }))

      set({ messages: msgs.length ? msgs : [makeWelcome()] })
    } catch {
      set({ messages: [makeWelcome()] })
    } finally {
      set({ loading: false })
    }
  },

  // ── Fetch conversation list for sidebar ───────────────────────────────────
  fetchConversations: async () => {
    const { companyId } = get()
    set({ loadingConversations: true })

    try {
      const url = companyId
        ? `/api/ai/conversations?company_id=${companyId}`
        : '/api/ai/conversations'

      const res  = await fetch(url)
      const data = await res.json() as { data?: ConversationSummary[] }
      set({ conversations: data.data ?? [] })
    } catch {
      // ignore — sidebar just stays empty
    } finally {
      set({ loadingConversations: false })
    }
  },
}))
