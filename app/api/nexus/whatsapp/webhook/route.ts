// POST /api/nexus/whatsapp/webhook
// Z-API webhook receiver — handles inbound messages, status updates, auto-reply
// Public endpoint (no auth). Verified via ZAPI_WEBHOOK_TOKEN if set.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { getCompanyIdByZapiInstance, getBusinessIdentity } from '@/lib/business-identity'
import { resolveZApiConfig }         from '@/lib/zapi'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── Z-API payload types ───────────────────────────────────────────

interface ZAPIPayload {
  momType?:            string
  type?:               string
  phone?:              string
  fromMe?:             boolean
  messageId?:          string
  zaapId?:             string
  timestamp?:          number
  senderName?:         string
  instanceId?:         string
  status?:             string          // MessageStatusCallback
  profilePictureUrl?:  string | null   // contact photo from Z-API
  text?:       { message?: string }
  image?:      { imageUrl?: string; caption?: string }
  audio?:      { audioUrl?: string }
  document?:   { documentUrl?: string; fileName?: string }
  video?:      { videoUrl?: string; caption?: string }
  sticker?:    { stickerUrl?: string }
  isGroup?:    boolean
}

// ── Extract readable content from Z-API payload ───────────────────

function extractContent(p: ZAPIPayload): string {
  if (p.text?.message)                 return p.text.message
  if (p.image?.caption)                return p.image.caption
  if (p.image?.imageUrl)               return '📷 Imagem'
  if (p.audio?.audioUrl)               return '🎵 Áudio'
  if (p.video?.caption)                return p.video.caption
  if (p.video?.videoUrl)               return '🎥 Vídeo'
  if (p.document?.fileName)            return `📄 ${p.document.fileName}`
  if (p.document?.documentUrl)         return '📄 Documento'
  if (p.sticker?.stickerUrl)           return '🏷️ Sticker'
  return ''
}

function extractMediaUrl(p: ZAPIPayload): string | null {
  return p.image?.imageUrl ?? p.audio?.audioUrl ?? p.video?.videoUrl ?? p.document?.documentUrl ?? null
}

// ── Auto-reply via OpenAI + Z-API ─────────────────────────────────

async function autoReply(
  supabase:    ReturnType<typeof db>,
  convId:      string,
  companyId:   string,
  phone:       string,
  contactName: string | null,
) {
  const identity   = await getBusinessIdentity(companyId)
  const zapiConfig = resolveZApiConfig(
    identity?.zapiInstanceId && identity.zapiToken
      ? { instanceId: identity.zapiInstanceId, token: identity.zapiToken, clientToken: identity.zapiClientToken ?? undefined }
      : null,
  )
  if (!zapiConfig) return
  if (!process.env.OPENAI_API_KEY) return

  // Fetch last 12 messages
  const { data: msgs } = await supabase
    .from('whatsapp_messages')
    .select('direction, content, created_at')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (!msgs?.length) return

  const reversed = [...msgs].reverse()

  // Fetch lead context
  const { data: ctx } = await supabase
    .from('lead_context')
    .select('nome, empresa, nicho, objetivo, dores, estagio, faturamento')
    .eq('conversation_id', convId)
    .maybeSingle()

  // Build system prompt
  let systemPrompt =
    'Você é um assistente de vendas especializado operando via WhatsApp.\n' +
    'Objetivo: qualificar leads, gerar valor e avançar a venda de forma natural.\n' +
    'Regras: responda SEMPRE em português brasileiro, máximo 2-3 linhas, seja direto e humano.\n' +
    'Não use linguagem corporativa. Use emojis com moderação (1 no máximo).'

  if (ctx) {
    const parts: string[] = []
    if (ctx.nome || contactName)       parts.push(`Lead: ${ctx.nome ?? contactName}`)
    if (ctx.empresa)                   parts.push(`Empresa: ${ctx.empresa}`)
    if (ctx.nicho)                     parts.push(`Nicho: ${ctx.nicho}`)
    if (ctx.faturamento)               parts.push(`Faturamento: ${ctx.faturamento}`)
    if (ctx.objetivo)                  parts.push(`Objetivo: ${ctx.objetivo}`)
    if (ctx.estagio)                   parts.push(`Estágio: ${ctx.estagio}`)
    if (ctx.dores?.length)             parts.push(`Dores: ${(ctx.dores as string[]).join(', ')}`)
    if (parts.length)                  systemPrompt += '\n\nContexto do lead:\n' + parts.join('\n')
  }

  const chatHistory = reversed.map(m => ({
    role:    m.direction === 'outgoing' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }))

  let replyText: string | null = null

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages:    [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
          { role: 'user', content: 'Gere a melhor resposta para avançar esta conversa de vendas.' },
        ],
        max_tokens:  180,
        temperature: 0.75,
      }),
      signal: AbortSignal.timeout(18000),
    })
    if (!aiRes.ok) throw new Error(`OpenAI ${aiRes.status}`)
    const aiData = await aiRes.json() as { choices?: { message?: { content?: string } }[] }
    replyText = aiData.choices?.[0]?.message?.content?.trim() ?? null
  } catch (err) {
    console.error('[webhook/auto-reply] OpenAI error:', err)
    return
  }

  if (!replyText) return

  // Send via the company's own Z-API instance (resolved above)
  const { instanceId, token, clientToken } = zapiConfig

  let zapiData: Record<string, unknown> = {}
  try {
    const zapiRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken ?? '' },
        body:    JSON.stringify({ phone, message: replyText }),
        signal:  AbortSignal.timeout(10000),
      },
    )
    if (zapiRes.ok) {
      zapiData = await zapiRes.json().catch(() => ({}))
    } else {
      console.error('[webhook/auto-reply] Z-API error:', zapiRes.status)
      return
    }
  } catch (err) {
    console.error('[webhook/auto-reply] Z-API unreachable:', err)
    return
  }

  const now = new Date().toISOString()

  // Persist AI reply
  await supabase.from('whatsapp_messages').insert({
    conversation_id: convId,
    company_id:      companyId,
    phone,
    direction:       'outgoing',
    content:         replyText,
    from_me:         true,
    ai_generated:    true,
    status:          'sent',
    raw_payload:     { ...zapiData, type: 'text', auto_reply: true },
    zapi_message_id: (zapiData.zaapId ?? zapiData.messageId ?? null) as string | null,
  })

  await supabase
    .from('whatsapp_conversations')
    .update({ last_message_at: now, updated_at: now })
    .eq('id', convId)
}

// ── Trigger background lead analysis (fire-and-forget) ────────────

async function triggerAnalysis(convId: string, baseUrl: string) {
  try {
    await fetch(`${baseUrl}/api/nexus/whatsapp/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.ZAPI_WEBHOOK_TOKEN ?? '' },
      body:    JSON.stringify({ conversation_id: convId, internal: true }),
      signal:  AbortSignal.timeout(5000),
    })
  } catch { /* non-critical */ }
}

// ── Main handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Optional webhook token verification
  const webhookToken = process.env.ZAPI_WEBHOOK_TOKEN
  if (webhookToken) {
    const incomingToken = req.headers.get('x-webhook-token') ?? req.nextUrl.searchParams.get('token')
    if (incomingToken !== webhookToken) {
      console.warn('[webhook] Token mismatch — rejected')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let payload: ZAPIPayload
  try { payload = await req.json() } catch {
    return NextResponse.json({ ok: true }) // ignore malformed
  }

  const eventType = payload.momType ?? payload.type ?? ''

  // ── Ignore groups, sent-by-us callbacks ──────────────────────────
  if (payload.isGroup) return NextResponse.json({ ok: true })
  if (eventType === 'SentCallback')           return NextResponse.json({ ok: true })
  if (eventType === 'ConnectedCallback')      return NextResponse.json({ ok: true })
  if (eventType === 'DisconnectedCallback') {
    console.warn('[webhook] WhatsApp disconnected')
    return NextResponse.json({ ok: true })
  }

  const supabase = db()

  // Multi-tenant routing: the Z-API instanceId in the payload is the only
  // signal this webhook has for which company a message belongs to. Look it
  // up against business_identity (where each company stores their own Z-API
  // credentials); fall back to the platform's own company for instances that
  // haven't configured their own business_identity row yet.
  const companyId = payload.instanceId
    ? (await getCompanyIdByZapiInstance(payload.instanceId)) ?? process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''
    : process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

  if (!companyId) {
    console.error('[webhook] Could not resolve company_id for instance', payload.instanceId)
    return NextResponse.json({ ok: true })
  }

  // ── Status update (delivered / read) ─────────────────────────────
  if (eventType === 'MessageStatusCallback') {
    const msgId  = payload.messageId ?? payload.zaapId
    const status = (payload.status ?? '').toLowerCase()
    if (msgId && (status === 'delivered' || status === 'read')) {
      await supabase
        .from('whatsapp_messages')
        .update({ status })
        .eq('zapi_message_id', msgId)
        .eq('company_id', companyId)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Inbound message ───────────────────────────────────────────────
  if (eventType !== 'ReceivedCallback' && !eventType.includes('Received')) {
    return NextResponse.json({ ok: true })
  }

  const phone    = (payload.phone ?? '').replace(/\D/g, '')
  const fromMe   = payload.fromMe ?? false
  if (!phone || fromMe) return NextResponse.json({ ok: true })

  const content    = extractContent(payload)
  const mediaUrl   = extractMediaUrl(payload)
  const zapiMsgId  = payload.messageId ?? payload.zaapId ?? null
  const senderName = payload.senderName ?? null
  const photoUrl   = payload.profilePictureUrl ?? null
  const now        = new Date().toISOString()

  if (!content && !mediaUrl) return NextResponse.json({ ok: true })

  // ── Upsert conversation ───────────────────────────────────────────
  const { data: existingConv } = await supabase
    .from('whatsapp_conversations')
    .select('id, ai_enabled, message_count')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .maybeSingle()

  let convId: string
  if (existingConv) {
    convId = existingConv.id
    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message_at: now,
        updated_at:      now,
        message_count:   (existingConv.message_count ?? 0) + 1,
        ...(senderName ? { contact_name: senderName } : {}),
        ...(photoUrl   ? { photo_url: photoUrl }       : {}),
      })
      .eq('id', convId)

    // Increment unread_count (best-effort, non-critical)
    void (async () => {
      try {
        const { data } = await supabase.from('whatsapp_conversations')
          .select('unread_count').eq('id', convId).single()
        if (data) {
          await supabase.from('whatsapp_conversations')
            .update({ unread_count: (data.unread_count ?? 0) + 1 })
            .eq('id', convId)
        }
      } catch { /* non-critical */ }
    })()
  } else {
    const { data: newConv, error: convErr } = await supabase
      .from('whatsapp_conversations')
      .insert({
        company_id:      companyId,
        phone,
        contact_name:    senderName,
        photo_url:       photoUrl,
        status:          'active',
        ai_enabled:      true,
        last_message_at: now,
        updated_at:      now,
        created_at:      now,
        message_count:   1,
        unread_count:    1,
      })
      .select('id')
      .single()

    if (convErr || !newConv) {
      console.error('[webhook] Failed to create conversation:', convErr)
      return NextResponse.json({ ok: true })
    }
    convId = newConv.id
  }

  // ── Deduplicate by zapi_message_id ────────────────────────────────
  if (zapiMsgId) {
    const { data: exists } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('zapi_message_id', zapiMsgId)
      .maybeSingle()
    if (exists) return NextResponse.json({ ok: true }) // already processed
  }

  // ── Persist inbound message ───────────────────────────────────────
  const messageType = payload.image ? 'image' : payload.audio ? 'audio' : payload.video ? 'video' : payload.document ? 'document' : 'text'

  await supabase.from('whatsapp_messages').insert({
    conversation_id: convId,
    company_id:      companyId,
    phone,
    direction:       'incoming',
    content:         content || '📎 Mídia',
    from_me:         false,
    ai_generated:    false,
    status:          'received',
    raw_payload:     {
      ...payload,
      media_url:    mediaUrl,
      message_type: messageType,
    },
    zapi_message_id: zapiMsgId,
    created_at:      payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : now,
  })

  // Increment unread (try RPC, fall back to direct update)
  const { error: rpcErr } = await supabase.rpc('increment_unread', { conv_id: convId })
  if (rpcErr) {
    await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: (existingConv?.message_count ?? 0) + 1 })
      .eq('id', convId)
  }

  // ── Auto-reply if AI enabled ──────────────────────────────────────
  const aiEnabled = existingConv?.ai_enabled ?? true // new convs default to AI on

  if (aiEnabled) {
    await autoReply(supabase, convId, companyId, phone, senderName)
  }

  // ── Trigger lead analysis (non-blocking, best effort) ─────────────
  const origin = req.headers.get('origin') ?? req.headers.get('host') ?? ''
  const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`
  triggerAnalysis(convId, baseUrl).catch(() => {})

  return NextResponse.json({ ok: true })
}
