// POST /api/ai/chat — Multimodal AI engine with streaming, attachments, and memory
//
// Request body:
//   message:         string
//   company_id?:     string
//   conversation_id?: string
//   attachments?:    AttachmentInput[]  (from /api/ai/upload)
//
// Response:
//   If attachments or streaming is needed: text/event-stream (SSE)
//   Each line: data: {"token":"..."} or data: {"done":true,...}
//
// The endpoint always streams. Frontend reads it incrementally.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString } from '@/lib/unknown'
import { buildFinancialContext, buildSmartFallback, fmtBRL } from '@/lib/services/context-builder'
import { detectIntent, runAction, formatActionResult } from '@/lib/actions/runner'
import { loadMemory, formatMemoryForPrompt, extractAndSaveMemory } from '@/lib/ai/memory'
import { denyIfCannot, denyIfAtLimit } from '@/lib/plan-middleware'
import { getAiUsage, incrementAiUsage } from '@/lib/usage'
import Anthropic from '@anthropic-ai/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttachmentInput {
  id?:            string
  name:           string
  mime:           string
  type_category:  'document' | 'image' | 'audio'
  extracted_text: string | null
  ai_summary?:    string | null
}

interface ActionCard {
  type:   string
  title:  string
  value?: number
  button: string
  href?:  string
}

// ─── Action card builder ──────────────────────────────────────────────────────

function buildActionCard(intent: string, actionSummary: string): ActionCard | null {
  const valueMatch = actionSummary.match(/R\$\s*([\d.,]+)/)
  const value = valueMatch
    ? parseFloat(valueMatch[1].replace(/\./g, '').replace(',', '.'))
    : undefined

  const map: Record<string, ActionCard> = {
    RECOVER_INADIMPLENTES: { type: 'RECOVER_INADIMPLENTES', title: 'Recuperar clientes inadimplentes', value, button: 'Executar cobrança', href: '/dashboard/clients' },
    REDUCE_COSTS:          { type: 'REDUCE_COSTS',          title: 'Otimizar fornecedores',             value, button: 'Ver fornecedores', href: '/dashboard/suppliers' },
    GROWTH_MAP:            { type: 'GROWTH_MAP',            title: 'Gerar mapa de crescimento',                button: 'Abrir mapa',       href: '/dashboard/growth-map' },
    SEND_BILLING:          { type: 'SEND_BILLING',          title: 'Enviar cobranças',                   value, button: 'Enviar agora',  href: '/dashboard/clients' },
    ANALYZE_FINANCIAL:     { type: 'ANALYZE_FINANCIAL',     title: 'Análise financeira completa',               button: 'Ver financeiro',   href: '/dashboard/financeiro' },
  }
  return map[intent] ?? null
}

// ─── Company resolver ─────────────────────────────────────────────────────────

async function resolveCompany(bodyCompanyId?: string): Promise<{ companyId: string; authId: string | null } | null> {
  try {
    const ctx = await getAuthContext()
    if (ctx?.companyId) return { companyId: ctx.companyId, authId: ctx.authId }
  } catch { /* auth not available server-side */ }

  if (bodyCompanyId) return { companyId: bodyCompanyId, authId: null }

  try {
    const db = getSupabaseServerClient()
    const { data } = await db.from('companies').select('id').limit(1).single()
    if (data?.id) return { companyId: data.id as string, authId: null }
  } catch { /* nothing */ }

  return null
}

// ─── Conversation helpers ─────────────────────────────────────────────────────

async function ensureConversation(
  db: ReturnType<typeof getSupabaseServerClient>,
  companyId: string, authId: string | null,
  conversationId: string | null, firstMessage: string,
): Promise<string> {
  if (conversationId) {
    const { data } = await db.from('nexus_ai_conversations').select('id').eq('id', conversationId).eq('company_id', companyId).maybeSingle()
    if (data?.id) return conversationId
  }
  const title = firstMessage.length > 60 ? firstMessage.slice(0, 57) + '...' : firstMessage
  const { data, error } = await db.from('nexus_ai_conversations').insert({ company_id: companyId, user_id: authId, title }).select('id').single()
  if (error || !data) throw new Error('Failed to create conversation')
  return data.id as string
}

async function loadHistory(
  db: ReturnType<typeof getSupabaseServerClient>, conversationId: string,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const { data } = await db.from('nexus_ai_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(20)
  return (data ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>
}

async function loadSupplierContext(db: ReturnType<typeof getSupabaseServerClient>, companyId: string): Promise<string> {
  try {
    const { data } = await db.from('suppliers').select('name, category, monthly_cost, risk_label').eq('company_id', companyId).order('monthly_cost', { ascending: false }).limit(10)
    if (!data || data.length === 0) return ''
    const total = data.reduce((s: number, r: { monthly_cost?: number | null }) => s + (r.monthly_cost ?? 0), 0)
    const lines = data.map((s: { name: string; monthly_cost?: number | null; category?: string | null; risk_label?: string | null }) =>
      `• ${s.name} — R$ ${(s.monthly_cost ?? 0).toLocaleString('pt-BR')}/mês (${s.category ?? 'geral'}) [${s.risk_label ?? 'ok'}]`
    ).join('\n')
    return `\nFORNECEDORES:\n${lines}\nTotal mensal: R$ ${total.toLocaleString('pt-BR')}`
  } catch { return '' }
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function sseToken(token: string): string {
  return `data: ${JSON.stringify({ token })}\n\n`
}

function sseDone(payload: object): string {
  return `data: ${JSON.stringify({ done: true, ...payload })}\n\n`
}

function sseError(message: string): string {
  return `data: ${JSON.stringify({ error: message })}\n\n`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const denied = await denyIfCannot('nexus_ai')
  if (denied) return denied

  let body: Record<string, unknown> | null = null
  try { body = await req.json() } catch { /* empty body */ }

  const message        = (body ? getString(body, 'message') ?? '' : '').trim()
  const bodyCompany    = body ? getString(body, 'company_id')      : undefined
  const conversationId = body ? getString(body, 'conversation_id') : undefined
  const attachments    = (body?.attachments ?? []) as AttachmentInput[]

  if (!message) {
    return new Response(sseError('Mensagem vazia.'), {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  // Set up SSE stream
  const encoder = new TextEncoder()
  const stream  = new TransformStream<string, Uint8Array>({
    transform(chunk, controller) { controller.enqueue(encoder.encode(chunk)) },
  })
  const writer = stream.writable.getWriter()

  const response = new Response(stream.readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })

  // Process in background so we can return the response header immediately
  ;(async () => {
    try {
      // ── 1. Resolve company ──────────────────────────────────────────────────
      const resolved = await resolveCompany(bodyCompany ?? undefined)
      if (!resolved) {
        await writer.write(sseError('Sessão expirada. Faça login novamente.'))
        await writer.close()
        return
      }
      const { companyId, authId } = resolved

      // ── 1b. AI usage limit ───────────────────────────────────────────────────
      const usage = await getAiUsage(companyId)
      const overLimit = await denyIfAtLimit('max_ai_messages', usage)
      if (overLimit) {
        await writer.write(sseError('Limite de mensagens de IA do seu plano foi atingido. Faça upgrade para continuar.'))
        await writer.close()
        return
      }

      // ── 2. Build context ────────────────────────────────────────────────────
      const db = getSupabaseServerClient()

      const [ctx, supplierCtx, memory] = await Promise.all([
        buildFinancialContext(companyId),
        loadSupplierContext(db, companyId),
        loadMemory(companyId),
      ])

      // ── 3. Detect intent + run action ───────────────────────────────────────
      const intent = detectIntent(message)
      let actionSummary: string | null = null
      let actionCard:    ActionCard   | null = null

      if (intent) {
        const actionResult = await runAction(intent, companyId)
        actionSummary = actionResult.summary
        actionCard    = buildActionCard(intent, actionSummary ?? '')
      }

      // ── 4. Handle no API key ────────────────────────────────────────────────
      if (!process.env.ANTHROPIC_API_KEY) {
        const reply = intent && actionSummary
          ? formatActionResult(await runAction(intent, companyId))
          : buildSmartFallback(ctx, message)
        await writer.write(sseToken(reply))
        await writer.write(sseDone({ action_card: actionCard }))
        await writer.close()
        return
      }

      // ── 5. Ensure conversation + load history ───────────────────────────────
      let convId: string | null = null
      let history: Array<{ role: 'user' | 'assistant'; content: string }> = []

      try {
        convId = await ensureConversation(db, companyId, authId, conversationId ?? null, message)
        if (convId && conversationId) history = await loadHistory(db, convId)
      } catch (e) { console.warn('[ai/chat] DB error:', e) }

      // ── 6. Build attachment context block ───────────────────────────────────
      let attachmentBlock = ''
      if (attachments.length > 0) {
        const parts = attachments
          .filter(a => a.extracted_text)
          .map(a => {
            const header = `\n--- ${a.type_category.toUpperCase()}: ${a.name} ---`
            return `${header}\n${a.extracted_text}`
          })
        if (parts.length > 0) {
          attachmentBlock = `\n\nCONTEÚDO DOS ARQUIVOS ENVIADOS:${parts.join('\n')}`
        }
      }

      // ── 7. Build system prompt ──────────────────────────────────────────────
      const memoryBlock   = formatMemoryForPrompt(memory)
      const actionBlock   = actionSummary ? `\n\nAÇÃO EXECUTADA:\n${actionSummary}\n\nBase sua resposta neste resultado.` : ''
      const hasAttachment = attachments.length > 0

      const systemPrompt = `Você é o NEXUS IA — assistente de negócios inteligente da plataforma NEXUS.

REGRAS CRÍTICAS:
1. Você TEM acesso aos dados reais da empresa abaixo. NUNCA diga "não tenho acesso".
2. Use EXCLUSIVAMENTE os números do contexto fornecido.
3. Responda SEMPRE em português, de forma direta e prática.
4. Formate valores como R$ 1.500.
5. Ao listar clientes: "• Nome — R$ valor (X dias em atraso)".
6. Máximo 5 parágrafos curtos. Termine com uma recomendação acionável.
7. Se não houver dados, diga claramente de forma positiva.
8. ${hasAttachment ? 'O usuário enviou arquivos. Analise o conteúdo e integre com os dados da empresa.' : 'Analise os dados da empresa e seja preciso.'}

DADOS REAIS DA EMPRESA:
${JSON.stringify(ctx, null, 2)}${supplierCtx}${memoryBlock}${attachmentBlock}${actionBlock}`

      // ── 8. Stream Claude response ───────────────────────────────────────────
      const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...history,
        { role: 'user', content: message },
      ]

      let fullReply = ''

      const aiStream = ai.messages.stream({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 900,
        system:     systemPrompt,
        messages,
      })

      for await (const event of aiStream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const token = event.delta.text
          fullReply += token
          await writer.write(sseToken(token))
        }
      }

      // ── 9. Persist messages ─────────────────────────────────────────────────
      if (convId) {
        const attachmentMeta = attachments.map(a => ({ id: a.id, name: a.name, type: a.type_category }))
        void (async () => {
          try {
            await db.from('nexus_ai_messages').insert([
              { conversation_id: convId, role: 'user',      content: message,    attachments: attachmentMeta },
              { conversation_id: convId, role: 'assistant', content: fullReply,  action_card: actionCard ?? null },
            ])
            void extractAndSaveMemory(companyId, message, fullReply)
          } catch (e) { console.warn('[ai/chat] persist error:', e) }
        })()
      }

      // ── 10. Send done event ─────────────────────────────────────────────────
      void incrementAiUsage(companyId)
      await writer.write(sseDone({ action_card: actionCard, conversation_id: convId }))
      await writer.close()

    } catch (err) {
      console.error('[ai/chat] stream error:', err)
      try {
        const msg = err instanceof Error ? err.message : 'Erro interno'
        await writer.write(sseError(`Problema temporário: ${msg}. Tente novamente.`))
        await writer.close()
      } catch { /* stream already closed */ }
    }
  })()

  return response
}
