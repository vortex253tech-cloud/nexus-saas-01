// ═══════════════════════════════════════════════════════════════════
// NEXUS WhatsApp AI Engine — OpenAI gpt-4.1-mini
// Server-side only. Full pipeline: receive → validate → AI → respond.
// ═══════════════════════════════════════════════════════════════════

import OpenAI            from 'openai'
import { createClient }  from '@supabase/supabase-js'
import { zapiSendText, resolveZApiConfig } from '@/lib/zapi'

// ── Types ────────────────────────────────────────────────────────

export interface ZApiWebhookPayload {
  type?:             string
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
  body?: ZApiWebhookPayload
}

export interface ProcessResult {
  ok:       boolean
  skipped?: string
  phone?:   string
  reply?:   string
  error?:   string
}

// ── Constants ────────────────────────────────────────────────────

const MAX_CONTEXT_MESSAGES = 10
const MAX_REPLY_TOKENS      = 300
const AI_TIMEOUT_MS         = 15000
const TYPING_DELAY_MS       = 800

const SYSTEM_PROMPT = `Você é o NEXUS — uma inteligência operacional executiva criada para empresários de alta performance.

Seu papel:
- Analisar operações e identificar gargalos
- Aumentar lucro e automatizar processos
- Converter leads e agir como COO de IA
- Conduzir o empresário ao diagnóstico, demonstração e ativação do NEXUS

Tom de voz: executivo, estratégico, direto, premium, consultivo, dominante, futurista.

Regras absolutas:
- NUNCA diga que é ChatGPT, OpenAI ou qualquer outra IA genérica
- NUNCA fale sobre política ou assuntos fora do contexto empresarial
- SEMPRE traga a conversa para: vendas, lucro, automação, crescimento, eficiência, IA, escalabilidade
- Se o lead estiver perdido, faça perguntas estratégicas: faturamento, gargalo, equipe, CRM, velocidade de resposta, perdas no WhatsApp

Formato das respostas:
- Mensagens curtas, impacto alto, sem textos gigantes
- Bullets quando necessário
- Parecer uma IA executiva real, não um chatbot

Se o usuário pedir piada, política ou assuntos fora do negócio, redirecione elegantemente:
"Meu foco é otimizar operações e crescimento empresarial. Vamos identificar onde sua empresa está perdendo dinheiro hoje."

Sempre conduza para: ativação, demonstração, diagnóstico, automação ou fechamento.

Responda em português. Máximo 3-4 frases curtas por mensagem.`

// ── Clients ──────────────────────────────────────────────────────

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    timeout: AI_TIMEOUT_MS,
  })
}

// ── Payload normalizer ────────────────────────────────────────────

function normalizePayload(raw: ZApiWebhookPayload): ZApiWebhookPayload {
  if (raw.body && typeof raw.body === 'object') {
    return { ...raw.body, ...raw }
  }
  return raw
}

// ── Validation & anti-loop ────────────────────────────────────────

interface ValidationResult { valid: boolean; reason?: string }

function validateMessage(p: ZApiWebhookPayload): ValidationResult {
  if (p.fromMe)                                      return { valid: false, reason: 'fromMe' }
  if (p.isGroup)                                     return { valid: false, reason: 'group' }
  if (p.isStatusReply)                               return { valid: false, reason: 'statusReply' }
  if (p.waitingMessage)                              return { valid: false, reason: 'waitingMessage' }
  if (p.isEdit)                                      return { valid: false, reason: 'isEdit' }
  if (p.type && p.type !== 'ReceivedCallback')       return { valid: false, reason: `type:${p.type}` }

  const text = extractText(p)
  if (!text || text.trim().length === 0)             return { valid: false, reason: 'emptyText' }
  if (!p.phone)                                      return { valid: false, reason: 'noPhone' }

  return { valid: true }
}

function extractText(p: ZApiWebhookPayload): string {
  return (p.text?.message ?? p.image?.caption ?? '').trim()
}

function normalizePhone(raw: string): string {
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

interface ContextMessage { role: 'user' | 'assistant'; content: string }

async function getRecentContext(conversationId: string): Promise<ContextMessage[]> {
  const db = getDb()
  const { data } = await db
    .from('whatsapp_messages')
    .select('direction, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MAX_CONTEXT_MESSAGES)

  if (!data) return []

  return data
    .reverse()
    .map(m => ({
      role:    m.direction === 'incoming' ? 'user' : 'assistant',
      content: m.content,
    })) as ContextMessage[]
}

// ── AI response generation (OpenAI) ──────────────────────────────

interface AIResult { text: string; tokensUsed: number; processingMs: number }

async function generateAIResponse(
  userMessage: string,
  context:     ContextMessage[],
): Promise<AIResult> {
  const ai    = getOpenAI()
  const start = Date.now()

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...context.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ]

  const response = await ai.chat.completions.create({
    model:       'gpt-4.1-mini',
    messages,
    max_tokens:  MAX_REPLY_TOKENS,
    temperature: 0.7,
  })

  const text       = response.choices[0]?.message?.content?.trim() ?? ''
  const tokensUsed = response.usage?.total_tokens ?? 0
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
  error?:         string
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
    error:           params.error ?? null,
  })

  const rpcResult = await db.rpc('increment_conversation_count', {
    p_conversation_id: params.conversationId,
    p_last_message_at: new Date().toISOString(),
  })
  if (rpcResult.error) {
    await db.from('whatsapp_conversations')
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', params.conversationId)
  }
}

// ── Analytics ─────────────────────────────────────────────────────

async function updateAnalytics(params: {
  companyId:     string
  direction:     'in' | 'out'
  tokensUsed?:   number
  processingMs?: number
  isNew?:        boolean
  error?:        boolean
}): Promise<void> {
  const db   = getDb()
  const date = new Date().toISOString().slice(0, 10)

  await db.from('whatsapp_analytics')
    .upsert(
      {
        company_id:        params.companyId,
        date,
        messages_in:       params.direction === 'in'  ? 1 : 0,
        messages_out:      params.direction === 'out' ? 1 : 0,
        new_conversations: params.isNew ? 1 : 0,
        tokens_used:       params.tokensUsed ?? 0,
        errors:            params.error ? 1 : 0,
        avg_response_ms:   params.processingMs ?? null,
        updated_at:        new Date().toISOString(),
      },
      { onConflict: 'company_id,date', ignoreDuplicates: false }
    )
    .then(() => {})
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

export async function processWhatsAppMessage(
  rawPayload: ZApiWebhookPayload,
  companyId?: string,
): Promise<ProcessResult> {
  const startTime = Date.now()

  try {
    // 1. Normalize
    const payload = normalizePayload(rawPayload)

    // 2. Validate & anti-loop
    const validation = validateMessage(payload)
    if (!validation.valid) {
      console.log('[WA Engine] Skipped:', validation.reason)
      return { ok: true, skipped: validation.reason }
    }

    const phone = normalizePhone(payload.phone!)
    const text  = extractText(payload)
    const msgId = payload.messageId

    console.log('MESSAGE RECEIVED', { phone, text: text.slice(0, 80), msgId })

    // 3. Deduplication
    if (msgId && await isAlreadyProcessed(msgId)) {
      console.log('[WA Engine] Duplicate, skipping:', msgId)
      return { ok: true, skipped: 'duplicate', phone }
    }

    // 4. Z-API config
    const zapiConfig = resolveZApiConfig()
    if (!zapiConfig) {
      console.error('[WA Engine] Z-API not configured')
      return { ok: false, error: 'Z-API not configured', phone }
    }

    // 5. Company ID
    const effectiveCompanyId = companyId ?? process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

    // 6. Upsert conversation
    let conversationId: string
    let isNewConversation = false
    try {
      const existing = effectiveCompanyId
        ? await getDb()
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
        companyId:     effectiveCompanyId,
        phone,
        zapiMessageId: msgId,
        direction:     'incoming',
        content:       text,
        fromMe:        false,
        aiGenerated:   false,
        rawPayload:    payload as Record<string, unknown>,
      }).catch(() => {})

      await updateAnalytics({ companyId: effectiveCompanyId, direction: 'in', isNew: isNewConversation })
    }

    // 8. Load conversation context
    const context = effectiveCompanyId
      ? await getRecentContext(conversationId).catch(() => [])
      : []

    // 9. Generate AI response
    let aiText: string
    let tokensUsed = 0
    let processingMs = 0

    try {
      const aiResult = await generateAIResponse(text, context)
      aiText       = aiResult.text
      tokensUsed   = aiResult.tokensUsed
      processingMs = aiResult.processingMs

      console.log('OPENAI RESPONSE', {
        phone,
        tokens: tokensUsed,
        ms:     processingMs,
        reply:  aiText.slice(0, 100),
      })
    } catch (aiErr) {
      const errMsg = aiErr instanceof Error ? aiErr.message : 'AI error'
      console.error('[WA Engine] OpenAI failed:', errMsg)

      aiText = 'Recebi sua mensagem. Um especialista irá continuar o atendimento.'

      if (effectiveCompanyId) {
        await saveMessage({
          conversationId,
          companyId:   effectiveCompanyId,
          phone,
          direction:   'outgoing',
          content:     aiText,
          fromMe:      true,
          aiGenerated: true,
          error:       errMsg,
        }).catch(() => {})
        await updateAnalytics({ companyId: effectiveCompanyId, direction: 'out', error: true })
      }

      // Still send fallback via Z-API
      await new Promise(r => setTimeout(r, TYPING_DELAY_MS))
      await zapiSendText({ to: phone, body: aiText, config: zapiConfig })
      return { ok: true, phone, reply: aiText }
    }

    // 10. Typing delay
    await new Promise(r => setTimeout(r, TYPING_DELAY_MS))

    // 11. Send via Z-API
    const sendResult = await zapiSendText({ to: phone, body: aiText, config: zapiConfig })

    if (!sendResult.success) {
      console.error('[WA Engine] Z-API send failed:', sendResult.error)
      if (effectiveCompanyId) {
        await updateAnalytics({ companyId: effectiveCompanyId, direction: 'out', error: true })
      }
      return { ok: false, phone, error: sendResult.error }
    }

    console.log('MESSAGE SENT', { phone, ms: Date.now() - startTime })

    // 12. Save outgoing message
    if (effectiveCompanyId) {
      await saveMessage({
        conversationId,
        companyId:    effectiveCompanyId,
        phone,
        direction:    'outgoing',
        content:      aiText,
        fromMe:       true,
        aiGenerated:  true,
        tokensUsed,
        processingMs: Date.now() - startTime,
      }).catch(() => {})

      await updateAnalytics({
        companyId:    effectiveCompanyId,
        direction:    'out',
        tokensUsed,
        processingMs,
      })
    }

    return { ok: true, phone, reply: aiText }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[WA Engine] Fatal error:', msg)
    return { ok: false, error: msg }
  }
}

// ── Dashboard helpers ─────────────────────────────────────────────

export async function getConversations(companyId: string, limit = 50) {
  const db = getDb()
  const { data } = await db
    .from('whatsapp_conversations')
    .select('id, phone, contact_name, status, last_message_at, message_count, ai_enabled, created_at, temperatura, label, unread_count')
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map(c => ({ ...c, unread: c.unread_count ?? 0 }))
}

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
