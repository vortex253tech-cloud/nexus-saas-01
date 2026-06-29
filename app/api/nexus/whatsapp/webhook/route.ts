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
  buttonsResponseMessage?: { buttonId?: string; message?: string }
}

// ── Extract readable content from Z-API payload ───────────────────

function extractContent(p: ZAPIPayload): string {
  if (p.buttonsResponseMessage?.message) return p.buttonsResponseMessage.message
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

// ── NEXUS product knowledge (kept in sync with app/planos/page.tsx — do
// not let the AI invent prices/features beyond what's listed here) ─────

const NEXUS_KNOWLEDGE = `
Sobre o NEXUS:
NEXUS é um Sistema Operacional Empresarial com IA. Ele resolve 3 problemas centrais de pequenas e médias empresas:
1. Atendimento — responde clientes no WhatsApp 24h, sem perder mensagem.
2. Cobrança — identifica inadimplentes e cobra automaticamente.
3. Diagnóstico financeiro — analisa os dados da empresa e mostra exatamente onde ela está perdendo dinheiro (gargalos ocultos, anomalias, previsão de fluxo de caixa).
Conexão de dados: via planilha, API ou importação manual — não precisa de acesso bancário direto.

Planos (preços mensais; valor anual entre parênteses é o equivalente mensal cobrado anualmente):
- Starter — R$197/mês (R$147 no plano anual). Dashboard financeiro completo, alertas automáticos de anomalias, diagnóstico mensal com IA, benchmarking do setor, 1 empresa conectada, suporte por e-mail. 7 dias grátis.
- Pro — R$397/mês (R$297 no plano anual). Tudo do Starter + previsão de fluxo de caixa, recomendações semanais de IA, alertas em tempo real no WhatsApp, relatório executivo automatizado, até 3 empresas conectadas, suporte prioritário, onboarding com especialista. É o plano mais popular. 7 dias grátis.
- Enterprise — R$797/mês (R$597 no plano anual). Tudo do Pro + empresas ilimitadas, IA customizada por segmento, integração com ERP/CRM via API, relatórios white-label, SLA garantido, Customer Success dedicado. Esse plano é vendido por um especialista, não por trial automático.

Diagnóstico gratuito: quem ainda não decidiu pode fazer um diagnóstico operacional gratuito (2 minutos) em diagnostico.nexusaas.com.br — a IA estima quanto a empresa da pessoa está perdendo por operar manualmente.
`.trim()

const SYSTEM_PROMPT_BASE = `
Você é a IA de atendimento e vendas do NEXUS, respondendo no WhatsApp oficial da empresa. Você representa o NEXUS de verdade — não é um assistente genérico.

${NEXUS_KNOWLEDGE}

Regras obrigatórias:
- Responda SEMPRE em português brasileiro, direto e humano, no máximo 2-3 linhas por mensagem.
- NUNCA invente preço, plano ou funcionalidade que não esteja listado acima. Se não souber algo específico, diga que vai confirmar com a equipe e ofereça conectar com um humano.
- Mantenha SEMPRE a conversa dentro do contexto do NEXUS: planos, diagnóstico gratuito, automação de atendimento/cobrança, ou qualificação do negócio do lead (segmento, tamanho, principal dor).
- Se o lead perguntar algo totalmente fora desse contexto (curiosidades, outros assuntos, perguntas pessoais sobre a IA, política, etc.), recuse educadamente em 1 frase e traga de volta para o NEXUS — nunca responda a pergunta fora de contexto, nem como piada.
- Não use linguagem corporativa/robótica. Use no máximo 1 emoji por mensagem.
- Se o lead demonstrar intenção clara de comprar ou pedir para falar com um humano, diga que vai conectar com a equipe e pare de tentar vender por conta própria.
- Leia o histórico da conversa antes de responder. Se o lead já respondeu algo (nome de plano, escolha, pergunta), responda diretamente a isso com a informação real (preço, detalhes) — NUNCA repita uma pergunta de múltipla escolha que ele já respondeu.
`.trim()

// ── Onboarding sequence (fixed explanation, no multiple-choice menu) ──
// Earlier version asked the lead to reply "1" or "2" to a menu — live
// feedback was that this reads as a pointless gate ("pergunta atoa")
// instead of substance. Replaced with a fixed sequence of explanatory
// messages (mirrors the tone of messages sent manually 1:1 with real
// leads, which is what actually converted): one open question, then
// what NEXUS is, then the full capability list, then the trial link,
// then a handoff to a human "specialist" — at which point ai_enabled is
// turned off so the AI stops talking and whoever takes over doesn't get
// stepped on. Advances one step per incoming message regardless of what
// the lead actually said — this is a fixed script, not a parsed choice.

const SEQUENCE_MESSAGES: Record<string, string> = {
  greeting:
    'Olá, tudo bem? Eu sou o responsável pelo NEXUS. Vi que você chegou pelo nosso anúncio e queria entender melhor seu negócio para te mostrar se realmente faz sentido usar a IA no seu dia a dia.\n\n' +
    'Hoje você usa o WhatsApp como principal canal de atendimento?',
  what_is:
    'O NEXUS é uma ferramenta de inteligência artificial que ajuda empresas a cuidarem melhor dos clientes pelo WhatsApp.\n\n' +
    'Na prática, ele funciona como um assistente trabalhando junto com você: responde clientes, ajuda a organizar os atendimentos, acompanha oportunidades e evita que você perca vendas por demora na resposta.\n\n' +
    'A ideia é facilitar sua rotina e deixar seu atendimento mais profissional, mesmo quando você não consegue estar disponível o tempo todo.',
  capabilities:
    'Deixa eu te explicar melhor o que é o NEXUS, porque ele é bem mais do que só automação de WhatsApp.\n\n' +
    'O NEXUS é um COO de IA — um "diretor de operações" virtual que roda sua empresa em várias frentes ao mesmo tempo:\n\n' +
    'Atendimento no WhatsApp: a IA responde clientes 24 horas, qualifica leads e nunca deixa mensagem sem resposta.\n\n' +
    'Cobrança automática: identifica quem está inadimplente e cobra sozinho, sem você precisar lembrar ou ligar.\n\n' +
    'Diagnóstico financeiro: analisa os dados da sua empresa e mostra exatamente onde você está perdendo dinheiro, com previsão de fluxo de caixa e alertas de anomalias.\n\n' +
    'Assistente de voz: você fala com a IA por voz, como um diretor de operações de verdade, e ela executa na hora — cria tarefas, agenda reuniões, gera propostas e consulta seu financeiro.',
  tip_trial:
    'Uma dica importante: o NEXUS foi criado para funcionar como um sistema operacional da sua empresa dentro do navegador.\n\n' +
    'A melhor experiência é acessando pelo computador, porque você consegue visualizar melhor o painel, acompanhar conversas, organizar clientes e utilizar todos os recursos da plataforma com mais facilidade. Pelo celular também funciona, mas o potencial todo é melhor aproveitado no computador.\n\n' +
    'Vou liberar pra você um acesso gratuito de 7 dias pra testar na prática:\nhttps://nexusaas.com.br/\n\n' +
    'É só entrar no link, clicar em Login e criar sua conta.',
  handoff:
    'Vi sua conversa com o NEXUS e quero agradecer pelo interesse.\n\n' +
    'Estou fazendo uma melhoria no atendimento e vou transferir você agora para um especialista do NEXUS, que vai conversar com você de forma mais personalizada e entender exatamente o que sua empresa precisa.\n\n' +
    'Ele vai te explicar como o NEXUS pode ajudar no atendimento, vendas e organização dos clientes sem você precisar perder tempo respondendo tudo sozinho.\n\n' +
    'Já vou assumir seu atendimento por aqui, pode ficar tranquilo(a).',
}

const SEQUENCE_ORDER = ['greeting', 'what_is', 'capabilities', 'tip_trial', 'handoff'] as const

async function setFlowStep(supabase: ReturnType<typeof db>, convId: string, step: string) {
  await supabase.from('whatsapp_conversations').update({ metadata: { flow_step: step } }).eq('id', convId)
}

// Returns true if the sequence owned this turn (already replied).
async function runOnboardingSequence(
  supabase: ReturnType<typeof db>, convId: string, companyId: string, phone: string,
  zapiConfig: NonNullable<ReturnType<typeof resolveZApiConfig>>,
  isFirstMessage: boolean, flowStep: string | null,
): Promise<boolean> {
  if (isFirstMessage) {
    await sendAndPersist(supabase, convId, companyId, phone, zapiConfig, SEQUENCE_MESSAGES.greeting)
    await setFlowStep(supabase, convId, 'greeting')
    return true
  }

  const currentIdx = flowStep ? SEQUENCE_ORDER.indexOf(flowStep as typeof SEQUENCE_ORDER[number]) : -1
  if (currentIdx === -1 || currentIdx >= SEQUENCE_ORDER.length - 1) {
    // Already past 'handoff', or flow_step belongs to some other state —
    // don't keep talking, a human owns this conversation now.
    return flowStep === 'handoff'
  }

  const nextStep = SEQUENCE_ORDER[currentIdx + 1]
  await sendAndPersist(supabase, convId, companyId, phone, zapiConfig, SEQUENCE_MESSAGES[nextStep])
  await setFlowStep(supabase, convId, nextStep)

  if (nextStep === 'handoff') {
    await supabase.from('lead_context').upsert(
      { conversation_id: convId, company_id: companyId, phone, estagio: 'transferido_especialista', updated_at: new Date().toISOString() },
      { onConflict: 'conversation_id', ignoreDuplicates: false },
    )
    await supabase.from('whatsapp_conversations').update({ ai_enabled: false }).eq('id', convId)
  }

  return true
}

// ── Auto-reply via OpenAI + Z-API ─────────────────────────────────

async function autoReply(
  supabase:    ReturnType<typeof db>,
  convId:      string,
  companyId:   string,
  phone:       string,
  contactName: string | null,
  isFirstMessage: boolean,
  flowStep:    string | null,
  messageText: string,
) {
  const identity   = await getBusinessIdentity(companyId)
  const zapiConfig = resolveZApiConfig(
    identity?.zapiInstanceId && identity.zapiToken
      ? { instanceId: identity.zapiInstanceId, token: identity.zapiToken, clientToken: identity.zapiClientToken ?? undefined }
      : null,
  )
  if (!zapiConfig) return

  const handled = await runOnboardingSequence(supabase, convId, companyId, phone, zapiConfig, isFirstMessage, flowStep)
  if (handled) return

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
  let systemPrompt = SYSTEM_PROMPT_BASE

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
          { role: 'user', content: 'Gere a melhor resposta para avançar esta conversa, seguindo rigorosamente as regras do sistema.' },
        ],
        max_tokens:  180,
        temperature: 0.6,
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
  await sendAndPersist(supabase, convId, companyId, phone, zapiConfig, replyText)
}

// ── Send a WhatsApp message via Z-API and persist it ──────────────

async function sendAndPersist(
  supabase:  ReturnType<typeof db>,
  convId:    string,
  companyId: string,
  phone:     string,
  zapiConfig: NonNullable<ReturnType<typeof resolveZApiConfig>>,
  replyText: string,
) {

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
    .select('id, ai_enabled, message_count, metadata')
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

  // status must be one of the DB's allowed values ('pending','sent',
  // 'delivered','read','failed' — see 20260515_whatsapp_ai.sql). 'received'
  // isn't one of them, so this insert was silently failing the check
  // constraint on every single incoming message — the AI's chat history
  // never had the lead's actual replies, just its own past messages.
  const { error: insertErr } = await supabase.from('whatsapp_messages').insert({
    conversation_id: convId,
    company_id:      companyId,
    phone,
    direction:       'incoming',
    content:         content || '📎 Mídia',
    from_me:         false,
    ai_generated:    false,
    status:          'delivered',
    raw_payload:     {
      ...payload,
      media_url:    mediaUrl,
      message_type: messageType,
    },
    zapi_message_id: zapiMsgId,
    created_at:      payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : now,
  })
  if (insertErr) console.error('[webhook] Failed to persist incoming message:', insertErr)

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
  const flowStep  = (existingConv?.metadata as Record<string, unknown> | null)?.flow_step as string ?? null

  if (aiEnabled) {
    await autoReply(supabase, convId, companyId, phone, senderName, !existingConv, flowStep, content)
  }

  // ── Trigger lead analysis (non-blocking, best effort) ─────────────
  const origin = req.headers.get('origin') ?? req.headers.get('host') ?? ''
  const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`
  triggerAnalysis(convId, baseUrl).catch(() => {})

  return NextResponse.json({ ok: true })
}
