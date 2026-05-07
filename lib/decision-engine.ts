// lib/decision-engine.ts — NEXUS Autonomous Revenue Engine: Decision Layer
//
// Takes real company data and produces typed Decisions with priority,
// trigger type, and expected revenue impact. Completely rule-based — zero
// AI API calls — so it runs fast and free on every cron tick.
//
// Trigger hierarchy (priority 1 = execute first):
//   1. RECOVERY_FLOW   — overdue clients (revenue already earned, just not collected)
//   2. SALES_FLOW      — hot leads with score > 80 (warm pipeline, closes fast)
//   3. REACTIVATION_FLOW — inactive clients 30+ days (churn prevention)
//   4. COLLECTION_FLOW — high default rate (structural problem)
//   5. UPSELL_FLOW     — long-term paid clients (expansion revenue)

import { getSupabaseServerClient } from '@/lib/supabase'
import { getUnifiedMetrics }       from '@/lib/metrics'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriggerType =
  | 'RECOVERY_FLOW'
  | 'SALES_FLOW'
  | 'REACTIVATION_FLOW'
  | 'COLLECTION_FLOW'
  | 'UPSELL_FLOW'

export type DecisionPriority = 1 | 2 | 3 | 4 | 5   // 1 = highest

export interface Decision {
  trigger:                  TriggerType
  priority:                 DecisionPriority
  title:                    string
  rationale:                string
  recommended_action:       string
  execution_type:           'email' | 'whatsapp' | 'recommendation' | 'analytics'
  auto_executable:          boolean
  expected_revenue_impact:  number    // BRL
  metadata:                 Record<string, unknown>
}

export interface DecisionReport {
  companyId:   string
  analyzedAt:  string
  decisions:   Decision[]
  summary:     string
  totalImpact: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000))
}

// ─── Rule evaluators ──────────────────────────────────────────────────────────

function evaluateRecovery(
  totalOverdue:  number,
  overdueCount:  number,
  overdueClients: Array<{ id: string; name: string; total_revenue: number; due_date: string | null; email: string | null; phone: string | null }>
): Decision | null {
  if (overdueCount === 0) return null

  const urgentClients = overdueClients.filter(c => daysAgo(c.due_date) >= 7)
  const hasEmail      = overdueClients.some(c => c.email)
  const hasPhone      = overdueClients.some(c => c.phone)

  return {
    trigger:                 'RECOVERY_FLOW',
    priority:                1,
    title:                   `Recuperar R$ ${Math.round(totalOverdue).toLocaleString('pt-BR')} em ${overdueCount} clientes em atraso`,
    rationale:               `${overdueCount} clientes com pagamentos vencidos. ${urgentClients.length} com mais de 7 dias de atraso. Taxa de recuperação média do setor: 65%.`,
    recommended_action:      hasEmail
      ? `Disparar sequência de cobrança por e-mail para ${overdueCount} clientes (D+1, D+3, D+7)`
      : 'Cadastrar e-mail dos clientes e ativar cobrança automática',
    execution_type:          hasEmail ? 'email' : 'recommendation',
    auto_executable:         hasEmail,
    expected_revenue_impact: totalOverdue * 0.65,
    metadata: {
      overdue_count:   overdueCount,
      total_overdue:   totalOverdue,
      urgent_count:    urgentClients.length,
      has_email:       hasEmail,
      has_phone:       hasPhone,
      client_ids:      overdueClients.map(c => c.id),
    },
  }
}

function evaluateSales(
  hotLeads: Array<{ id: string; name: string; email: string | null; phone: string | null; score: number; last_followup_at: string | null }>
): Decision | null {
  if (hotLeads.length === 0) return null

  const staleLeads = hotLeads.filter(l => daysAgo(l.last_followup_at) >= 24)
  const avgScore   = hotLeads.reduce((s, l) => s + l.score, 0) / hotLeads.length

  // Estimate deal value conservatively (can be refined with real data)
  const estimatedDealValue = 2_500  // BRL — replace with company's real avg ticket if available
  const conversionRate     = 0.35   // 35% conversion for score > 80

  return {
    trigger:                 'SALES_FLOW',
    priority:                2,
    title:                   `${hotLeads.length} lead${hotLeads.length > 1 ? 's' : ''} quente${hotLeads.length > 1 ? 's' : ''} com score > 80 aguardam resposta`,
    rationale:               `Score médio: ${Math.round(avgScore)}. ${staleLeads.length} sem follow-up nas últimas 24h. Leads quentes têm janela de conversão de 48h.`,
    recommended_action:      `Enviar follow-up personalizado para ${hotLeads.length} lead${hotLeads.length > 1 ? 's' : ''} quente${hotLeads.length > 1 ? 's' : ''}`,
    execution_type:          'email',
    auto_executable:         true,
    expected_revenue_impact: hotLeads.length * estimatedDealValue * conversionRate,
    metadata: {
      lead_count:      hotLeads.length,
      stale_count:     staleLeads.length,
      avg_score:       Math.round(avgScore),
      lead_ids:        hotLeads.map(l => l.id),
    },
  }
}

function evaluateReactivation(
  inactiveClients: Array<{ id: string; name: string; email: string | null; total_revenue: number; updated_at: string | null }>
): Decision | null {
  if (inactiveClients.length === 0) return null

  const totalRevenue = inactiveClients.reduce((s, c) => s + c.total_revenue, 0)
  const highValueInactive = inactiveClients.filter(c => c.total_revenue >= 5_000)

  return {
    trigger:                 'REACTIVATION_FLOW',
    priority:                3,
    title:                   `${inactiveClients.length} cliente${inactiveClients.length > 1 ? 's' : ''} inativos há 30+ dias — risco de churn`,
    rationale:               `${inactiveClients.length} clientes sem interação em 30+ dias. ${highValueInactive.length} de alto valor (R$ 5k+). Custo de reativação é 5x menor que aquisição.`,
    recommended_action:      `Enviar campanha de reativação personalizada para ${inactiveClients.length} clientes`,
    execution_type:          'email',
    auto_executable:         inactiveClients.some(c => c.email),
    expected_revenue_impact: totalRevenue * 0.2,  // 20% reactivation rate
    metadata: {
      inactive_count:      inactiveClients.length,
      high_value_count:    highValueInactive.length,
      total_revenue_at_risk: totalRevenue,
      client_ids:          inactiveClients.map(c => c.id),
    },
  }
}

function evaluateCollection(
  defaultRate:  number,
  totalOverdue: number,
  totalClients: number
): Decision | null {
  if (defaultRate < 15 || totalClients < 3) return null

  const severity = defaultRate >= 30 ? 'crítica' : 'alta'

  return {
    trigger:                 'COLLECTION_FLOW',
    priority:                4,
    title:                   `Taxa de inadimplência em ${defaultRate.toFixed(0)}% — implementar régua de cobrança`,
    rationale:               `Inadimplência ${severity}: ${defaultRate.toFixed(1)}% dos clientes. Acima de 15% indica processo de cobrança inadequado. Média saudável do setor: < 8%.`,
    recommended_action:      'Ativar régua automática de cobrança: D+1 lembrete, D+3 alerta, D+7 escalation',
    execution_type:          'analytics',
    auto_executable:         false,
    expected_revenue_impact: totalOverdue * 0.4,
    metadata: {
      default_rate:  defaultRate,
      total_overdue: totalOverdue,
      severity,
    },
  }
}

function evaluateUpsell(
  longTermPaidClients: Array<{ id: string; name: string; email: string | null; total_revenue: number }>
): Decision | null {
  if (longTermPaidClients.length < 2) return null

  const avgRevenue = longTermPaidClients.reduce((s, c) => s + c.total_revenue, 0) / longTermPaidClients.length

  return {
    trigger:                 'UPSELL_FLOW',
    priority:                5,
    title:                   `${longTermPaidClients.length} clientes pagantes elegíveis para upsell`,
    rationale:               `${longTermPaidClients.length} clientes com histórico de pagamento impecável. Receita média: R$ ${Math.round(avgRevenue).toLocaleString('pt-BR')}. Probabilidade de upsell: 60-70%.`,
    recommended_action:      `Enviar oferta de upgrade ou serviço adicional para clientes premium`,
    execution_type:          'email',
    auto_executable:         true,
    expected_revenue_impact: longTermPaidClients.length * avgRevenue * 0.3,
    metadata: {
      eligible_count: longTermPaidClients.length,
      avg_revenue:    Math.round(avgRevenue),
      client_ids:     longTermPaidClients.map(c => c.id),
    },
  }
}

// ─── Main analysis function ───────────────────────────────────────────────────

export async function analyzeCompany(companyId: string): Promise<DecisionReport> {
  const db = getSupabaseServerClient()

  const [metricsResult, clientsResult, leadsResult] = await Promise.all([
    getUnifiedMetrics(companyId),

    db
      .from('clients')
      .select('id, name, email, phone, total_revenue, due_date, status, created_at, updated_at')
      .eq('company_id', companyId),

    db
      .from('leads')
      .select('id, name, email, phone, score, last_followup_at, status')
      .eq('company_id', companyId)
      .gt('score', 80)
      .neq('status', 'converted')
      .neq('status', 'lost'),
  ])

  const clients   = (clientsResult.data ?? []) as Array<{
    id: string; name: string; email: string | null; phone: string | null
    total_revenue: number; due_date: string | null; status: string
    created_at: string; updated_at: string | null
  }>
  const hotLeads  = (leadsResult.data ?? []) as Array<{
    id: string; name: string; email: string | null; phone: string | null
    score: number; last_followup_at: string | null; status: string
  }>

  // ── Derive client segments ─────────────────────────────────────────────────
  const overdueClients  = clients.filter(c => c.status === 'overdue')
  const totalOverdue    = metricsResult.canonical.total_overdue
  const defaultRate     = metricsResult.canonical.default_rate

  const inactiveClients = clients.filter(c =>
    c.status !== 'paid' && daysAgo(c.updated_at) >= 30
  )

  const longTermPaid = clients.filter(c =>
    c.status === 'paid' && daysAgo(c.created_at) >= 90
  )

  // ── Evaluate all rules ─────────────────────────────────────────────────────
  const candidates = [
    evaluateRecovery(totalOverdue, overdueClients.length, overdueClients),
    evaluateSales(hotLeads),
    evaluateReactivation(inactiveClients),
    evaluateCollection(defaultRate, totalOverdue, clients.length),
    evaluateUpsell(longTermPaid),
  ]

  const decisions = candidates
    .filter((d): d is Decision => d !== null)
    .sort((a, b) => a.priority - b.priority)

  const totalImpact = decisions.reduce((s, d) => s + d.expected_revenue_impact, 0)

  const summary =
    decisions.length === 0
      ? 'Nenhuma ação urgente detectada — empresa em estado saudável'
      : `${decisions.length} decisão${decisions.length > 1 ? 'ões' : ''} identificada${decisions.length > 1 ? 's' : ''} — impacto potencial: R$ ${Math.round(totalImpact).toLocaleString('pt-BR')}`

  return {
    companyId,
    analyzedAt: new Date().toISOString(),
    decisions,
    summary,
    totalImpact,
  }
}
