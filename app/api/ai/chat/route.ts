// POST /api/ai/chat — Financial AI Assistant with DB persistence + action cards

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import { buildFinancialContext, buildSmartFallback, fmtBRL } from '@/lib/services/context-builder'
import { detectIntent, runAction, formatActionResult } from '@/lib/actions/runner'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

// ─── Action card detection ─────────────────────────────────────

interface ActionCard {
  type:   string
  title:  string
  value?: number
  button: string
  href?:  string
}

function buildActionCard(intent: string, actionSummary: string): ActionCard | null {
  const valueMatch = actionSummary.match(/R\$\s*([\d.,]+)/)
  const value = valueMatch
    ? parseFloat(valueMatch[1].replace(/\./g, '').replace(',', '.'))
    : undefined

  const map: Record<string, ActionCard> = {
    RECOVER_INADIMPLENTES: {
      type:   'RECOVER_INADIMPLENTES',
      title:  'Recuperar clientes inadimplentes',
      value,
      button: 'Executar cobrança',
      href:   '/dashboard/clients',
    },
    REDUCE_COSTS: {
      type:   'REDUCE_COSTS',
      title:  'Otimizar fornecedores',
      value,
      button: 'Ver fornecedores',
      href:   '/dashboard/suppliers',
    },
    GROWTH_MAP: {
      type:   'GROWTH_MAP',
      title:  'Gerar mapa de crescimento',
      button: 'Abrir mapa',
      href:   '/dashboard/growth-map',
    },
    SEND_BILLING: {
      type:   'SEND_BILLING',
      title:  'Enviar cobranças',
      value,
      button: 'Enviar agora',
      href:   '/dashboard/clients',
    },
    ANALYZE_FINANCIAL: {
      type:   'ANALYZE_FINANCIAL',
      title:  'Análise financeira completa',
      button: 'Ver financeiro',
      href:   '/dashboard/financeiro',
    },
  }

  return map[intent] ?? null
}

// ─── Resolve company_id ────────────────────────────────────────

async function resolveCompany(bodyCompanyId: string | undefined): Promise<{ companyId: string; authId: string | null } | null> {
  try {
    const ctx = await getAuthContext()
    if (ctx?.companyId) {
      return { companyId: ctx.companyId, authId: ctx.authId }
    }
  } catch { /* auth not available */ }

  if (bodyCompanyId) return { companyId: bodyCompanyId, authId: null }

  try {
    const db = getSupabaseServerClient()
    const { data } = await db.from('companies').select('id').limit(1).single()
    if (data?.id) return { companyId: data.id as string, authId: null }
  } catch { /* nothing */ }

  return null
}

// ─── Conversation persistence helpers ─────────────────────────

async function ensureConversation(
  db: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
  authId: string | null,
  conversationId: string | null,
  firstUserMessage: string,
): Promise<string> {
  if (conversationId) {
    // Verify conversation belongs to this company
    const { data } = await db
      .from('nexus_ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (data?.id) return conversationId
  }

  // Create new conversation with first message as title (truncated)
  const title = firstUserMessage.length > 60
    ? firstUserMessage.slice(0, 57) + '...'
    : firstUserMessage

  const { data, error } = await db
    .from('nexus_ai_conversations')
    .insert({ company_id: companyId, user_id: authId, title })
    .select('id')
    .single()

  if (error || !data) throw new Error('Failed to create conversation')
  return data.id as string
}

async function persistMessages(
  db: ReturnType<typeof getSupabaseServerClient>,
  conversationId: string,
  userMessage: string,
  aiReply: string,
  actionCard: ActionCard | null,
) {
  await db.from('nexus_ai_messages').insert([
    { conversation_id: conversationId, role: 'user',      content: userMessage },
    { conversation_id: conversationId, role: 'assistant', content: aiReply, action_card: actionCard ?? null },
  ])
}

async function loadHistory(
  db: ReturnType<typeof getSupabaseServerClient>,
  conversationId: string,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const { data } = await db
    .from('nexus_ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20)

  return (data ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>
}

// ─── Supplier context ──────────────────────────────────────────

interface SupplierRow {
  name:        string
  category:    string | null
  monthly_cost: number | null
  risk_label:  string | null
}

async function loadSupplierContext(db: ReturnType<typeof getSupabaseServerClient>, companyId: string): Promise<string> {
  try {
    const { data: suppliers } = await db
      .from('suppliers')
      .select('name, category, monthly_cost, risk_label')
      .eq('company_id', companyId)
      .order('monthly_cost', { ascending: false })
      .limit(10)

    if (!suppliers || suppliers.length === 0) return ''

    const rows = (suppliers as SupplierRow[])
    const total = rows.reduce((s, r) => s + (r.monthly_cost ?? 0), 0)
    const lines = rows
      .map(s => `• ${s.name} — R$ ${(s.monthly_cost ?? 0).toLocaleString('pt-BR')}/mês (${s.category ?? 'geral'}) [${s.risk_label ?? 'ok'}]`)
      .join('\n')

    return `\nFORNECEDORES (top 10, custo mensal total R$ ${total.toLocaleString('pt-BR')}):\n${lines}`
  } catch {
    return ''
  }
}

// ─── Route ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body           = await readJsonObject(req)
    const message        = body ? getString(body, 'message') ?? '' : ''
    const bodyCompany    = body ? getString(body, 'company_id')      : undefined
    const conversationId = body ? getString(body, 'conversation_id') : undefined

    if (!message.trim()) {
      return NextResponse.json({ reply: 'Mensagem vazia.' }, { status: 400 })
    }

    // ── 1. Resolve company ────────────────────────────────────────────────────
    const resolved = await resolveCompany(bodyCompany ?? undefined)

    if (!resolved) {
      return NextResponse.json({
        reply: 'Sessão expirada. Faça login novamente para usar o assistente.',
      }, { status: 401 })
    }

    const { companyId, authId } = resolved

    // ── 2. Build context ──────────────────────────────────────────────────────
    const db = getSupabaseServerClient()

    const [ctx, supplierCtx] = await Promise.all([
      buildFinancialContext(companyId),
      loadSupplierContext(db, companyId),
    ])

    console.log('[ai/chat] empresa_id:', ctx.empresa_id, '| inadimplentes:', fmtBRL(ctx.total_inadimplente))

    // ── 3. Detect intent ──────────────────────────────────────────────────────
    const intent = detectIntent(message)
    let actionSummary: string | null = null
    let actionCard:    ActionCard   | null = null

    if (intent) {
      console.log(`[ai/chat] intent: ${intent}`)
      const actionResult = await runAction(intent, companyId)
      actionSummary = actionResult.summary
      actionCard    = buildActionCard(intent, actionSummary ?? '')

      if (!process.env.ANTHROPIC_API_KEY) {
        const reply = formatActionResult(actionResult)
        return NextResponse.json({ reply, action_card: actionCard })
      }
    }

    // ── 4. No API key → smart fallback ────────────────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      const reply = buildSmartFallback(ctx, message)
      return NextResponse.json({ reply })
    }

    // ── 5. Ensure conversation row in DB + load history ───────────────────────
    let convId: string | null = null
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = []

    try {
      convId  = await ensureConversation(db, companyId, authId, conversationId ?? null, message)
      history = convId && conversationId ? await loadHistory(db, convId) : []
    } catch (e) {
      console.warn('[ai/chat] DB persistence unavailable:', e)
    }

    // ── 6. Build system prompt ────────────────────────────────────────────────
    const actionBlock = actionSummary
      ? `\n\nAÇÃO EXECUTADA AGORA:\n${actionSummary}\n\nBase sua resposta principalmente neste resultado.`
      : ''

    const systemPrompt = `Você é o NEXUS IA — assistente de negócios inteligente da plataforma NEXUS.

REGRAS CRÍTICAS:
1. Você TEM acesso aos dados da empresa abaixo. NUNCA diga "não tenho acesso".
2. Use EXCLUSIVAMENTE os números do contexto fornecido.
3. Responda SEMPRE em português, de forma direta e prática.
4. Formate valores como R$ 1.500 (nunca sem formatação).
5. Ao listar clientes, use: "• Nome — R$ valor (X dias em atraso)".
6. Máximo 5 parágrafos curtos. Termine com uma recomendação acionável.
7. Se não houver dados, diga isso claramente e de forma positiva.
8. Você pode falar sobre finanças, clientes, fornecedores e crescimento da empresa.

DADOS REAIS DA EMPRESA:
${JSON.stringify(ctx, null, 2)}${supplierCtx}${actionBlock}`

    // ── 7. Call Claude ────────────────────────────────────────────────────────
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history,
      { role: 'user', content: message },
    ]

    const aiRes = await ai.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system:     systemPrompt,
      messages,
    })

    const reply = aiRes.content[0]?.type === 'text'
      ? aiRes.content[0].text.trim()
      : buildSmartFallback(ctx, message)

    console.log('[ai/chat] ✅ reply', reply.length, 'chars | conv:', convId)

    // ── 8. Persist user + AI messages ─────────────────────────────────────────
    if (convId) {
      persistMessages(db, convId, message, reply, actionCard).catch(e =>
        console.warn('[ai/chat] persist failed:', e)
      )
    }

    return NextResponse.json({
      reply,
      action_card:     actionCard,
      conversation_id: convId,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai/chat] ERROR:', msg)
    return NextResponse.json({
      reply: 'Tive um problema temporário ao processar. Tente novamente em alguns segundos.',
    }, { status: 500 })
  }
}
