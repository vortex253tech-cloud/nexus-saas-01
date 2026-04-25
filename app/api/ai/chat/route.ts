// POST /api/ai/chat — Financial AI Assistant
// Builds real-data context from Supabase and passes to Claude Haiku.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import { buildFinancialContext, buildSmartFallback, fmtBRL } from '@/lib/services/context-builder'
import { detectIntent, runAction, formatActionResult } from '@/lib/actions/runner'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

// ─── Resolve company_id — multiple strategies ──────────────────

async function resolveCompany(
  bodyCompanyId: string | undefined,
): Promise<string | null> {
  // 1. Auth context (cookie-based — most reliable)
  try {
    const ctx = await getAuthContext()
    if (ctx?.company?.id) {
      console.log('[ai/chat] company via auth:', ctx.company.id)
      return ctx.company.id
    }
  } catch {
    // auth not available in this request
  }

  // 2. Body company_id fallback (sent by frontend store)
  if (bodyCompanyId) {
    console.log('[ai/chat] company via body:', bodyCompanyId)
    return bodyCompanyId
  }

  // 3. Last resort: look up by session cookie directly
  try {
    const db = getSupabaseServerClient()
    const { data } = await db.from('companies').select('id').limit(1).single()
    if (data?.id) {
      console.log('[ai/chat] company via fallback query:', data.id)
      return data.id as string
    }
  } catch {
    // nothing
  }

  return null
}

// ─── Route ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body        = await readJsonObject(req)
    const message     = body ? getString(body, 'message') ?? '' : ''
    const bodyCompany = body ? getString(body, 'company_id') : undefined

    if (!message.trim()) {
      return NextResponse.json({ reply: 'Mensagem vazia.' }, { status: 400 })
    }

    // ── 1. Resolve company ────────────────────────────────────────────────────
    const companyId = await resolveCompany(bodyCompany ?? undefined)

    if (!companyId) {
      return NextResponse.json({
        reply: 'Sessão expirada. Faça login novamente para usar o assistente.',
      }, { status: 401 })
    }

    // ── 2. Build context with real data ───────────────────────────────────────
    const ctx = await buildFinancialContext(companyId)

    console.log('[ai/chat] ─── CONTEXT ─────────────────────────────────────')
    console.log('[ai/chat] empresa_id       :', ctx.empresa_id)
    console.log('[ai/chat] total_clientes   :', ctx.stats.total_clientes)
    console.log('[ai/chat] inadimplentes    :', ctx.stats.inadimplentes, '→', fmtBRL(ctx.total_inadimplente))
    console.log('[ai/chat] pendentes        :', ctx.stats.pendentes,     '→', fmtBRL(ctx.total_pendente))
    console.log('[ai/chat] pagos            :', ctx.stats.pagos)
    console.log('[ai/chat] taxa_inadimpl    :', ctx.taxa_inadimplencia + '%')
    console.log('[ai/chat] maior_devedor    :', ctx.stats.maior_devedor?.nome, fmtBRL(ctx.stats.maior_devedor?.valor ?? 0))
    console.log('[ai/chat] financeiro       :', ctx.financeiro_atual?.periodo ?? 'nenhum')
    console.log('[ai/chat] ──────────────────────────────────────────────────')
    if (ctx.clientes_inadimplentes.length > 0) {
      console.log('[ai/chat] clientes_inadimplentes:')
      ctx.clientes_inadimplentes.forEach(c =>
        console.log(`  • ${c.nome} — ${fmtBRL(c.valor)} (${c.dias_atraso}d atraso)`)
      )
    }
    console.log('[ai/chat] ──────────────────────────────────────────────────')

    // ── 3. Detect intent → run real action if matched ────────────────────────
    const intent = detectIntent(message)
    let actionSummary: string | null = null

    if (intent) {
      console.log(`[ai/chat] intent detected: ${intent}`)
      const actionResult = await runAction(intent, companyId)
      actionSummary = actionResult.summary

      // No API key → format action result directly and return
      if (!process.env.ANTHROPIC_API_KEY) {
        const reply = formatActionResult(actionResult)
        console.log('[ai/chat] no API key — returning formatted action result')
        return NextResponse.json({ reply })
      }
    }

    // ── 4. No API key (no intent matched) → smart fallback ───────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('[ai/chat] no API key — using smart fallback')
      const reply = buildSmartFallback(ctx, message)
      return NextResponse.json({ reply })
    }

    // ── 5. Build prompt ───────────────────────────────────────────────────────
    const actionBlock = actionSummary
      ? `\n\nAÇÃO EXECUTADA AGORA (resultado real, acabou de acontecer):\n${actionSummary}\n\nBase sua resposta PRINCIPALMENTE neste resultado da ação, confirmando o que foi feito.`
      : ''

    const systemPrompt = `Você é o assistente financeiro inteligente do NEXUS.

REGRAS CRÍTICAS — NUNCA VIOLE:
1. Você TEM acesso aos dados da empresa abaixo. NUNCA diga "não tenho acesso" ou "não consigo ver os dados".
2. Use EXCLUSIVAMENTE os números do contexto JSON fornecido.
3. Responda SEMPRE em português, de forma direta e prática.
4. Formate valores como R$ 1.500 (nunca "1500" sem formatação).
5. Ao listar clientes inadimplentes, use: "• Nome — R$ valor (X dias em atraso)".
6. Máximo 5 parágrafos curtos. Termine com uma recomendação acionável.
7. Se não houver dados para a pergunta (ex: 0 inadimplentes), diga isso claramente e de forma positiva.

DADOS REAIS DA EMPRESA (use estes números):
${JSON.stringify(ctx, null, 2)}${actionBlock}`

    // ── 6. Call Claude ────────────────────────────────────────────────────────
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const aiRes = await ai.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: message }],
    })

    const reply = aiRes.content[0]?.type === 'text'
      ? aiRes.content[0].text.trim()
      : null

    if (!reply) {
      // AI returned empty — use smart fallback
      console.log('[ai/chat] empty AI response — using smart fallback')
      return NextResponse.json({ reply: buildSmartFallback(ctx, message) })
    }

    console.log('[ai/chat] ✅ AI reply ─', reply.length, 'chars')
    return NextResponse.json({ reply })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai/chat] ERROR:', msg)
    // Never expose "não consegui acessar dados" — give structured fallback
    return NextResponse.json({
      reply: 'Tive um problema temporário ao processar. Tente novamente em alguns segundos.',
    }, { status: 500 })
  }
}
