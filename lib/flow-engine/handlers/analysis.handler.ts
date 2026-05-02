import { getSupabaseServerClient } from '@/lib/supabase'
import type { FlowNode, ExecutionContext, NodeResult } from '../types'

type SupabaseClient = ReturnType<typeof getSupabaseServerClient>

interface AnalysisConfig {
  dataSource?: 'clients' | 'invoices' | 'overdue' | 'financial' | 'all_clients'
             | 'leads' | 'new_leads' | 'at_risk_clients'
  filters?:    Record<string, unknown>
  limit?:      number
  inactiveDays?: number
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

  const inactiveDays = config.inactiveDays ?? 30

  try {
    const output = await fetchData(db, ctx.companyId, source, limit, config.filters, inactiveDays)

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
  db:           SupabaseClient,
  companyId:    string,
  source:       string,
  limit:        number,
  _filters?:    Record<string, unknown>,
  inactiveDays?: number,
): Promise<AnalysisOutput> {
  switch (source) {
    case 'overdue':         return fetchOverdue(db, companyId, limit)
    case 'invoices':        return fetchInvoices(db, companyId, limit)
    case 'financial':       return fetchFinancial(db, companyId, limit)
    case 'inactive':        return fetchInactiveClients(db, companyId, limit)
    case 'all_clients':     return fetchClients(db, companyId, limit)
    case 'leads':           return fetchLeads(db, companyId, limit, _filters)
    case 'new_leads':       return fetchLeads(db, companyId, limit, { ..._filters, status: 'new' })
    case 'at_risk_clients': return fetchAtRiskClients(db, companyId, limit, inactiveDays ?? 30)
    default:                return fetchClients(db, companyId, limit)
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

async function fetchLeads(
  db:        SupabaseClient,
  companyId: string,
  limit:     number,
  filters?:  Record<string, unknown>,
): Promise<AnalysisOutput> {
  let q = db
    .from('leads')
    .select('id, name, email, phone, status, source, notes, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Allow filtering by status via filters map
  const statusFilter = filters?.status as string | undefined
  if (statusFilter) q = q.eq('status', statusFilter)

  const { data } = await q
  const records  = data ?? []

  const newCount  = records.filter(r => (r as { status?: string }).status === 'new').length
  const contacted = records.filter(r => (r as { status?: string }).status === 'contacted').length
  const converted = records.filter(r => (r as { status?: string }).status === 'converted').length

  return {
    count:   records.length,
    records,
    summary: {
      total:           records.length,
      new:             newCount,
      contacted,
      converted,
      conversion_rate: records.length > 0 ? Math.round((converted / records.length) * 100) : 0,
    },
    source: statusFilter ? `leads_${statusFilter}` : 'leads',
  }
}

async function fetchAtRiskClients(
  db:           SupabaseClient,
  companyId:    string,
  limit:        number,
  inactiveDays: number,
): Promise<AnalysisOutput> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - inactiveDays)
  const cutoffISO = cutoff.toISOString()

  // Clients with no paid invoice in the last N days OR with overdue invoices
  const { data: clients } = await db
    .from('clients')
    .select('id, name, email, phone, status, created_at')
    .eq('company_id', companyId)
    .limit(limit * 3) // over-fetch to filter

  const allClients = (clients ?? []) as Array<{
    id: string; name: string; email: string | null
    phone: string | null; status: string; created_at: string
  }>

  // Fetch overdue invoice client ids
  const { data: overdueInvoices } = await db
    .from('invoices')
    .select('customer_id')
    .eq('company_id', companyId)
    .eq('status', 'overdue')

  const overdueClientIds = new Set((overdueInvoices ?? []).map(i => (i as { customer_id: string }).customer_id))

  // Fetch client ids that had any invoice activity recently
  const { data: recentInvoices } = await db
    .from('invoices')
    .select('customer_id')
    .eq('company_id', companyId)
    .gte('created_at', cutoffISO)

  const recentClientIds = new Set((recentInvoices ?? []).map(i => (i as { customer_id: string }).customer_id))

  // A client is "at risk" if:
  // 1. Has an overdue invoice, OR
  // 2. Has no invoice activity in the last N days (and account is older than N days)
  const atRisk = allClients
    .filter(c => {
      const hasOverdue    = overdueClientIds.has(c.id)
      const isInactive    = !recentClientIds.has(c.id)
      const accountOldEnough = new Date(c.created_at) < cutoff
      return hasOverdue || (isInactive && accountOldEnough)
    })
    .map(c => ({
      ...c,
      risk_reason: overdueClientIds.has(c.id) ? 'overdue_invoice' : 'inactive',
    }))
    .slice(0, limit)

  const overdueCount  = atRisk.filter(c => c.risk_reason === 'overdue_invoice').length
  const inactiveCount = atRisk.filter(c => c.risk_reason === 'inactive').length

  return {
    count:   atRisk.length,
    records: atRisk,
    summary: {
      total:           atRisk.length,
      overdue_invoice: overdueCount,
      inactive:        inactiveCount,
      inactive_days:   inactiveDays,
    },
    source: 'at_risk_clients',
  }
}
