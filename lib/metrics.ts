// lib/metrics.ts — Single source of truth for financial metrics.
//
// All dashboard and financeiro numbers MUST come from here so they stay in sync.
// Canonical priority: invoices table (formal billing) > clients table (manual entries).

import { getSupabaseServerClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PeriodMetrics {
  label:       string
  revenue:     number
  costs:       number
  profit:      number
  period_date: string
}

export interface InvoiceMetrics {
  total_pending:   number
  total_overdue:   number
  total_paid:      number
  total_invoiced:  number
  invoice_count:   number
  overdue_count:   number
  default_rate:    number   // 0–100
}

export interface ClientMetrics {
  total_pending:   number
  total_overdue:   number
  total_paid:      number
  total_receivable: number  // pending + overdue
  client_count:    number
  overdue_count:   number
  default_rate:    number   // 0–100
}

export interface RecoveredMetrics {
  total_ganho:    number
  actions_count:  number
}

export interface CanonicalMetrics {
  total_pending:    number
  total_overdue:    number
  total_paid:       number
  total_receivable: number
  default_rate:     number  // 0–100
  source:           'invoices' | 'clients' | 'empty'
}

export interface UnifiedMetrics {
  latestPeriod: PeriodMetrics | null
  invoices:     InvoiceMetrics
  clients:      ClientMetrics
  recovered:    RecoveredMetrics
  canonical:    CanonicalMetrics
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function getUnifiedMetrics(companyId: string): Promise<UnifiedMetrics> {
  const db = getSupabaseServerClient()

  const [fdRes, invRes, cliRes, histRes] = await Promise.all([
    db
      .from('financial_data')
      .select('period_label, revenue, costs, profit, period_date')
      .eq('company_id', companyId)
      .order('period_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    db
      .from('invoices')
      .select('amount, status')
      .eq('company_id', companyId),

    db
      .from('clients')
      .select('total_revenue, status')
      .eq('company_id', companyId),

    db
      .from('execution_history')
      .select('ganho_realizado')
      .eq('company_id', companyId),
  ])

  // ── Latest financial period ────────────────────────────────────────────────
  const latestPeriod: PeriodMetrics | null = fdRes.data
    ? {
        label:       fdRes.data.period_label as string,
        revenue:     fdRes.data.revenue      as number,
        costs:       fdRes.data.costs        as number,
        profit:      fdRes.data.profit       as number,
        period_date: fdRes.data.period_date  as string,
      }
    : null

  // ── Invoice metrics ────────────────────────────────────────────────────────
  const invoiceRows = (invRes.data ?? []) as Array<{ amount: number; status: string }>
  const invoices: InvoiceMetrics = {
    total_pending:  invoiceRows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0),
    total_overdue:  invoiceRows.filter(r => r.status === 'overdue').reduce((s, r) => s + r.amount, 0),
    total_paid:     invoiceRows.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0),
    total_invoiced: invoiceRows.reduce((s, r) => s + r.amount, 0),
    invoice_count:  invoiceRows.length,
    overdue_count:  invoiceRows.filter(r => r.status === 'overdue').length,
    default_rate:   invoiceRows.length > 0
      ? (invoiceRows.filter(r => r.status === 'overdue').length / invoiceRows.length) * 100
      : 0,
  }

  // ── Client metrics ─────────────────────────────────────────────────────────
  const clientRows = (cliRes.data ?? []) as Array<{ total_revenue: number; status: string }>
  const clients: ClientMetrics = {
    total_pending:    clientRows.filter(r => r.status === 'pending').reduce((s, r) => s + r.total_revenue, 0),
    total_overdue:    clientRows.filter(r => r.status === 'overdue').reduce((s, r) => s + r.total_revenue, 0),
    total_paid:       clientRows.filter(r => r.status === 'paid').reduce((s, r) => s + r.total_revenue, 0),
    total_receivable: clientRows.filter(r => r.status !== 'paid').reduce((s, r) => s + r.total_revenue, 0),
    client_count:     clientRows.length,
    overdue_count:    clientRows.filter(r => r.status === 'overdue').length,
    default_rate:     clientRows.length > 0
      ? (clientRows.filter(r => r.status === 'overdue').length / clientRows.length) * 100
      : 0,
  }

  // ── Recovered metrics ──────────────────────────────────────────────────────
  const histRows = (histRes.data ?? []) as Array<{ ganho_realizado: number }>
  const recovered: RecoveredMetrics = {
    total_ganho:   histRows.reduce((s, r) => s + (r.ganho_realizado ?? 0), 0),
    actions_count: histRows.length,
  }

  // ── Canonical: prefer invoices if populated, else clients ─────────────────
  let canonical: CanonicalMetrics
  if (invoices.invoice_count > 0) {
    const receivable = invoices.total_pending + invoices.total_overdue
    canonical = {
      total_pending:    invoices.total_pending,
      total_overdue:    invoices.total_overdue,
      total_paid:       invoices.total_paid,
      total_receivable: receivable,
      default_rate:     invoices.default_rate,
      source:           'invoices',
    }
  } else if (clients.client_count > 0) {
    canonical = {
      total_pending:    clients.total_pending,
      total_overdue:    clients.total_overdue,
      total_paid:       clients.total_paid,
      total_receivable: clients.total_receivable,
      default_rate:     clients.default_rate,
      source:           'clients',
    }
  } else {
    canonical = {
      total_pending:    0,
      total_overdue:    0,
      total_paid:       0,
      total_receivable: 0,
      default_rate:     0,
      source:           'empty',
    }
  }

  return { latestPeriod, invoices, clients, recovered, canonical }
}
