// POST /api/ai/chat — Financial AI Assistant
// Queries real company data and responds with Claude Haiku

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getAuthContext } from '@/lib/auth'
import { getString, readJsonObject } from '@/lib/unknown'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

// ─── Row types ─────────────────────────────────────────────────

interface ClientRow {
  id: string
  name: string
  total_revenue: number
  status: string
  email: string | null
}

interface FinRow {
  revenue: number
  costs: number
  profit: number
  period_label: string
}

interface ActionRow {
  titulo: string
  impacto_estimado: number
  prioridade: string
  status: string
}

interface AlertRow {
  tipo: string
  titulo: string
  impacto: string | null
}

// ─── Friendly fallback (no data yet) ──────────────────────────

function emptyDataReply(msg: string): string {
  const q = msg.toLowerCase()
  if (q.includes('deve') || q.includes('inadimpl') || q.includes('atraso'))
    return 'Ainda não encontrei clientes com cobranças em atraso. Cadastre seus clientes em **Clientes** para que eu possa monitorar pagamentos e alertar sobre inadimplência.'
  if (q.includes('receber') || q.includes('cobrar'))
    return 'Nenhum valor a receber encontrado. Cadastre clientes com status pendente para que eu calcule seu total a receber.'
  if (q.includes('faturamento') || q.includes('receita') || q.includes('aumentar'))
    return 'Adicione seus dados financeiros em **Dados** para que eu possa analisar seu faturamento e sugerir estratégias de crescimento.'
  return 'Ainda não tenho dados suficientes para responder com precisão. Adicione clientes e dados financeiros no dashboard para que eu possa analisar sua empresa.'
}

// ─── Structured fallback (API key missing) ────────────────────

function buildFallbackReply(
  msg: string,
  overdueClients: ClientRow[],
  totalA: number,
  totalO: number,
  taxa: number,
  latestFin: FinRow | null,
): string {
  const q = msg.toLowerCase()
  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`

  if (q.includes('deve') || q.includes('inadimpl') || q.includes('atraso')) {
    if (overdueClients.length === 0) return 'Nenhum cliente inadimplente encontrado no momento. 👍'
    const list = overdueClients.map(c => `• ${c.name} — ${fmtBRL(c.total_revenue ?? 0)}`).join('\n')
    return `Encontrei **${overdueClients.length} cliente${overdueClients.length > 1 ? 's' : ''}** com valores em atraso:\n\n${list}\n\n**Total vencido: ${fmtBRL(totalO)}**\n\nRecomendação: inicie uma régua de cobrança via WhatsApp ou e-mail para os clientes mais antigos.`
  }

  if (q.includes('receber') || q.includes('total a receber')) {
    return `Seu total a receber é **${fmtBRL(totalA)}** em cobranças pendentes.\n\nDesses, **${fmtBRL(totalO)}** já estão vencidos.\n\nPriorize contato com os ${overdueClients.length} clientes inadimplentes.`
  }

  if (q.includes('taxa') || q.includes('inadimplência')) {
    return `Sua taxa de inadimplência atual é de **${taxa}%**.\n\n${taxa > 15 ? '⚠️ Acima da média de mercado (10-15%). Ative cobrança automática para reduzir esse índice.' : '✅ Dentro da média de mercado. Continue monitorando.'}`
  }

  if (latestFin) {
    if (q.includes('faturamento') || q.includes('receita')) {
      return `No período **${latestFin.period_label}**, sua receita foi de **${fmtBRL(latestFin.revenue)}** com lucro de **${fmtBRL(latestFin.profit)}**.\n\nMargem: ${latestFin.revenue > 0 ? Math.round((latestFin.profit / latestFin.revenue) * 100) : 0}%.`
    }
  }

  return `Com base nos seus dados: ${overdueClients.length} clientes inadimplentes, ${fmtBRL(totalA)} a receber, ${fmtBRL(totalO)} vencido. Para análises mais profundas, configure sua chave ANTHROPIC_API_KEY no Vercel.`
}

// ─── Route ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    const messageText  = body ? getString(body, 'message')    : undefined
    const bodyCompanyId = body ? getString(body, 'company_id') : undefined

    console.log('[ai/chat] message:', messageText, '| body_cid:', bodyCompanyId)

    if (!messageText?.trim()) {
      return NextResponse.json({ reply: 'Mensagem vazia.' }, { status: 400 })
    }

    // ── Resolve company_id (auth first, body fallback) ──────────────────
    let companyId: string | null = null

    const ctx = await getAuthContext()
    if (ctx) {
      companyId = ctx.company.id
      console.log('[ai/chat] auth context — company:', companyId)
    } else if (bodyCompanyId) {
      companyId = bodyCompanyId
      console.log('[ai/chat] fallback to body company_id:', companyId)
    }

    if (!companyId) {
      return NextResponse.json({
        reply: 'Sessão expirada. Faça login novamente para usar o assistente.',
      }, { status: 401 })
    }

    // ── Fetch real data ─────────────────────────────────────────────────
    const db = getSupabaseServerClient()

    const [clientsRes, finRes, actionsRes, alertsRes] = await Promise.all([
      db.from('clients')
        .select('id, name, total_revenue, status, email')
        .eq('company_id', companyId)
        .order('total_revenue', { ascending: false })
        .limit(50)
        .returns<ClientRow[]>(),
      db.from('financial_data')
        .select('revenue, costs, profit, period_label')
        .eq('company_id', companyId)
        .order('period_date', { ascending: false })
        .limit(12)
        .returns<FinRow[]>(),
      db.from('actions')
        .select('titulo, impacto_estimado, prioridade, status')
        .eq('company_id', companyId)
        .neq('status', 'done')
        .order('impacto_estimado', { ascending: false })
        .limit(5)
        .returns<ActionRow[]>(),
      db.from('alerts')
        .select('tipo, titulo, impacto')
        .eq('company_id', companyId)
        .eq('dismissed', false)
        .limit(5)
        .returns<AlertRow[]>(),
    ])

    const clients = clientsRes.data  ?? []
    const finData = finRes.data      ?? []
    const actions = actionsRes.data  ?? []
    const alerts  = alertsRes.data   ?? []

    console.log('[ai/chat] data — clients:', clients.length, '| fin:', finData.length, '| actions:', actions.length)

    // No data at all → friendly prompt instead of AI call
    if (clients.length === 0 && finData.length === 0) {
      return NextResponse.json({ reply: emptyDataReply(messageText) })
    }

    // ── Build context ───────────────────────────────────────────────────
    const overdue  = clients.filter(c => c.status === 'overdue')
    const pending  = clients.filter(c => c.status === 'pending')
    const totalA   = pending.reduce((s, c) => s + (c.total_revenue ?? 0), 0)
    const totalO   = overdue.reduce((s, c) => s + (c.total_revenue ?? 0), 0)
    const taxa     = clients.length > 0 ? Math.round((overdue.length / clients.length) * 100) : 0
    const latestFin = finData[0] ?? null

    const context = {
      clientes: {
        total: clients.length,
        inadimplentes: overdue.map(c => ({ nome: c.name, valor: c.total_revenue, email: c.email })),
        pendentes_contagem: pending.length,
        taxa_inadimplencia_pct: taxa,
        total_a_receber: totalA,
        total_vencido: totalO,
      },
      financeiro: latestFin
        ? {
            receita: latestFin.revenue,
            custos: latestFin.costs,
            lucro: latestFin.profit,
            periodo: latestFin.period_label,
            historico: finData.slice(0, 6).map(f => ({
              periodo: f.period_label,
              receita: f.revenue,
              lucro: f.profit,
            })),
          }
        : null,
      acoes_pendentes: actions.map(a => ({
        titulo: a.titulo,
        impacto_estimado: a.impacto_estimado,
        prioridade: a.prioridade,
      })),
      alertas_ativos: alerts.map(a => ({
        tipo: a.tipo,
        titulo: a.titulo,
        impacto: a.impacto,
      })),
    }

    // ── No API key → structured fallback ───────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('[ai/chat] no API key — using structured fallback')
      const reply = buildFallbackReply(messageText, overdue, totalA, totalO, taxa, latestFin)
      return NextResponse.json({ reply })
    }

    // ── Anthropic call ──────────────────────────────────────────────────
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const aiRes = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Você é o assistente financeiro inteligente do NEXUS. Responda em português de forma direta, prática e útil.

Use APENAS os dados reais fornecidos abaixo. Formate valores monetários em R$. Respostas com no máximo 4 parágrafos curtos.
Ao listar clientes inadimplentes: use formato "• Nome — R$ valor".
Sempre termine com uma recomendação prática e acionável.

DADOS REAIS DA EMPRESA:
${JSON.stringify(context, null, 2)}`,
      messages: [{ role: 'user', content: messageText }],
    })

    const reply = aiRes.content[0]?.type === 'text' ? aiRes.content[0].text : null

    if (!reply) {
      const fallback = buildFallbackReply(messageText, overdue, totalA, totalO, taxa, latestFin)
      return NextResponse.json({ reply: fallback })
    }

    console.log('[ai/chat] ✅ AI reply, length:', reply.length)
    return NextResponse.json({ reply })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai/chat] ERROR:', msg)
    return NextResponse.json({
      reply: 'Tive um problema temporário. Tente novamente em alguns segundos.',
    }, { status: 500 })
  }
}
