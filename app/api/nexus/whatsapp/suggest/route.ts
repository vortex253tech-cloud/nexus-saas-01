// POST /api/nexus/whatsapp/suggest
// Generates a real contextual AI reply using the last N messages + lead context

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }          from '@/lib/auth'
import { createClient }            from '@supabase/supabase-js'
import { denyIfCannot }            from '@/lib/plan-middleware'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const denied = await denyIfCannot('whatsapp')
  if (denied) return denied

  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const companyId = auth.companyId

  let body: { conversation_id?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { conversation_id } = body
  if (!conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })

  const supabase = db()

  // Fetch conversation + last 15 messages + lead context in parallel
  const [convRes, msgsRes, ctxRes] = await Promise.all([
    supabase
      .from('whatsapp_conversations')
      .select('id, phone, contact_name')
      .eq('id', conversation_id)
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase
      .from('whatsapp_messages')
      .select('direction, content, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('lead_context')
      .select('nome, empresa, nicho, objetivo, dores, estagio, faturamento')
      .eq('conversation_id', conversation_id)
      .maybeSingle(),
  ])

  if (!convRes.data) return NextResponse.json({ suggestion: null })

  const msgs = (msgsRes.data ?? []).reverse()
  const ctx  = ctxRes.data

  // Fallback if no OpenAI key
  if (!process.env.OPENAI_API_KEY) {
    const templates = [
      'Olá! Que ótima pergunta. Deixa eu te explicar como podemos ajudar com isso. 😊',
      'Entendido! Posso te mostrar como nossa solução resolve exatamente esse problema.',
      'Perfeito! Vamos agendar 20 minutos para eu te mostrar na prática os resultados?',
    ]
    const last = msgs.filter(m => m.direction === 'incoming').pop()
    if (!last) return NextResponse.json({ suggestion: templates[0] })
    return NextResponse.json({ suggestion: templates[Math.floor(Math.random() * templates.length)] })
  }

  // Build system prompt with lead context
  let systemPrompt =
    'Você é um assistente de vendas especializado operando via WhatsApp.\n' +
    'Objetivo: qualificar leads, gerar valor e avançar a venda de forma natural.\n' +
    'Regras: responda SEMPRE em português brasileiro, máximo 2-3 linhas, seja direto e humano.\n' +
    'Não use linguagem corporativa. Use emojis com moderação (1 no máximo).'

  if (ctx) {
    const parts: string[] = []
    if (ctx.nome)        parts.push(`Lead: ${ctx.nome}`)
    if (ctx.empresa)     parts.push(`Empresa: ${ctx.empresa}`)
    if (ctx.nicho)       parts.push(`Nicho: ${ctx.nicho}`)
    if (ctx.faturamento) parts.push(`Faturamento: ${ctx.faturamento}`)
    if (ctx.objetivo)    parts.push(`Objetivo: ${ctx.objetivo}`)
    if (ctx.estagio)     parts.push(`Estágio: ${ctx.estagio}`)
    if (ctx.dores?.length) parts.push(`Dores: ${(ctx.dores as string[]).join(', ')}`)
    if (parts.length)    systemPrompt += '\n\nContexto do lead:\n' + parts.join('\n')
  }

  const chatHistory = msgs.map(m => ({
    role: m.direction === 'outgoing' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }))

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
      signal: AbortSignal.timeout(22000),
    })

    if (!aiRes.ok) throw new Error(`OpenAI ${aiRes.status}`)
    const aiData = await aiRes.json() as { choices?: { message?: { content?: string } }[] }
    const suggestion = aiData.choices?.[0]?.message?.content?.trim() ?? null
    return NextResponse.json({ suggestion })
  } catch (err) {
    console.error('[wa/suggest] OpenAI error:', err)
    return NextResponse.json({
      suggestion: 'Posso te ajudar com mais alguma coisa? Estou aqui para esclarecer qualquer dúvida. 😊',
    })
  }
}
