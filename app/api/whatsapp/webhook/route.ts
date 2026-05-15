// POST /api/whatsapp/webhook — NEXUS WhatsApp AI Engine (debug mode)
// Processes inline (no fire-and-forget) to survive Vercel serverless lifecycle.

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// ── Quick anti-loop check ─────────────────────────────────────────
function shouldSkip(body: Record<string, unknown>): string | null {
  if (body.fromMe === true)                                    return 'fromMe'
  if (body.isGroup === true)                                   return 'group'
  if (body.isStatusReply === true)                             return 'statusReply'
  if (body.waitingMessage === true)                            return 'waitingMessage'
  if (body.type && body.type !== 'ReceivedCallback')           return `type:${body.type}`
  return null
}

// ── Extract text from any Z-API payload shape ─────────────────────
function extractText(body: Record<string, unknown>): string {
  const t = body.text as Record<string, string> | undefined
  return (
    t?.message ??
    (body.message as string) ??
    (body.body as string) ??
    ''
  ).trim()
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

  // ── 1. Parse body ─────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
    console.log('BODY:', JSON.stringify(body).slice(0, 500))
  } catch (err) {
    console.error('PARSE ERROR:', err)
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // ── 2. Anti-loop ──────────────────────────────────────────────
  const skipReason = shouldSkip(body)
  if (skipReason) {
    console.log('SKIPPED:', skipReason)
    return NextResponse.json({ skipped: skipReason })
  }

  // ── 3. Extract message & phone ────────────────────────────────
  const message = extractText(body)
  const phone   = String(body.phone ?? '').replace(/\D/g, '')

  console.log('MESSAGE:', message)
  console.log('PHONE:', phone)

  if (!message) {
    console.log('SKIPPED: empty message')
    return NextResponse.json({ skipped: 'empty' })
  }
  if (!phone) {
    console.log('SKIPPED: no phone')
    return NextResponse.json({ skipped: 'no_phone' })
  }

  // ── 4. Hardcode test ──────────────────────────────────────────
  if (message.toLowerCase() === 'teste') {
    console.log('TEST MESSAGE — sending hardcoded response')
    await sendZapi(phone, 'NEXUS ONLINE ✅')
    return NextResponse.json({ ok: true, reply: 'NEXUS ONLINE' })
  }

  // ── 5. Call OpenAI ────────────────────────────────────────────
  console.log('CALLING OPENAI')
  let aiText = ''
  try {
    const openai = new OpenAI({
      apiKey:  process.env.OPENAI_API_KEY!,
      timeout: 12000,
    })

    const completion = await openai.chat.completions.create({
      model:       'gpt-4.1-mini',
      max_tokens:  300,
      temperature: 0.7,
      messages: [
        {
          role:    'system',
          content: `Você é o NEXUS — uma inteligência operacional executiva criada para empresários de alta performance.

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

Responda em português. Máximo 3-4 frases curtas por mensagem.`,
        },
        { role: 'user', content: message },
      ],
    })

    aiText = completion.choices[0]?.message?.content?.trim() ?? ''
    console.log('OPENAI RESPONSE:', aiText)
  } catch (err) {
    console.error('OPENAI ERROR:', String(err))
    aiText = 'Recebi sua mensagem. Um especialista irá continuar o atendimento.'
  }

  // ── 6. Send via Z-API ─────────────────────────────────────────
  console.log('SENDING TO ZAPI', { phone, preview: aiText.slice(0, 60) })
  const zapiResult = await sendZapi(phone, aiText)
  console.log('ZAPI RESPONSE:', JSON.stringify(zapiResult).slice(0, 300))

  // ── 7. Background: save to Supabase (non-blocking best-effort) ─
  saveToSupabase(phone, message, aiText).catch(e =>
    console.error('SUPABASE SAVE ERROR:', String(e))
  )

  return NextResponse.json({ ok: true, reply: aiText })
}

// ── Z-API send helper ─────────────────────────────────────────────
async function sendZapi(phone: string, text: string) {
  const instanceId   = process.env.ZAPI_INSTANCE_ID
  const token        = process.env.ZAPI_TOKEN
  const clientToken  = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) {
    console.error('ZAPI NOT CONFIGURED — missing ZAPI_INSTANCE_ID or ZAPI_TOKEN')
    return { error: 'not_configured' }
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`
  console.log('ZAPI URL:', url)

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Client-Token':  clientToken ?? '',
      },
      body: JSON.stringify({ phone, message: text }),
    })

    const data = await res.json().catch(() => ({ status: res.status }))
    return data
  } catch (err) {
    console.error('ZAPI FETCH ERROR:', String(err))
    return { error: String(err) }
  }
}

// ── Supabase save (fire-and-forget, non-critical) ─────────────────
async function saveToSupabase(phone: string, incoming: string, outgoing: string) {
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const companyId = process.env.NEXUS_PLATFORM_COMPANY_ID
  if (!companyId) return

  // upsert conversation
  const { data: conv } = await db
    .from('whatsapp_conversations')
    .upsert({ company_id: companyId, phone, updated_at: new Date().toISOString() },
             { onConflict: 'company_id,phone', ignoreDuplicates: false })
    .select('id')
    .single()

  if (!conv?.id) return

  await db.from('whatsapp_messages').insert([
    { conversation_id: conv.id, company_id: companyId, phone,
      direction: 'incoming', content: incoming, from_me: false, ai_generated: false },
    { conversation_id: conv.id, company_id: companyId, phone,
      direction: 'outgoing', content: outgoing, from_me: true, ai_generated: true },
  ])
}
