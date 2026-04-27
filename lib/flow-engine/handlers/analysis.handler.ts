import { getSupabaseServerClient } from '@/lib/supabase'
import type { FlowNode, ExecutionContext, NodeResult } from '../types'

type SupabaseClient = ReturnType<typeof getSupabaseServerClient>

interface AnalysisConfig {
  dataSource?: 'clients' | 'invoices' | 'overdue' | 'financial' | 'all_clients'
  filters?:    Record<string, unknown>
  limit?:      number
}

interface AnalysisOutput {
  count:   number
  records: unknown[]
  summary: Record<string, unknown>
  source:  string
}

// ─── Analysis handler ─────────────────────────────────────────────────────────
// Fetches structured data from the database and exposes it to downstream nodes.

export async function handleAnalysis(
  node: FlowNode,
  ctx:  ExecutionContext,
): Promise<NodeResult> {
  const config = node.config as AnalysisConfig
  const db     = getSupabaseServerClient()
  const source = config.dataSource ?? 'clients'
  const limit  = config.limit ?? 100

  try {
    const output = await fetchData(db, ctx.companyId, source, limit, config.filters)

    return {
      success: true,
      output,
      message: `Analysed ${output.count} records from "${source}"`,
    }
  } catch (err) {
    return {
      success: false,
      output:  null,
      message: `Analysis failed for "${source}": ${String(err)}`,
    }
  }
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchData(
  db:        SupabaseClient,
  companyId: string,
  source:    string,
  limit:     number,
  _filters?: Record<string, unknown>,
): Promise<AnalysisOutput> {
  switch (source) {
    case 'overdue':     return fetchOverdue(db, companyId, limit)
    case 'invoices':    return fetchInvoices(db, companyId, limit)
    case 'financial':   return fetchFinancial(db, companyId, limit)
    case 'inactive':    return fetchInactiveClients(db, companyId, limit)
    case 'all_clients': return fetchClients(db, companyId, limit)
    default:            return fetchClients(db, companyId, limit)
  }
}

async function fetchOverdue(db: SupabaseClient, companyId: string, limit: number): Promise<AnalysisOutput> {
  const { data } = await db
    .from('invoices')
    .select('id, amount, due_date, client_id, status')
    .eq('company_id', companyId)
    .eq('status', 'overdue')
    .limit(limit)

  const records = data ?? []
  const totalOverdue = records.reduce((s, r) => s + Number((r as { amount?: number }).amount ?? 0), 0)

  return {
    count:   records.length,
    records,
    summary: { total_overdue: totalOverdue },
    source:  'overdue',
  }
}

async function fetchInvoices(db: SupabaseClient, companyId: string, limit: number): Promise<AnalysisOutput> {
  const { data } = await db
    .from('invoices')
    .select('id, amount, status, due_date, client_id')
    .eq('company_id', companyId)
    .order('due_date', { ascending: false })
    .limit(limit)

  const records = data ?? []
  const total   = records.reduce((s, r) => s + Number((r as { amount?: number }).amount ?? 0), 0)
  const paid    = records.filter(r => (r as { status?: string }).status === 'paid').length
  const overdue = records.filter(r => (r as { status?: string }).status === 'overdue').length

  return {
    count:   records.length,
    records,
    summary: { total_amount: total, paid_count: paid, overdue_count: overdue },
    source:  'invoices',
  }
}

async function fetchFinancial(db: SupabaseClient, companyId: string, limit: number): Promise<AnalysisOutput> {
  const { data } = await db
    .from('financeiro')
    .select('id, type, amount, category, date')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .limit(limit)

  const records  = data ?? []
  const revenue  = records.filter(r => (r as { type?: string }).type === 'receita')
    .reduce((s, r) => s + Number((r as { amount?: number }).amount ?? 0), 0)
  const expenses = records.filter(r => (r as { type?: string }).type === 'despesa')
    .reduce((s, r) => s + Number((r as { amount?: number }).amount ?? 0), 0)

  return {
    count:   records.length,
    records,
    summary: { revenue, expenses, profit: revenue - expenses },
    source:  'financial',
  }
}

async function fetchInactiveClients(db: SupabaseClient, companyId: string, limit: number): Promise<AnalysisOutput> {
  const { data } = await db
    .from('clients')
    .select('id, name, email, status, phone')
    .eq('company_id', companyId)
    .eq('status', 'inactive')
    .limit(limit)

  const records = data ?? []

  return {
    count:   records.length,
    records,
    summary: { total: records.length, inactive: records.length },
    source:  'inactive',
  }
}

async function fetchClients(db: SupabaseClient, companyId: string, limit: number): Promise<AnalysisOutput> {
  const { data } = await db
    .from('clients')
    .select('id, name, email, status, phone')
    .eq('company_id', companyId)
    .limit(limit)

  const records = data ?? []
  const active  = records.filter(r => (r as { status?: string }).status === 'active').length

  return {
    count:   records.length,
    records,
    summary: { total: records.length, active, inactive: records.length - active },
    source:  'clients',
  }
}
