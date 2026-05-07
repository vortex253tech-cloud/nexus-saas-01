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
  id:           string
  role:         'user' | 'assistant'
  content:      string
  timestamp:    number
  action_card?: ActionCard | null
}

export interface ConversationSummary {
  id:            string
  title:         string
  created_at:    string
  updated_at?:   string
  last_message?: { role: string; content: string } | null
}

// Matches the chat API's AttachmentInput interface
export interface AttachmentInput {
  id?:            string
  name:           string
  mime:           string
  type_category:  'document' | 'image' | 'audio'
  extracted_text: string | null
  ai_summary?:    string | null
}

interface ChatState {
  // Current chat
  messages:           ChatMessage[]
  loading:            boolean
  conversationId:     string | null
  streamingMessageId: string | null   // ID of the message being streamed right now

  // Company
  companyId: string | null

  // Sidebar
  conversations:        ConversationSummary[]
  loadingConversations: boolean

  // Actions
  setCompanyId:         (id: string | null) => void
  sendMessage:          (text: string, attachments?: AttachmentInput[]) => Promise<void>
  startNewConversation: () => void
  loadConversation:     (id: string) => Promise<void>
  fetchConversations:   () => Promise<void>
}

// ─── Welcome message ──────────────────────────────────────────────────────────

function makeWelcome(): ChatMessage {
  return {
    id:        'welcome',
    role:      'assistant',
    content:   'Olá! Sou o **NEXUS IA** — sua assistente de negócios.\n\nAcesso dados reais da sua empresa: clientes, cobranças, faturamento, fornecedores e muito mais. Você também pode enviar **PDFs, planilhas, imagens e áudios** para análise. O que deseja saber?',
    timestamp: Date.now(),
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()((set, get) => ({
  messages:             [makeWelcome()],
  loading:              false,
  conversationId:       null,
  streamingMessageId:   null,
  companyId:            null,
  conversations:        [],
  loadingConversations: false,

  setCompanyId: (companyId) => set({ companyId }),

  // ── Send a message (SSE streaming) ────────────────────────────────────────
  sendMessage: async (text: string, attachments: AttachmentInput[] = []) => {
    const { companyId, loading, conversationId } = get()
    const hasText       = text.trim().length > 0
    const hasAttachment = attachments.length > 0
    if ((!hasText && !hasAttachment) || loading) return

    const userMsg: ChatMessage = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   text.trim(),
      timestamp: Date.now(),
    }

    // Pre-add an empty assistant message that will be filled by the stream
    const streamMsgId = crypto.randomUUID()
    const streamMsg: ChatMessage = {
      id:        streamMsgId,
      role:      'assistant',
      content:   '',
      timestamp: Date.now(),
    }

    set((s) => ({
      messages:           [...s.messages, userMsg, streamMsg],
      loading:             true,
      streamingMessageId:  streamMsgId,
    }))

    try {
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:         text.trim(),
          company_id:      companyId,
          conversation_id: conversationId,
          attachments,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText   = ''
      let actionCard: ActionCard | null = null
      let newConvId  = conversationId
      let sseBuffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() ?? ''  // keep last (possibly incomplete) line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr) as Record<string, unknown>

            if (typeof event.token === 'string') {
              fullText += event.token
              set((s) => ({
                messages: s.messages.map(m =>
                  m.id === streamMsgId ? { ...m, content: fullText } : m,
                ),
              }))
            } else if (event.done === true) {
              actionCard = (event.action_card as ActionCard | null) ?? null
              newConvId  = (event.conversation_id as string | null) ?? newConvId
            } else if (typeof event.error === 'string') {
              fullText = event.error
              set((s) => ({
                messages: s.messages.map(m =>
                  m.id === streamMsgId ? { ...m, content: fullText } : m,
                ),
              }))
            }
          } catch { /* skip malformed line */ }
        }
      }

      // Finalize: stamp action card and conversation id
      set((s) => ({
        messages: s.messages.map(m =>
          m.id === streamMsgId
            ? { ...m, content: fullText || 'Não consegui gerar uma resposta. Tente novamente.', action_card: actionCard }
            : m,
        ),
        conversationId:     newConvId,
        streamingMessageId: null,
      }))

      // Refresh sidebar if this was the first message
      if (!conversationId && newConvId) {
        void get().fetchConversations()
      }

    } catch {
      set((s) => ({
        messages: s.messages.map(m =>
          m.id === streamMsgId
            ? { ...m, content: 'Erro de conexão. Verifique sua internet e tente novamente.' }
            : m,
        ),
        streamingMessageId: null,
      }))
    } finally {
      set({ loading: false })
    }
  },

  // ── Start a fresh conversation ────────────────────────────────────────────
  startNewConversation: () => {
    set({
      messages:           [makeWelcome()],
      conversationId:     null,
      loading:            false,
      streamingMessageId: null,
    })
  },

  // ── Load an existing conversation from DB ─────────────────────────────────
  loadConversation: async (id: string) => {
    const { conversationId } = get()
    if (conversationId === id) return

    set({ loading: true, conversationId: id, messages: [], streamingMessageId: null })

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
    } catch { /* sidebar stays empty */ }
    finally {
      set({ loadingConversations: false })
    }
  },
}))
