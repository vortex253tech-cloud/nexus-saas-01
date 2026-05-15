// ═══════════════════════════════════════════════════════════════════
// NEXUS WhatsApp AI Engine
// Server-side only. Full pipeline: receive → validate → AI → respond.
// ═══════════════════════════════════════════════════════════════════

import Anthropic          from '@anthropic-ai/sdk'
import { createClient }   from '@supabase/supabase-js'
import { zapiSendText, resolveZApiConfig } from '@/lib/zapi'

// ── Types ────────────────────────────────────────────────────────

export interface ZApiWebhookPayload {
  type?:             string   // 'ReceivedCallback' | 'DeliveryCallback' | 'ReadCallback' etc.
  isGroup?:          boolean
  isStatusReply?:    boolean
  waitingMessage?:   boolean
  isEdit?:           boolean
  fromMe?:           boolean
  phone?:            string
  chatName?:         string
  senderName?:       string
  connectedPhone?:   string
  messageId?:        string
  momment?:          number
  text?: { message?: string }
  image?: { caption?: string; imageUrl?: string }
  audio?: { audioUrl?: string }
  document?: { fileName?: string }
  // N8N wraps the body under body.*
  body?: ZApiWebhookPayload
}

export interface ProcessResult {
  ok:       boolean
  skipped?: string   // reason if ignored
  phone?:   string
  reply?:   string
  error?:   string
}

// ── Constants ────────────────────────────────────────────────────

const MAX_CONTEXT_MESSAGES = 12
const MAX_REPLY_TOKENS      = 350
const TYPING_DELAY_MS       = 1200

const NEXUS_SYSTEM_PROMPT = `Você é o assistente oficial do NEXUS — o sistema operacional empresarial com IA mais avançado do Brasil.

SOBRE O NEXUS:
- Plataforma de IA que opera o negócio 24/7 (vendas, atendimento, financeiro, operações)
- Beta fechado — fase fundadores, vagas extremamente limitadas
- Comunidade exclusiva: NEXUS AI OPERATORS
- Link da comunidade: https://chat.whatsapp.com/IxLlbI3MTvn5ZPnAswGYXW

COMO RESPONDER:
- Sempre em português, tom profissional mas próximo e humano
- Máximo 3-4 frases curtas por mensagem — sem enrolação
- Nunca inventar recursos, preços ou datas específicas
- Sempre finalizar com uma ação clara

REGRAS:
- Preço → "será comunicado no momento do convite"
- Quando acesso → "convites em ordem da fila, em breve"
- Saber mais → convidar para a comunidade NEXUS AI OPERATORS
- O que é NEXUS → sistema operacional IA que automatiza toda a operação da empresa
- Concorrentes → não comentar, focar no valor do NEXUS`

// ── Supabase client (server-side, service role) ──────────────────

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── Anthropic client ─────────────────────────────────────────────

function getAI() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

// ── Payload normalizer ────────────────────────────────────────────
// Z-API can send fields at root OR nested under body (when via N8N webhook)

function normalizePayload(raw: ZApiWebhookPayload): ZApiWebhookPayload {
  if (raw.body && typeof raw.body === 'object') {
    return { ...raw.body, ...raw }
  }
  return raw
}

// ── Anti-loop & validation ────────────────────────────────────────

interface ValidationResult { valid: boolean; reason?: string }

function validateMessage(p: ZApiWebhookPayload): ValidationResult {
  // Only process text messages received from leads
  if (p.fromMe)                             return { valid: false, reason: 'fromMe' }
  if (p.isGroup)                            return { valid: false, reason: 'group' }
  if (p.isStatusReply)                      return { valid: false, reason: 'statusReply' }
  if (p.waitingMessage)                     return { valid: false, reason: 'waitingMessage' }
  if (p.isEdit)                             return { valid: false, reason: 'isEdit' }
  if (p.type && p.type !== 'ReceivedCallback') return { valid: false, reason: `type:${p.type}` }

  const text = extractText(p)
  if (!text || text.trim().length === 0)   return { valid: false, reason: 'emptyText' }
  if (!p.phone)                             return { valid: false, reason: 'noPhone' }

  return { valid: true }
}

function extractText(p: ZApiWebhookPayload): string {
  return (
    p.text?.message ??
    p.image?.caption ??
    ''
  ).trim()
}

function normalizePhone(raw: string): string {
  // Strip everything except digits
  return raw.replace(/\D/g, '')
}

// ── Deduplication ─────────────────────────────────────────────────

async function isAlreadyProcessed(messageId: string): Promise<boolean> {
  if (!messageId) return false
  const db = getDb()
  const { data } = await db
    .from('whatsapp_messages')
    .select('id')
    .eq('zapi_message_id', messageId)
    .maybeSingle()
  return !!data
}

// ── Conversation management ───────────────────────────────────────

async function upsertConversation(params: {
  companyId: string
  phone:     string
  name?:     string
}): Promise<string> {
  const db = getDb()
  const { companyId, phone, name } = params

  const { data, error } = await db
    .from('whatsapp_conversations')
    .upsert(
      {
        company_id:   companyId,
        phone,
        contact_name: name ?? null,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'company_id,phone', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error || !data) throw new Error(`upsertConversation: ${error?.message}`)
  return data.id
}

// ── Context retrieval ─────────────────────────────────────────────

interface ContextMessage { role: 'user' | 'assistant'; content: string; created_at: string }

async function getRecentContext(conversationId: string): Promise<ContextMessage[]> {
  const db = getDb()
  const { data } = await db
    .from('whatsapp_messages')
    .select('direction, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MAX_CONTEXT_MESSAGES)

  if (!data) return []

  return data
    .reverse()
    .map(m => ({
      role:       m.direction === 'incoming' ? 'user' : 'assistant',
      content:    m.content,
      created_at: m.created_at,
    })) as ContextMessage[]
}

// ── AI response generation ────────────────────────────────────────

interface AIResult { text: string; tokensUsed: number; processingMs: number }

async function generateAIResponse(
  userMessage: string,
  context:     ContextMessage[],
): Promise<AIResult> {
  const ai    = getAI()
  const start = Date.now()

  const messages: Anthropic.MessageParam[] = [
    ...context.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ]

  const response = await ai.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: MAX_REPLY_TOKENS,
    system:     NEXUS_SYSTEM_PROMPT,
    messages,
  })

  const text       = response.content[0].type === 'text' ? response.content[0].text : ''
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens
  const processingMs = Date.now() - start

  return { text, tokensUsed, processingMs }
}

// ── Message persistence ───────────────────────────────────────────

async function saveMessage(params: {
  conversationId: string
  companyId:      string
  phone:          string
  zapiMessageId?: string
  direction:      'incoming' | 'outgoing'
  content:        string
  fromMe:         boolean
  aiGenerated:    boolean
  tokensUsed?:    number
  processingMs?:  number
  rawPayload?:    Record<string, unknown>
}): Promise<void> {
  const db = getDb()

  await db.from('whatsapp_messages').insert({
    conversation_id: params.conversationId,
    company_id:      params.companyId,
    zapi_message_id: params.zapiMessageId ?? null,
    phone:           params.phone,
    direction:       params.direction,
    content:         params.content,
    from_me:         params.fromMe,
    ai_generated:    params.aiGenerated,
    tokens_used:     params.tokensUsed ?? null,
    processing_ms:   params.processingMs ?? null,
    raw_payload:     params.rawPayload ?? {},
    status:          params.direction === 'outgoing' ? 'sent' : 'delivered',
  })

  // Update conversation counters
  const rpcResult = await db.rpc('increment_conversation_count', {
    p_conversation_id: params.conversationId,
    p_last_message_at: new Date().toISOString(),
  })
  if (rpcResult.error) {
    // RPC not critical — update manually
    await db.from('whatsapp_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      })
      .eq('id', params.conversationId)
  }
}

// ── Analytics upsert ──────────────────────────────────────────────

async function updateAnalytics(params: {
  companyId:      string
  direction:      'in' | 'out'
  tokensUsed?:    number
  processingMs?:  number
  isNew?:         boolean
  error?:         boolean
}): Promise<void> {
  const db   = getDb()
  const date = new Date().toISOString().slice(0, 10)

  const increment: Record<string, unknown> = {}
  if (params.direction === 'in')  increment.messages_in  = 1
  if (params.direction === 'out') increment.messages_out = 1
  if (params.tokensUsed)          increment.tokens_used  = params.tokensUsed
  if (params.isNew)               increment.new_conversations = 1
  if (params.error)               increment.errors = 1

  await db.from('whatsapp_analytics')
    .upsert(
      {
        company_id:       params.companyId,
        date,
        messages_in:      params.direction === 'in'  ? 1 : 0,
        messages_out:     params.direction === 'out' ? 1 : 0,
        new_conversations: params.isNew ? 1 : 0,
        tokens_used:      params.tokensUsed ?? 0,
        errors:           params.error ? 1 : 0,
        avg_response_ms:  params.processingMs ?? null,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'company_id,date', ignoreDuplicates: false }
    )
    .then(() => {}) // analytics are non-critical
}

// ── Typing simulation ─────────────────────────────────────────────

async function sendTypingAndDelay(phone: string, zapiConfig: ReturnType<typeof resolveZApiConfig>): Promise<void> {
  if (!zapiConfig) return
  try {
    await fetch(
      `https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/send-option-list`,
      { method: 'GET' } // Just a warmup ping; typing via delay
    ).catch(() => {})
  } catch { /* ignore */ }
  await new Promise(r => setTimeout(r, TYPING_DELAY_MS))
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

export async function processWhatsAppMessage(
  rawPayload: ZApiWebhookPayload,
  companyId?: string,  // if null, uses platform-level Z-API
): Promise<ProcessResult> {
  const startTime = Date.now()

  try {
    // 1. Normalize (handle N8N body wrapping)
    const payload = normalizePayload(rawPayload)

    // 2. Validate & anti-loop
    const validation = validateMessage(payload)
    if (!validation.valid) {
      return { ok: true, skipped: validation.reason }
    }

    const phone   = normalizePhone(payload.phone!)
    const text    = extractText(payload)
    const msgId   = payload.messageId

    // 3. Deduplication
    if (msgId && await isAlreadyProcessed(msgId)) {
      return { ok: true, skipped: 'duplicate', phone }
    }

    // 4. Resolve Z-API config
    const zapiConfig = resolveZApiConfig()
    if (!zapiConfig) {
      return { ok: false, error: 'Z-API not configured', phone }
    }

    // 5. Use platform company if no companyId given
    const effectiveCompanyId = companyId ?? process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

    // 6. Upsert conversation
    let conversationId: string
    let isNewConversation = false
    try {
      const existing = effectiveCompanyId ? await getDb()
        .from('whatsapp_conversations')
        .select('id')
        .eq('company_id', effectiveCompanyId)
        .eq('phone', phone)
        .maybeSingle()
        .then(r => r.data)
        : null

      conversationId = effectiveCompanyId
        ? await upsertConversation({
            companyId: effectiveCompanyId,
            phone,
            name:      payload.senderName ?? payload.chatName,
          })
        : `anon-${phone}`

      isNewConversation = !existing
    } catch {
      conversationId = `anon-${phone}`
    }

    // 7. Save incoming message
    if (effectiveCompanyId) {
      await saveMessage({
        conversationId,
        companyId:      effectiveCompanyId,
        phone,
        zapiMessageId:  msgId,
        direction:      'incoming',
        content:        text,
        fromMe:         false,
        aiGenerated:    false,
        rawPayload:     payload as Record<string, unknown>,
      }).catch(() => {})

      await updateAnalytics({
        companyId:  effectiveCompanyId,
        direction:  'in',
        isNew:      isNewConversation,
      })
    }

    // 8. Load context
    const context = effectiveCompanyId
      ? await getRecentContext(conversationId)
      : []

    // 9. Generate AI response
    const aiResult = await generateAIResponse(text, context)

    // 10. Typing simulation
    await sendTypingAndDelay(phone, zapiConfig)

    // 11. Send response via Z-API
    const sendResult = await zapiSendText({
      to:     phone,
      body:   aiResult.text,
      config: zapiConfig,
    })

    if (!sendResult.success) {
      console.error('[WA Engine] Z-API send failed:', sendResult.error)
      if (effectiveCompanyId) {
        await updateAnalytics({ companyId: effectiveCompanyId, direction: 'out', error: true })
      }
      return { ok: false, phone, error: sendResult.error }
    }

    // 12. Save outgoing message
    if (effectiveCompanyId) {
      await saveMessage({
        conversationId,
        companyId:     effectiveCompanyId,
        phone,
        direction:     'outgoing',
        content:       aiResult.text,
        fromMe:        true,
        aiGenerated:   true,
        tokensUsed:    aiResult.tokensUsed,
        processingMs:  Date.now() - startTime,
      }).catch(() => {})

      await updateAnalytics({
        companyId:    effectiveCompanyId,
        direction:    'out',
        tokensUsed:   aiResult.tokensUsed,
        processingMs: aiResult.processingMs,
      })
    }

    return { ok: true, phone, reply: aiResult.text }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[WA Engine] processWhatsAppMessage error:', msg)
    return { ok: false, error: msg }
  }
}

// ── Conversation list (for dashboard) ────────────────────────────

export async function getConversations(companyId: string, limit = 50) {
  const db = getDb()
  const { data } = await db
    .from('whatsapp_conversations')
    .select(`
      id, phone, contact_name, status, last_message_at,
      message_count, ai_enabled, created_at
    `)
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

// ── Message history (for dashboard thread view) ───────────────────

export async function getMessages(conversationId: string, limit = 50) {
  const db = getDb()
  const { data } = await db
    .from('whatsapp_messages')
    .select('id, direction, content, from_me, ai_generated, status, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)
  return data ?? []
}

// ── Analytics (for dashboard) ────────────────────────────────────

export async function getAnalytics(companyId: string, days = 7) {
  const db = getDb()
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data } = await db
    .from('whatsapp_analytics')
    .select('date, messages_in, messages_out, new_conversations, tokens_used, errors, avg_response_ms')
    .eq('company_id', companyId)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: true })
  return data ?? []
}
