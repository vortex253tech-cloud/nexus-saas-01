// ─── Business Advisor — Types & Context Builder ────────────────────────────
// Server-only. Powers /api/ai/business-analysis.

import { getSupabaseServerClient } from '@/lib/supabase'

// ─── Output schema (matches API spec) ─────────────────────────────────────

export interface BusinessInsight {
  id:          string
  title:       string
  description: string
  impact:      string       // "R$ 4.200/mês"
  category:    'revenue' | 'cost' | 'retention' | 'operational' | 'pricing'
  priority:    'high' | 'medium' | 'low'
  icon:        string
  data_source: string       // which input drove this insight
}

export interface BusinessRisk {
  id:          string
  title:       string
  description: string
  severity:    'critical' | 'high' | 'medium' | 'low'
  probability: 'high' | 'medium' | 'low'
  impact:      string
  mitigation:  string
}

export interface BusinessOpportunity {
  id:            string
  title:         string
  description:   string
  potential_gain: string    // "R$ 12.000/mês"
  timeframe:     string     // "30 dias"
  effort:        'low' | 'medium' | 'high'
  category:      string
  why_now:       string     // urgency justification
}

export interface RecommendedAction {
  id:               string
  title:            string
  description:      string
  priority:         1 | 2 | 3 | 4 | 5       // 1 = most urgent
  impact_estimate:  string                   // "R$ 3.500/mês"
  deadline:         string                   // "Hoje" | "3 dias" | "1 semana"
  steps:            string[]
  auto_executable:  boolean
  execution_type:   'email' | 'whatsapp' | 'automation' | 'analysis' | 'manual'
}

export interface BusinessAnalysis {
  insights:             BusinessInsight[]
  risks:                BusinessRisk[]
  opportunities:        BusinessOpportunity[]
  recommended_actions:  RecommendedAction[]
  // Metadata
  score:      number    // 0-100 business health
  summary:    string    // 2-3 sentence executive summary
  score_breakdown: {
    collections: number
    cashflow:    number
    growth:      number
    operations:  number
  }
  analyzed_at: string
  data_coverage: {     // which data types were actually available
    financial:   boolean
    clients:     boolean
    messages:    boolean
    executions:  boolean
  }
}

// ─── Input data fetcher ────────────────────────────────────────────────────

export interface RawBusinessData {
  financial:  FinancialRow[]
  clients:    ClientRow[]
  messages:   MessageRow[]
  executions: ExecutionRow[]
  company:    CompanyRow | null
}

export interface FinancialRow {
  period_label: string
  period_date:  string
  revenue:      number
  costs:        number
  profit:       number
}

export interface ClientRow {
  id:            string
  name:          string
  email:         string | null
  total_revenue: number
  status:        string
  due_date:      string | null
}

export interface MessageRow {
  id:        string
  type:      string
  status:    string
  client_id: string | null
  sent_at:   string | null
  opened:    boolean | null
}

export interface ExecutionRow {
  id:          string
  status:      string
  action_type: string | null
  executed_at: string | null
  result:      string | null
}

export interface CompanyRow {
  nome_empresa:      string | null
  setor:             string | null
  perfil:            string | null
  principal_desafio: string | null
  meta_mensal:       number | null
}

export async function fetchBusinessData(companyId: string): Promise<RawBusinessData> {
  const db = getSupabaseServerClient()

  const [finRes, clientRes, msgRes, execRes, compRes] = await Promise.all([
    db.from('financial_data')
      .select('period_label, period_date, revenue, costs, profit')
      .eq('company_id', companyId)
      .order('period_date', { ascending: false })
      .limit(12),

    db.from('clients')
      .select('id, name, email, total_revenue, status, due_date')
      .eq('company_id', companyId)
      .order('total_revenue', { ascending: false })
      .limit(100),

    db.from('message_history')
      .select('id, type, status, client_id, sent_at, opened')
      .eq('company_id', companyId)
      .order('sent_at', { ascending: false })
      .limit(200),

    db.from('execution_history')
      .select('id, status, action_type, executed_at, result')
      .eq('company_id', companyId)
      .order('executed_at', { ascending: false })
      .limit(100),

    db.from('companies')
      .select('nome_empresa, setor, perfil, principal_desafio, meta_mensal')
      .eq('id', companyId)
      .single(),
  ])

  return {
    financial:  (finRes.data  ?? [])  as FinancialRow[],
    clients:    (clientRes.data ?? []) as ClientRow[],
    messages:   (msgRes.data   ?? []) as MessageRow[],
    executions: (execRes.data  ?? []) as ExecutionRow[],
    company:    compRes.data as CompanyRow | null,
  }
}

// ─── Context builder ───────────────────────────────────────────────────────

export function buildAnalysisContext(data: RawBusinessData): string {
  const sections: string[] = []
  const company = data.company

  // ── Company profile ─────────────────────────────────────────────────────
  if (company) {
    sections.push(`EMPRESA:
Nome: ${company.nome_empresa ?? 'Não informado'}
Setor: ${company.setor ?? 'Não informado'}
Perfil: ${company.perfil ?? 'Não informado'}
Principal desafio: ${company.principal_desafio ?? 'Não informado'}
Meta mensal: ${company.meta_mensal ? `R$ ${company.meta_mensal.toLocaleString('pt-BR')}` : 'Não informada'}`)
  }

  // ── Financial data ──────────────────────────────────────────────────────
  if (data.financial.length > 0) {
    const sorted = [...data.financial].sort(
      (a, b) => new Date(b.period_date).getTime() - new Date(a.period_date).getTime()
    )
    const latest = sorted[0]
    const prev   = sorted[1] ?? null
    const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`

    const margin = latest.revenue > 0
      ? ((latest.profit / latest.revenue) * 100).toFixed(1) : '0'

    let trend = ''
    if (prev) {
      const diff = latest.profit - prev.profit
      const pct  = prev.profit !== 0 ? ((diff / Math.abs(prev.profit)) * 100).toFixed(1) : '0'
      trend = `Variação lucro vs período anterior: ${diff >= 0 ? '+' : ''}${fmtBRL(diff)} (${pct}%)`
    }

    const history = sorted
      .map(f => `  ${f.period_label}: Receita ${fmtBRL(f.revenue)} | Custos ${fmtBRL(f.costs)} | Lucro ${fmtBRL(f.profit)}`)
      .join('\n')

    sections.push(`DADOS FINANCEIROS (${sorted.length} períodos):
Período atual: ${latest.period_label}
Receita: ${fmtBRL(latest.revenue)}
Custos: ${fmtBRL(latest.costs)}
Lucro: ${fmtBRL(latest.profit)}
Margem: ${margin}%
${trend}

Histórico:
${history}`)
  } else {
    sections.push('DADOS FINANCEIROS: Nenhum dado financeiro registrado.')
  }

  // ── Clients ─────────────────────────────────────────────────────────────
  if (data.clients.length > 0) {
    const now = Date.now()
    const overdue = data.clients.filter(c => {
      if (c.status === 'paid') return false
      if (!c.due_date) return c.status === 'overdue'
      return new Date(c.due_date).getTime() < now
    })
    const pending = data.clients.filter(c => {
      if (c.status === 'paid') return false
      if (!c.due_date) return c.status === 'pending'
      return new Date(c.due_date).getTime() >= now
    })
    const paid    = data.clients.filter(c => c.status === 'paid')

    const totalOverdue = overdue.reduce((s, c) => s + (c.total_revenue ?? 0), 0)
    const totalPending = pending.reduce((s, c) => s + (c.total_revenue ?? 0), 0)
    const totalAll     = data.clients.reduce((s, c) => s + (c.total_revenue ?? 0), 0)
    const taxaInadimpl = data.clients.length > 0
      ? ((overdue.length / data.clients.length) * 100).toFixed(1) : '0'

    const topOverdue = [...overdue]
      .sort((a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0))
      .slice(0, 5)
      .map(c => `  - ${c.name}: R$ ${(c.total_revenue ?? 0).toLocaleString('pt-BR')} (venc: ${c.due_date ?? 'não definido'})`)
      .join('\n')

    sections.push(`CLIENTES (${data.clients.length} total):
Inadimplentes: ${overdue.length} clientes — R$ ${totalOverdue.toLocaleString('pt-BR')}
Pendentes: ${pending.length} clientes — R$ ${totalPending.toLocaleString('pt-BR')}
Adimplentes: ${paid.length} clientes
Ticket médio: R$ ${data.clients.length > 0 ? Math.round(totalAll / data.clients.length).toLocaleString('pt-BR') : '0'}
Taxa inadimplência: ${taxaInadimpl}%
${topOverdue ? `\nMaiores inadimplentes:\n${topOverdue}` : ''}`)
  } else {
    sections.push('CLIENTES: Nenhum cliente cadastrado.')
  }

  // ── Messages ─────────────────────────────────────────────────────────────
  if (data.messages.length > 0) {
    const sentCount   = data.messages.filter(m => m.status === 'sent' || m.status === 'delivered').length
    const openedCount = data.messages.filter(m => m.opened === true).length
    const failedCount = data.messages.filter(m => m.status === 'failed').length
    const openRate    = sentCount > 0 ? ((openedCount / sentCount) * 100).toFixed(1) : '0'

    const byType: Record<string, number> = {}
    data.messages.forEach(m => { byType[m.type ?? 'unknown'] = (byType[m.type ?? 'unknown'] ?? 0) + 1 })
    const typeBreakdown = Object.entries(byType)
      .map(([type, count]) => `  ${type}: ${count}`)
      .join('\n')

    const lastMsg = data.messages[0]?.sent_at
      ? new Date(data.messages[0].sent_at).toLocaleDateString('pt-BR') : 'desconhecido'

    sections.push(`MENSAGENS (${data.messages.length} total, último 200):
Enviadas/entregues: ${sentCount}
Abertas: ${openedCount} (taxa: ${openRate}%)
Falhas: ${failedCount}
Último envio: ${lastMsg}

Por tipo:
${typeBreakdown}`)
  } else {
    sections.push('MENSAGENS: Nenhum histórico de mensagens.')
  }

  // ── Executions ───────────────────────────────────────────────────────────
  if (data.executions.length > 0) {
    const successCount = data.executions.filter(e => e.status === 'success' || e.status === 'completed').length
    const failedCount  = data.executions.filter(e => e.status === 'failed' || e.status === 'error').length
    const pendingCount = data.executions.filter(e => e.status === 'pending' || e.status === 'running').length
    const successRate  = data.executions.length > 0
      ? ((successCount / data.executions.length) * 100).toFixed(1) : '0'

    const byType: Record<string, number> = {}
    data.executions.forEach(e => { byType[e.action_type ?? 'unknown'] = (byType[e.action_type ?? 'unknown'] ?? 0) + 1 })
    const typeBreakdown = Object.entries(byType)
      .map(([type, count]) => `  ${type}: ${count}`)
      .join('\n')

    sections.push(`EXECUÇÕES/AUTOMAÇÕES (${data.executions.length} total):
Sucesso: ${successCount} (${successRate}%)
Falhas: ${failedCount}
Pendentes/em execução: ${pendingCount}

Por tipo de ação:
${typeBreakdown}`)
  } else {
    sections.push('EXECUÇÕES: Nenhuma automação executada ainda.')
  }

  return sections.join('\n\n─────────────────────────────────\n\n')
}

// ─── Stub (no API key) ─────────────────────────────────────────────────────

export function buildStubAnalysis(data: RawBusinessData): BusinessAnalysis {
  const fin      = data.financial[0]
  const clients  = data.clients
  const overdue  = clients.filter(c => c.status === 'overdue')
  const totalInad = overdue.reduce((s, c) => s + (c.total_revenue ?? 0), 0)

  const score = Math.min(100, Math.max(10,
    90
    - (overdue.length > 0 ? Math.min(40, overdue.length * 5) : 0)
    - (fin && fin.profit < 0 ? 20 : 0)
  ))

  return {
    score,
    summary: `Análise baseada em ${data.financial.length} períodos financeiros e ${clients.length} clientes. ${overdue.length > 0 ? `Atenção: ${overdue.length} clientes inadimplentes.` : 'Adimplência saudável.'} Configure ANTHROPIC_API_KEY para análise completa com IA.`,
    score_breakdown: { collections: 70, cashflow: 65, growth: 60, operations: 55 },
    analyzed_at: new Date().toISOString(),
    data_coverage: {
      financial:  data.financial.length > 0,
      clients:    data.clients.length > 0,
      messages:   data.messages.length > 0,
      executions: data.executions.length > 0,
    },
    insights: [
      ...(totalInad > 0 ? [{
        id: 'insight-1', icon: '⚠️',
        title: `R$ ${totalInad.toLocaleString('pt-BR')} em inadimplência`,
        description: `${overdue.length} clientes com pagamentos em atraso.`,
        impact: `R$ ${totalInad.toLocaleString('pt-BR')}`, category: 'retention' as const,
        priority: 'high' as const, data_source: 'clients',
      }] : []),
      ...(fin ? [{
        id: 'insight-2', icon: '📊',
        title: `Margem de lucro: ${fin.revenue > 0 ? ((fin.profit / fin.revenue) * 100).toFixed(1) : 0}%`,
        description: `Receita de R$ ${fin.revenue.toLocaleString('pt-BR')} com lucro de R$ ${fin.profit.toLocaleString('pt-BR')}.`,
        impact: `R$ ${fin.profit.toLocaleString('pt-BR')}/mês`, category: 'revenue' as const,
        priority: 'medium' as const, data_source: 'financial',
      }] : []),
    ],
    risks: [
      ...(overdue.length > 3 ? [{
        id: 'risk-1',
        title: 'Alto volume de inadimplência',
        description: `${overdue.length} clientes em atraso pode indicar problema de fluxo de caixa.`,
        severity: 'high' as const, probability: 'high' as const,
        impact: `Perda de R$ ${totalInad.toLocaleString('pt-BR')}`,
        mitigation: 'Ative a cobrança automática e implemente régua de comunicação.',
      }] : []),
      ...(fin && fin.profit < 0 ? [{
        id: 'risk-2',
        title: 'Operação no prejuízo',
        description: `Lucro negativo de R$ ${fin.profit.toLocaleString('pt-BR')} no período atual.`,
        severity: 'critical' as const, probability: 'high' as const,
        impact: `R$ ${Math.abs(fin.profit).toLocaleString('pt-BR')}/mês`,
        mitigation: 'Revise custos imediatamente e identifique onde cortar despesas.',
      }] : []),
    ],
    opportunities: [
      {
        id: 'opp-1',
        title: 'Automação de cobranças',
        description: 'Implemente régua automática de cobrança para reduzir inadimplência.',
        potential_gain: `R$ ${Math.round(totalInad * 0.6).toLocaleString('pt-BR')}`,
        timeframe: '7 dias', effort: 'low', category: 'retention',
        why_now: 'Cada dia sem cobrar aumenta a chance de não receber.',
      },
    ],
    recommended_actions: [
      {
        id: 'action-1', priority: 1,
        title: 'Ativar cobrança automática',
        description: 'Configure automação de cobrança para clientes inadimplentes.',
        impact_estimate: `R$ ${Math.round(totalInad * 0.5).toLocaleString('pt-BR')}/mês`,
        deadline: 'Hoje',
        steps: [
          'Acesse Automações no dashboard',
          'Ative a régua de cobrança automática',
          'Configure canal preferencial (WhatsApp ou e-mail)',
          'Defina frequência: 3, 7 e 15 dias após vencimento',
        ],
        auto_executable: true, execution_type: 'automation',
      },
    ],
  }
}
