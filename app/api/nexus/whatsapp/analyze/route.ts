// POST /api/nexus/whatsapp/analyze
// Auto-populate lead_context from conversation messages via OpenAI
// Called internally by webhook (fire-and-forget) or manually

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  // Allow internal calls from webhook (using webhook token) OR authenticated users
  const webhookToken = process.env.ZAPI_WEBHOOK_TOKEN
  const incomingSecret = req.headers.get('x-webhook-secret')
  const isInternal = webhookToken ? incomingSecret === webhookToken : false

  if (!isInternal) {
    // Fall back to checking for any valid service-role header or skip auth for now
    // In production, add proper auth check here
  }

  let body: { conversation_id?: string; internal?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { conversation_id } = body
  if (!conversation_id) {
    return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'no_openai_key' })
  }

  const supabase = db()
  const companyId = process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

  if (!companyId) {
    return NextResponse.json({ error: 'NEXUS_PLATFORM_COMPANY_ID not set' }, { status: 503 })
  }

  // Verify conversation exists
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, phone, contact_name')
    .eq('id', conversation_id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // Check if we already have context (skip if analyzed recently)
  const { data: existing } = await supabase
    .from('lead_context')
    .select('updated_at')
    .eq('conversation_id', conversation_id)
    .maybeSingle()

  // Rate-limit: don't re-analyze if updated in last 5 minutes
  if (existing?.updated_at) {
    const lastUpdate = new Date(existing.updated_at).getTime()
    if (Date.now() - lastUpdate < 5 * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: 'recent_analysis' })
    }
  }

  // Fetch last 20 inbound messages for analysis
  const { data: msgs } = await supabase
    .from('whatsapp_messages')
    .select('direction, content, created_at')
    .eq('conversation_id', conversation_id)
    .eq('direction', 'incoming')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!msgs?.length) {
    return NextResponse.json({ ok: true, skipped: 'no_messages' })
  }

  const transcript = msgs
    .reverse()
    .map(m => `[Lead]: ${m.content}`)
    .join('\n')

  const systemPrompt = `Você é um analista de CRM. Analise a conversa abaixo e extraia informações sobre o lead.
Responda APENAS com um JSON válido (sem markdown, sem texto extra) com estes campos:
{
  "nome": "string ou null",
  "empresa": "string ou null",
  "nicho": "string ou null (ex: e-commerce, saas, consultoria)",
  "objetivo": "string ou null (o que o lead quer alcançar)",
  "dores": ["array de strings ou vazio"],
  "estagio": "string ou null (ex: descoberta, consideração, decisão, cliente)",
  "faturamento": "string ou null (ex: R$50k/mês, acima de R$1M/ano)"
}
Se não houver informação suficiente para um campo, use null (ou [] para dores).`

  let extracted: Record<string, unknown> = {}

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
          { role: 'user',   content: `Transcrição:\n${transcript}` },
        ],
        max_tokens:  400,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!aiRes.ok) throw new Error(`OpenAI ${aiRes.status}`)
    const aiData = await aiRes.json() as { choices?: { message?: { content?: string } }[] }
    const raw = aiData.choices?.[0]?.message?.content?.trim() ?? '{}'
    extracted = JSON.parse(raw)
  } catch (err) {
    console.error('[analyze] OpenAI error:', err)
    return NextResponse.json({ ok: true, skipped: 'openai_error' })
  }

  // Only upsert fields that are non-null
  const now = new Date().toISOString()
  const upsertData: Record<string, unknown> = {
    conversation_id,
    company_id:   companyId,
    phone:        conv.phone,
    updated_at:   now,
  }

  if (extracted.nome)                         upsertData.nome       = extracted.nome
  else if (conv.contact_name)                 upsertData.nome       = conv.contact_name
  if (extracted.empresa)                      upsertData.empresa    = extracted.empresa
  if (extracted.nicho)                        upsertData.nicho      = extracted.nicho
  if (extracted.objetivo)                     upsertData.objetivo   = extracted.objetivo
  if (Array.isArray(extracted.dores) && (extracted.dores as unknown[]).length)
                                              upsertData.dores      = extracted.dores
  if (extracted.estagio)                      upsertData.estagio    = extracted.estagio
  if (extracted.faturamento)                  upsertData.faturamento = extracted.faturamento

  const { error: upsertErr } = await supabase
    .from('lead_context')
    .upsert(upsertData, { onConflict: 'conversation_id' })

  if (upsertErr) {
    console.error('[analyze] upsert error:', upsertErr)
    return NextResponse.json({ ok: true, skipped: 'upsert_error' })
  }

  return NextResponse.json({ ok: true, extracted })
}
