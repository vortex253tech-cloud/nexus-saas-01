// POST /api/nexus/seller — NEXUS Seller Engine
// Autonomous AI: initiates conversations, sends follow-ups, breaks objections
// Triggered by: dashboard, cron, or external event

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// ── Types ──────────────────────────────────────────────────────────────────

interface SellerAction {
  type:     'message' | 'followup' | 'reactivation' | 'proposal' | 'closing'
  leadId:   string
  phone:    string
  context?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function ai() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, timeout: 20000 })
}

// ── Load AI Persona for company ────────────────────────────────────────────

async function loadPersona(companyId: string) {
  const { data } = await db()
    .from('ai_personas')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle()
  return data
}

// ── Load lead data ─────────────────────────────────────────────────────────

async function loadLead(leadId: string) {
  const { data } = await db()
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()
  return data
}

// ── Load conversation history ──────────────────────────────────────────────

async function loadHistory(phone: string, companyId: string) {
  const { data: conv } = await db()
    .from('whatsapp_conversations')
    .select('id')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .maybeSingle()

  if (!conv) return []

  const { data: msgs } = await db()
    .from('whatsapp_messages')
    .select('direction, content')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(15)

  return (msgs ?? []).reverse().map(m => ({
    role:    m.direction === 'incoming' ? 'user' : 'assistant',
    content: m.content,
  }))
}

// ── Build seller prompt ────────────────────────────────────────────────────

function buildSellerPrompt(
  persona: Record<string, unknown> | null,
  lead: Record<string, unknown> | null,
  actionType: string,
): string {
  const nomePessoaName   = (persona?.nome   as string) || 'NEXUS AI'
  const nicho     = (persona?.nicho   as string) || ''
  const tom       = (persona?.tom     as string) || 'executivo'
  const objetivo  = (persona?.objetivo as string) || 'agendar_call'
  const abordagem = (persona?.abordagem as string) || 'challenger'
  const instrucoes = (persona?.instrucoes as string) || ''
  const produto   = (persona?.produto_foco as string) || ''
  const saudacao  = (persona?.saudacao as string) || ''

  const actionInstructions: Record<string, string> = {
    message:     'Inicie uma conversa consultiva, apresente valor e identifique dores do prospect.',
    followup:    'Faça follow-up estratégico. Retome o contexto anterior e avance para próximo passo.',
    reactivation:'Reative o contato de forma surpreendente. Apresente novo ângulo de valor.',
    proposal:    'Apresente a proposta de forma clara e irresistível. Foque em ROI e transformação.',
    closing:     'Conduza o fechamento. Use urgência legítima e elimine objeções finais.',
  }

  let leadBlock = ''
  if (lead) {
    const parts: string[] = []
    if (lead.name)            parts.push(`Nome: ${lead.name}`)
    if (lead.empresa)         parts.push(`Empresa: ${lead.empresa}`)
    if (lead.nicho)           parts.push(`Nicho: ${lead.nicho}`)
    if (lead.score !== null)  parts.push(`Score: ${lead.score}/100`)
    if (lead.temperatura)     parts.push(`Temperatura: ${lead.temperatura}`)
    if (lead.stage)           parts.push(`Estágio: ${lead.stage}`)
    if (lead.valor_potencial) parts.push(`Potencial: R$${lead.valor_potencial}`)
    if (parts.length > 0) {
      leadBlock = `\n\n━━━ DADOS DO LEAD ━━━\n${parts.join('\n')}\n━━━━━━━━━━━━━━━━━━━`
    }
  }

  return `Você é ${nomePessoaName}, uma IA comercial de alta performance${nicho ? ` especializada em ${nicho}` : ''}.

Tom: ${tom} | Objetivo: ${objetivo} | Abordagem: ${abordagem}
${produto ? `Produto/serviço foco: ${produto}` : ''}
${saudacao ? `Saudação padrão: ${saudacao}` : ''}
${instrucoes ? `\nInstruções específicas: ${instrucoes}` : ''}

Missão agora: ${actionInstructions[actionType] || actionInstructions.message}

Regras:
- Máximo 3 frases por mensagem (WhatsApp — mensagens curtas convertem mais)
- NUNCA mencione que é IA, ChatGPT ou robô
- Personalize baseado nos dados do lead abaixo
- Sempre termine com uma pergunta ou CTA claro
- Responda em português, tom ${tom}${leadBlock}`
}

// ── Send WhatsApp via Z-API ────────────────────────────────────────────────

async function sendWhatsApp(phone: string, text: string) {
  const instanceId  = process.env.ZAPI_INSTANCE_ID
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) return { error: 'zapi_not_configured' }

  const res = await fetch(
    `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken ?? '' },
      body:    JSON.stringify({ phone, message: text }),
    }
  )
  return res.json().catch(() => ({ status: res.status }))
}

// ── Log seller event ───────────────────────────────────────────────────────

async function logEvent(companyId: string, leadId: string, tipo: string, conteudo: string, resultado: string) {
  await db().from('seller_events').insert({
    company_id: companyId,
    lead_id:    leadId || null,
    tipo,
    canal:      'whatsapp',
    conteudo,
    resultado,
    metadata:   {},
  })
}

// ── Update lead after action ───────────────────────────────────────────────

async function updateLeadAfterAction(leadId: string, actionType: string) {
  const updates: Record<string, unknown> = {
    ultima_interacao: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (actionType === 'message' || actionType === 'followup') {
    updates.stage = 'contatado'
  }

  await db().from('leads').update(updates).eq('id', leadId)
}

// ── GET: list pending tasks for seller ────────────────────────────────────

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) {
    return NextResponse.json({ error: 'company_id required' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data: tasks, error } = await db()
    .from('ai_tasks')
    .select('*, leads(name, phone, empresa, score, temperatura, stage)')
    .eq('company_id', companyId)
    .eq('status', 'pendente')
    .lte('agendado_para', now)
    .order('prioridade', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tasks: tasks ?? [], count: tasks?.length ?? 0 })
}

// ── POST: execute seller action ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    company_id: string
    action:     SellerAction
    task_id?:   string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { company_id, action, task_id } = body

  if (!company_id || !action?.type || !action?.phone) {
    return NextResponse.json({ error: 'company_id, action.type, action.phone required' }, { status: 400 })
  }

  const supabase = db()

  // Mark task as executing
  if (task_id) {
    await supabase.from('ai_tasks')
      .update({ status: 'executando', updated_at: new Date().toISOString() })
      .eq('id', task_id)
  }

  try {
    const [persona, lead, history] = await Promise.all([
      loadPersona(company_id),
      action.leadId ? loadLead(action.leadId) : Promise.resolve(null),
      loadHistory(action.phone, company_id),
    ])

    const systemPrompt = buildSellerPrompt(persona, lead, action.type)

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    if (action.context) {
      messages.push({ role: 'user', content: action.context })
    } else if (history.length === 0) {
      messages.push({ role: 'user', content: '[Iniciar conversa]' })
    }

    const completion = await ai().chat.completions.create({
      model:       'gpt-4.1-mini',
      max_tokens:  200,
      temperature: 0.8,
      messages,
    })

    const aiText = completion.choices[0]?.message?.content?.trim() ?? ''

    if (!aiText) throw new Error('OpenAI returned empty response')

    const zapiResult = await sendWhatsApp(action.phone, aiText)

    await Promise.all([
      logEvent(company_id, action.leadId, action.type, aiText, JSON.stringify(zapiResult)),
      action.leadId ? updateLeadAfterAction(action.leadId, action.type) : Promise.resolve(),
    ])

    if (task_id) {
      await supabase.from('ai_tasks').update({
        status:      'concluido',
        executado_em: new Date().toISOString(),
        resultado:   aiText.slice(0, 500),
        updated_at:  new Date().toISOString(),
      }).eq('id', task_id)
    }

    return NextResponse.json({ ok: true, message: aiText, zapi: zapiResult })

  } catch (err) {
    console.error('SELLER ENGINE ERROR:', String(err))

    if (task_id) {
      await db().from('ai_tasks').update({
        status:     'falhou',
        resultado:  String(err).slice(0, 500),
        tentativas: 1,
        updated_at: new Date().toISOString(),
      }).eq('id', task_id)
    }

    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
