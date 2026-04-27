// ─── Flow Context Builder ─────────────────────────────────────────────────────
// Aggregates business data before flow execution so every node has rich context.
// SERVER-ONLY — never import in client components.

import { getSupabaseServerClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientRecord {
  id:     string
  name:   string
  email:  string | null
  phone:  string | null
  status: string
}

export interface FlowContext {
  clients: {
    total:    number
    active:   number
    inactive: number
    overdue:  number
    records:  ClientRecord[]
  }
  financial: {
    revenue:       number
    expenses:      number
    profit:        number
    overdueAmount: number
  }
  history: {
    lastExecution?: {
      status:          string
      completedAt:     string
      actionsExecuted: number
    }
    totalExecutions: number
    successRate:     number
  }
  insights: string[]
}

type FinancialRow  = { type: string; amount: number }
type InvoiceRow    = { amount: number; status: string }
type ExecutionRow  = { status: string; finished_at: string | null; output: Record<string, unknown> | null }

// ─── Main builder ─────────────────────────────────────────────────────────────

export async function buildFlowContext(
  companyId: string,
  flowId:    string,
): Promise<FlowContext> {
  const db = getSupabaseServerClient()

  const [
    { data: clientsRaw },
    { data: financialRaw },
    { data: execRaw },
    { data: invoicesRaw },
  ] = await Promise.all([
    db
      .from('clients')
      .select('id, name, email, phone, status')
      .eq('company_id', companyId)
      .limit(500),

    db
      .from('financeiro')
      .select('type, amount')
      .eq('company_id', companyId)
      .limit(500),

    db
      .from('flow_executions')
      .select('status, finished_at, output')
      .eq('company_id', companyId)
      .eq('flow_id', flowId)
      .order('created_at', { ascending: false })
      .limit(10),

    db
      .from('invoices')
      .select('amount, status')
      .eq('company_id', companyId)
      .limit(300),
  ])

  const clients    = (clientsRaw   ?? []) as ClientRecord[]
  const financial  = (financialRaw ?? []) as FinancialRow[]
  const executions = (execRaw      ?? []) as ExecutionRow[]
  const invoices   = (invoicesRaw  ?? []) as InvoiceRow[]

  // ── Client stats ──────────────────────────────────────────────────────────
  const active   = clients.filter(c => c.status === 'active').length
  const inactive = clients.filter(c => ['inactive', 'pending'].includes(c.status)).length
  const overdue  = clients.filter(c => c.status === 'overdue').length

  // ── Financial stats ───────────────────────────────────────────────────────
  const revenue  = financial
    .filter(f => f.type === 'receita')
    .reduce((s, f) => s + Number(f.amount ?? 0), 0)
  const expenses = financial
    .filter(f => f.type === 'despesa')
    .reduce((s, f) => s + Number(f.amount ?? 0), 0)
  const overdueAmount = invoices
    .filter(i => i.status === 'overdue')
    .reduce((s, i) => s + Number(i.amount ?? 0), 0)

  // ── Execution history ─────────────────────────────────────────────────────
  const totalExecs   = executions.length
  const successExecs = executions.filter(e => e.status === 'completed').length
  const successRate  = totalExecs > 0 ? successExecs / totalExecs : 0
  const lastExec     = executions[0]

  // ── Auto-generated insights ───────────────────────────────────────────────
  const insights: string[] = []
  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  if (overdueAmount > 0)
    insights.push(`${fmtBRL(overdueAmount)} em inadimplência — recuperação prioritária`)
  if (inactive > 0)
    insights.push(`${inactive} clientes inativos — potencial de reativação`)
  if (revenue - expenses < 0)
    insights.push('Margem negativa — fluxo corretivo recomendado')
  if (overdue > 0)
    insights.push(`${overdue} clientes com status vencido`)
  if (successRate < 0.7 && totalExecs > 3)
    insights.push(`Taxa de sucesso ${Math.round(successRate * 100)}% — revisar configuração do fluxo`)

  return {
    clients: { total: clients.length, active, inactive, overdue, records: clients },
    financial: { revenue, expenses, profit: revenue - expenses, overdueAmount },
    history: {
      lastExecution: lastExec ? {
        status:          lastExec.status,
        completedAt:     lastExec.finished_at ?? '',
        actionsExecuted: (lastExec.output as { actionsExecuted?: number } | null)?.actionsExecuted ?? 0,
      } : undefined,
      totalExecutions: totalExecs,
      successRate,
    },
    insights,
  }
}
