// ─── Context Builder — Financial AI ───────────────────────────────────────────
// Server-only. Builds a rich context object from Supabase data for the AI chat.

import { getSupabaseServerClient } from '@/lib/supabase'
import { computeEffectiveStatus } from '@/lib/collections'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientCtx {
  id: string
  nome: string
  email: string | null
  valor: number
  status: 'overdue' | 'pending' | 'paid'
  dias_atraso: number
  vencimento: string | null
}

export interface FinancialPeriod {
  periodo: string
  receita: number
  custos: number
  lucro: number
  margem_pct: number
}

export interface FinancialContext {
  // Totals
  total_inadimplente: number      // R$ vencido (overdue)
  total_pendente: number          // R$ a vencer (pending)
  total_recebido: number          // R$ recebido (paid)
  taxa_inadimplencia: number      // % clientes overdue / total

  // Client lists
  clientes_inadimplentes: ClientCtx[]
  clientes_pendentes: ClientCtx[]
  clientes_pagos: ClientCtx[]
  todos_clientes: ClientCtx[]

  // Stats
  stats: {
    total_clientes: number
    inadimplentes: number
    pendentes: number
    pagos: number
    ticket_medio: number
    maior_devedor: ClientCtx | null
  }

  // Financial history
  financeiro: FinancialPeriod[]
  financeiro_atual: FinancialPeriod | null

  // Actions & alerts
  acoes_pendentes: { titulo: string; impacto: number; prioridade: string }[]
  alertas: { tipo: string; titulo: string; impacto: string | null }[]

  // Meta
  empresa_id: string
  gerado_em: string
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export async function buildFinancialContext(companyId: string): Promise<FinancialContext> {
  const db = getSupabaseServerClient()

  // ── Parallel fetch ──────────────────────────────────────────────────────────
  const [clientsRes, finRes, actionsRes, alertsRes] = await Promise.all([
    db
      .from('clients')
      .select('id, name, email, total_revenue, status, due_date')
      .eq('company_id', companyId)
      .order('total_revenue', { ascending: false }),
    db
      .from('financial_data')
      .select('revenue, costs, profit, period_label, period_date')
      .eq('company_id', companyId)
      .order('period_date', { ascending: false })
      .limit(12),
    db
      .from('actions')
      .select('titulo, impacto_estimado, prioridade')
      .eq('company_id', companyId)
      .neq('status', 'done')
      .order('impacto_estimado', { ascending: false })
      .limit(5),
    db
      .from('alerts')
      .select('tipo, titulo, impacto')
      .eq('company_id', companyId)
      .eq('dismissed', false)
      .limit(5),
  ])

  // ── Process clients ─────────────────────────────────────────────────────────
  const rawClients = clientsRes.data ?? []

  const clients: ClientCtx[] = rawClients.map((c) => {
    const effectiveStatus = computeEffectiveStatus(
      (c.status as string) ?? 'pending',
      (c.due_date as string | null) ?? null,
    )

    let dias_atraso = 0
    if (effectiveStatus === 'overdue' && c.due_date) {
      dias_atraso = Math.max(
        0,
        Math.floor((Date.now() - new Date(c.due_date as string).getTime()) / 86_400_000),
      )
    }

    return {
      id:           c.id as string,
      nome:         c.name as string,
      email:        c.email as string | null,
      valor:        (c.total_revenue as number) ?? 0,
      status:       effectiveStatus,
      dias_atraso,
      vencimento:   c.due_date as string | null,
    }
  })

  const overdue  = clients.filter(c => c.status === 'overdue')
  const pending  = clients.filter(c => c.status === 'pending')
  const paid     = clients.filter(c => c.status === 'paid')

  const totalOverdue  = overdue.reduce((s, c) => s + c.valor, 0)
  const totalPending  = pending.reduce((s, c) => s + c.valor, 0)
  const totalPaid     = paid.reduce((s, c) => s + c.valor, 0)
  const totalAll      = clients.reduce((s, c) => s + c.valor, 0)

  const taxa = clients.length > 0
    ? Math.round((overdue.length / clients.length) * 100)
    : 0

  // ── Process financial history ────────────────────────────────────────────────
  const finData = (finRes.data ?? []).map(f => ({
    periodo:    f.period_label as string,
    receita:    (f.revenue as number) ?? 0,
    custos:     (f.costs as number) ?? 0,
    lucro:      (f.profit as number) ?? 0,
    margem_pct: (f.revenue as number) > 0
      ? Math.round(((f.profit as number) / (f.revenue as number)) * 100)
      : 0,
  }))

  // ── Build context ────────────────────────────────────────────────────────────
  const ctx: FinancialContext = {
    total_inadimplente:     totalOverdue,
    total_pendente:         totalPending,
    total_recebido:         totalPaid,
    taxa_inadimplencia:     taxa,

    clientes_inadimplentes: overdue,
    clientes_pendentes:     pending,
    clientes_pagos:         paid,
    todos_clientes:         clients,

    stats: {
      total_clientes: clients.length,
      inadimplentes:  overdue.length,
      pendentes:      pending.length,
      pagos:          paid.length,
      ticket_medio:   clients.length > 0 ? Math.round(totalAll / clients.length) : 0,
      maior_devedor:  overdue.length > 0
        ? overdue.reduce((a, b) => a.valor > b.valor ? a : b)
        : null,
    },

    financeiro:        finData,
    financeiro_atual:  finData[0] ?? null,

    acoes_pendentes: (actionsRes.data ?? []).map(a => ({
      titulo:     a.titulo as string,
      impacto:    (a.impacto_estimado as number) ?? 0,
      prioridade: a.prioridade as string,
    })),

    alertas: (alertsRes.data ?? []).map(a => ({
      tipo:   a.tipo as string,
      titulo: a.titulo as string,
      impacto: a.impacto as string | null,
    })),

    empresa_id: companyId,
    gerado_em:  new Date().toISOString(),
  }

  return ctx
}

// ─── Format helpers for fallback responses ────────────────────────────────────

export function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export function buildSmartFallback(ctx: FinancialContext, question: string): string {
  const q = question.toLowerCase()

  // "quem deve" / "inadimplente" / "devedor"
  if (q.includes('deve') || q.includes('inadimpl') || q.includes('devedor') || q.includes('atraso')) {
    if (ctx.clientes_inadimplentes.length === 0) {
      return 'Ótima notícia! Nenhum cliente inadimplente no momento. ✅'
    }
    const lista = ctx.clientes_inadimplentes
      .map(c => `• **${c.nome}** — ${fmtBRL(c.valor)}${c.dias_atraso > 0 ? ` (${c.dias_atraso} dias em atraso)` : ''}`)
      .join('\n')
    return `Você tem **${ctx.clientes_inadimplentes.length} cliente${ctx.clientes_inadimplentes.length > 1 ? 's' : ''} inadimplente${ctx.clientes_inadimplentes.length > 1 ? 's' : ''}**:\n\n${lista}\n\n**Total inadimplente: ${fmtBRL(ctx.total_inadimplente)}**\n\nRecomendação: contate primeiro quem deve mais — comece por **${ctx.stats.maior_devedor?.nome ?? 'o maior devedor'}** (${fmtBRL(ctx.stats.maior_devedor?.valor ?? 0)}).`
  }

  // "total a receber" / "quanto tenho"
  if (q.includes('receber') || q.includes('quanto') || q.includes('pendente')) {
    return `Seus números atuais:\n\n• **Total inadimplente:** ${fmtBRL(ctx.total_inadimplente)} (${ctx.stats.inadimplentes} clientes)\n• **Total pendente:** ${fmtBRL(ctx.total_pendente)} (${ctx.stats.pendentes} clientes)\n• **Total a receber:** ${fmtBRL(ctx.total_inadimplente + ctx.total_pendente)}\n\nTaxa de inadimplência: **${ctx.taxa_inadimplencia}%**`
  }

  // "taxa" / "inadimplência"
  if (q.includes('taxa') || q.includes('inadimplência')) {
    const situacao = ctx.taxa_inadimplencia > 15
      ? '⚠️ Acima da média de mercado (10-15%). Ative cobrança automática.'
      : ctx.taxa_inadimplencia > 0
        ? '⚠️ Monitore de perto para não aumentar.'
        : '✅ Sem inadimplência no momento!'
    return `Sua taxa de inadimplência é **${ctx.taxa_inadimplencia}%** (${ctx.stats.inadimplentes} de ${ctx.stats.total_clientes} clientes).\n\n${situacao}`
  }

  // "faturamento" / "receita"
  if (q.includes('faturamento') || q.includes('receita') || q.includes('lucro')) {
    if (!ctx.financeiro_atual) {
      return `Você tem **${ctx.stats.total_clientes} clientes** com ticket médio de **${fmtBRL(ctx.stats.ticket_medio)}**.\n\nAdicione dados financeiros em **Dados** para ver análise de faturamento detalhada.`
    }
    const f = ctx.financeiro_atual
    return `**${f.periodo}:**\n\n• Receita: **${fmtBRL(f.receita)}**\n• Custos: **${fmtBRL(f.custos)}**\n• Lucro: **${fmtBRL(f.lucro)}** (margem ${f.margem_pct}%)`
  }

  // Default: summary
  return `Aqui está um resumo da sua empresa:\n\n• **${ctx.stats.total_clientes} clientes** no total\n• **${fmtBRL(ctx.total_inadimplente)}** em atraso (${ctx.stats.inadimplentes} clientes)\n• **${fmtBRL(ctx.total_pendente)}** a vencer (${ctx.stats.pendentes} clientes)\n• Taxa de inadimplência: **${ctx.taxa_inadimplencia}%**\n\nO que mais você quer saber?`
}
