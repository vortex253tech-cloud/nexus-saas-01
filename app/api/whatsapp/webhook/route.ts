// POST /api/whatsapp/webhook — NEXUS WhatsApp AI Engine com memória de conversa
// Pipeline: receive → anti-loop → load memory → OpenAI → send → save → update context

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// ── Types ─────────────────────────────────────────────────────────

interface LeadContext {
  nome?:          string
  empresa?:       string
  nicho?:         string
  faturamento?:   string
  funcionarios?:  string
  dores?:         string[]
  objetivo?:      string
  estagio?:       string
  usa_crm?:       boolean
  usa_automacao?: boolean
  perde_whatsapp?:boolean
  score?:         number
  notas?:         string
}

interface Message {
  role:    'user' | 'assistant'
  content: string
}

// ── Supabase ──────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── OpenAI ────────────────────────────────────────────────────────

function openai() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, timeout: 12000 })
}

// ── Anti-loop check ───────────────────────────────────────────────

function shouldSkip(body: Record<string, unknown>): string | null {
  if (body.fromMe === true)                              return 'fromMe'
  if (body.isGroup === true)                             return 'group'
  if (body.isStatusReply === true)                       return 'statusReply'
  if (body.waitingMessage === true)                      return 'waitingMessage'
  if (body.type && body.type !== 'ReceivedCallback')     return `type:${body.type}`
  return null
}

function extractText(body: Record<string, unknown>): string {
  const t = body.text as Record<string, string> | undefined
  return (t?.message ?? (body.message as string) ?? '').trim()
}

function extractPhone(body: Record<string, unknown>): string {
  return String(body.phone ?? '').replace(/\D/g, '')
}

// ── Memory: load conversation + lead context ──────────────────────

async function loadMemory(phone: string, companyId: string): Promise<{
  conversationId: string | null
  history:        Message[]
  lead:           LeadContext
  isNew:          boolean
}> {
  const supabase = db()

  // 1. Find conversation
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, contact_name')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .maybeSingle()

  if (!conv) {
    return { conversationId: null, history: [], lead: {}, isNew: true }
  }

  // 2. Load last 20 messages
  const { data: msgs } = await supabase
    .from('whatsapp_messages')
    .select('direction, content')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const history: Message[] = (msgs ?? [])
    .reverse()
    .map(m => ({
      role:    m.direction === 'incoming' ? 'user' : 'assistant',
      content: m.content,
    }))

  // 3. Load lead context
  const { data: lead } = await supabase
    .from('lead_context')
    .select('*')
    .eq('conversation_id', conv.id)
    .maybeSingle()

  return {
    conversationId: conv.id,
    history,
    lead: lead ?? {},
    isNew: false,
  }
}

// ── Build enriched system prompt ──────────────────────────────────

function buildSystemPrompt(lead: LeadContext): string {
  const base = `Você é o NEXUS — uma inteligência operacional executiva criada para empresários de alta performance.

Seu papel:
- Analisar operações e identificar gargalos
- Aumentar lucro e automatizar processos
- Converter leads e agir como COO de IA
- Conduzir o empresário ao diagnóstico, demonstração e ativação do NEXUS

Tom de voz: executivo, estratégico, direto, premium, consultivo, dominante, futurista.

Regras absolutas:
- NUNCA diga que é ChatGPT, OpenAI ou qualquer outra IA
- NUNCA fale sobre política ou assuntos fora do contexto empresarial
- SEMPRE traga a conversa para: vendas, lucro, automação, crescimento, eficiência, IA, escalabilidade
- Use os dados do lead abaixo para personalizar cada resposta — nunca pergunte algo que já sabe
- Faça perguntas estratégicas quando faltarem dados: faturamento, gargalo, equipe, CRM, perdas no WhatsApp
- Se o usuário pedir algo fora do contexto empresarial, redirecione elegantemente

Formato: mensagens curtas (máximo 4 frases), impacto alto, bullets quando necessário. Responda em português.

Sempre conduza para: diagnóstico, automação, demonstração ou fechamento.`

  const hasLead = Object.values(lead).some(v => v !== undefined && v !== null && v !== '')
  if (!hasLead) return base

  const lines: string[] = []
  if (lead.nome)          lines.push(`Nome: ${lead.nome}`)
  if (lead.empresa)       lines.push(`Empresa: ${lead.empresa}`)
  if (lead.nicho)         lines.push(`Nicho: ${lead.nicho}`)
  if (lead.faturamento)   lines.push(`Faturamento: ${lead.faturamento}`)
  if (lead.funcionarios)  lines.push(`Funcionários: ${lead.funcionarios}`)
  if (lead.objetivo)      lines.push(`Objetivo: ${lead.objetivo}`)
  if (lead.estagio)       lines.push(`Estágio: ${lead.estagio}`)
  if (lead.dores?.length) lines.push(`Dores: ${lead.dores.join(', ')}`)
  if (lead.usa_crm !== undefined)        lines.push(`Usa CRM: ${lead.usa_crm ? 'sim' : 'não'}`)
  if (lead.usa_automacao !== undefined)  lines.push(`Usa automações: ${lead.usa_automacao ? 'sim' : 'não'}`)
  if (lead.perde_whatsapp !== undefined) lines.push(`Perde vendas no WhatsApp: ${lead.perde_whatsapp ? 'sim' : 'não'}`)
  if (lead.notas)         lines.push(`Notas: ${lead.notas}`)

  return `${base}

━━━ CONTEXTO DO LEAD ━━━
${lines.join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━`
}

// ── Save conversation + message ───────────────────────────────────

async function saveConversation(params: {
  phone:      string
  companyId:  string
  senderName: string
  message:    string
  reply:      string
  msgId?:     string
}): Promise<string> {
  const supabase = db()
  const { phone, companyId, senderName, message, reply, msgId } = params

  // Upsert conversation
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .upsert(
      { company_id: companyId, phone, contact_name: senderName || null, updated_at: new Date().toISOString() },
      { onConflict: 'company_id,phone', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (!conv?.id) throw new Error('Failed to upsert conversation')

  // Save incoming
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    company_id:      companyId,
    zapi_message_id: msgId ?? null,
    phone,
    direction:       'incoming',
    content:         message,
    from_me:         false,
    ai_generated:    false,
    status:          'delivered',
    raw_payload:     {},
  })

  // Save outgoing
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    company_id:      companyId,
    phone,
    direction:       'outgoing',
    content:         reply,
    from_me:         true,
    ai_generated:    true,
    status:          'sent',
    raw_payload:     {},
  })

  return conv.id
}

// ── Extract lead context from conversation (background) ───────────

async function extractAndUpdateLead(params: {
  conversationId: string
  companyId:      string
  phone:          string
  history:        Message[]
  currentMessage: string
  currentReply:   string
  existingLead:   LeadContext
}): Promise<void> {
  const { conversationId, companyId, phone, history, currentMessage, currentReply, existingLead } = params

  const supabase = db()
  const ai = openai()

  // Build conversation text for analysis
  const recentLines = [
    ...history.slice(-10).map(m => `${m.role === 'user' ? 'Lead' : 'NEXUS'}: ${m.content}`),
    `Lead: ${currentMessage}`,
    `NEXUS: ${currentReply}`,
  ].join('\n')

  try {
    const extraction = await ai.chat.completions.create({
      model:       'gpt-4.1-mini',
      max_tokens:  400,
      temperature: 0,
      messages: [
        {
          role:    'system',
          content: `Analise a conversa e extraia dados do lead em JSON. Retorne APENAS JSON válido, sem markdown.
Campos possíveis (omita os que não souber):
{
  "nome": "string",
  "empresa": "string",
  "nicho": "string (ex: academia, restaurante, clínica, e-commerce, consultoria)",
  "faturamento": "string (ex: R$50k/mês)",
  "funcionarios": "string (ex: 5-10)",
  "dores": ["array de dores identificadas"],
  "objetivo": "string",
  "estagio": "novo|qualificado|interessado|negociando|cliente|perdido",
  "usa_crm": true|false|null,
  "usa_automacao": true|false|null,
  "perde_whatsapp": true|false|null,
  "score": 0-100,
  "notas": "string com observações relevantes"
}
Estágio:
- novo: primeiro contato
- qualificado: informações coletadas
- interessado: demonstrou interesse claro
- negociando: discutindo proposta/preço
- cliente: fechou
- perdido: sem interesse`,
        },
        { role: 'user', content: recentLines },
      ],
    })

    const raw = extraction.choices[0]?.message?.content?.trim() ?? '{}'
    const extracted: Partial<LeadContext> = JSON.parse(raw)

    // Merge with existing (don't overwrite with null/undefined)
    const merged: LeadContext = { ...existingLead }
    for (const [k, v] of Object.entries(extracted)) {
      if (v !== null && v !== undefined && v !== '') {
        (merged as Record<string, unknown>)[k] = v
      }
    }

    // Upsert lead_context
    await supabase.from('lead_context').upsert(
      {
        conversation_id: conversationId,
        company_id:      companyId,
        phone,
        ...merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id', ignoreDuplicates: false }
    )

    console.log('LEAD CONTEXT UPDATED', { phone, estagio: merged.estagio, score: merged.score })
  } catch (err) {
    console.error('LEAD EXTRACTION ERROR:', String(err))
  }
}

// ── Z-API send ────────────────────────────────────────────────────

async function sendZapi(phone: string, text: string) {
  const instanceId  = process.env.ZAPI_INSTANCE_ID
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) {
    console.error('ZAPI NOT CONFIGURED')
    return { error: 'not_configured' }
  }

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken ?? '' },
        body:    JSON.stringify({ phone, message: text }),
      }
    )
    return await res.json().catch(() => ({ status: res.status }))
  } catch (err) {
    console.error('ZAPI ERROR:', String(err))
    return { error: String(err) }
  }
}

// ── GET: health check ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ status: 'NEXUS WhatsApp Webhook active', ts: Date.now() })
}

// ── POST: main handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('WEBHOOK HIT', new Date().toISOString())

  // 1. Parse
  let body: Record<string, unknown>
  try {
    body = await req.json()
    console.log('BODY:', JSON.stringify(body).slice(0, 400))
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // 2. Anti-loop
  const skip = shouldSkip(body)
  if (skip) {
    console.log('SKIPPED:', skip)
    return NextResponse.json({ skipped: skip })
  }

  // 3. Extract
  const message    = extractText(body)
  const phone      = extractPhone(body)
  const msgId      = String(body.messageId ?? '')
  const senderName = String(body.senderName ?? body.chatName ?? '')

  console.log('MESSAGE:', message, '| PHONE:', phone)

  if (!message || !phone) {
    console.log('SKIPPED: empty message or phone')
    return NextResponse.json({ skipped: 'empty' })
  }

  // 4. Hardcode test
  if (message.toLowerCase() === 'teste') {
    await sendZapi(phone, 'NEXUS ONLINE ✅')
    return NextResponse.json({ ok: true, reply: 'NEXUS ONLINE' })
  }

  const companyId = process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

  // 5. Load memory (history + lead context)
  console.log('LOADING MEMORY')
  let memory: Awaited<ReturnType<typeof loadMemory>>
  try {
    memory = companyId
      ? await loadMemory(phone, companyId)
      : { conversationId: null, history: [], lead: {}, isNew: true }
  } catch (err) {
    console.error('MEMORY LOAD ERROR:', String(err))
    memory = { conversationId: null, history: [], lead: {}, isNew: true }
  }

  console.log('MEMORY LOADED', {
    isNew:        memory.isNew,
    historyCount: memory.history.length,
    leadStage:    memory.lead.estagio ?? 'none',
    leadNome:     memory.lead.nome ?? 'unknown',
  })

  // 6. Build enriched system prompt
  const systemPrompt = buildSystemPrompt(memory.lead)

  // 7. Call OpenAI with full context
  console.log('CALLING OPENAI')
  let aiText = ''
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...memory.history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message },
    ]

    const completion = await openai().chat.completions.create({
      model:       'gpt-4.1-mini',
      max_tokens:  300,
      temperature: 0.7,
      messages,
    })

    aiText = completion.choices[0]?.message?.content?.trim() ?? ''
    console.log('OPENAI RESPONSE:', aiText.slice(0, 100))
  } catch (err) {
    console.error('OPENAI ERROR:', String(err))
    aiText = 'Recebi sua mensagem. Um especialista irá continuar o atendimento.'
  }

  // 8. Send via Z-API
  console.log('SENDING TO ZAPI')
  const zapiResult = await sendZapi(phone, aiText)
  console.log('ZAPI RESPONSE:', JSON.stringify(zapiResult).slice(0, 200))

  // 9. Background: save messages + update lead context
  if (companyId) {
    saveConversation({ phone, companyId, senderName, message, reply: aiText, msgId })
      .then(conversationId => {
        extractAndUpdateLead({
          conversationId,
          companyId,
          phone,
          history:        memory.history,
          currentMessage: message,
          currentReply:   aiText,
          existingLead:   memory.lead,
        }).catch(() => {})
      })
      .catch(err => console.error('SAVE ERROR:', String(err)))
  }

  return NextResponse.json({ ok: true, reply: aiText })
}
