// POST /api/retention/detect
// Scans for at-risk clients, records retention_events, and optionally
// triggers any flows tagged with triggerType: 'client_at_risk'.
//
// Body: { company_id, inactive_days?, dry_run? }

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { getString, getNumber, getBoolean, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

type ClientRow = {
  id:         string
  name:       string
  email:      string | null
  phone:      string | null
  status:     string
  created_at: string
}

type InvoiceRef = { customer_id: string }

type RetentionReason = 'inactive' | 'overdue_invoice' | 'no_contact'

interface AtRiskClient extends ClientRow {
  risk_reason: RetentionReason
}

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const company_id    = getString(body, 'company_id')
  const inactive_days = getNumber(body, 'inactive_days') ?? 30
  const dry_run       = getBoolean(body, 'dry_run') ?? false

  if (!company_id) {
    return NextResponse.json({ error: 'company_id required' }, { status: 400 })
  }

  const db = getSupabaseServerClient()

  // ── 1. Fetch all active clients ───────────────────────────────────────────
  const { data: clients, error: clientsErr } = await db
    .from('clients')
    .select('id, name, email, phone, status, created_at')
    .eq('company_id', company_id)
    .eq('status', 'active')
    .returns<ClientRow[]>()

  if (clientsErr) return NextResponse.json({ error: clientsErr.message }, { status: 500 })

  const allClients = clients ?? []

  // ── 2. Overdue invoice client ids ─────────────────────────────────────────
  const { data: overdueInvoices } = await db
    .from('invoices')
    .select('customer_id')
    .eq('company_id', company_id)
    .eq('status', 'overdue')
    .returns<InvoiceRef[]>()

  const overdueIds = new Set((overdueInvoices ?? []).map(i => i.customer_id))

  // ── 3. Recently active client ids (within inactive_days) ──────────────────
  const cutoff    = new Date()
  cutoff.setDate(cutoff.getDate() - inactive_days)
  const cutoffISO = cutoff.toISOString()

  const { data: recentInvoices } = await db
    .from('invoices')
    .select('customer_id')
    .eq('company_id', company_id)
    .gte('created_at', cutoffISO)
    .returns<InvoiceRef[]>()

  const recentIds = new Set((recentInvoices ?? []).map(i => i.customer_id))

  // ── 4. Clients already in a pending retention event (avoid duplicate events) ─
  const { data: existingEvents } = await db
    .from('retention_events')
    .select('client_id')
    .eq('company_id', company_id)
    .is('resolved_at', null)

  const alreadyTracked = new Set(
    ((existingEvents ?? []) as { client_id: string }[]).map(e => e.client_id)
  )

  // ── 5. Classify at-risk clients ───────────────────────────────────────────
  const accountAgeCutoff = new Date()
  accountAgeCutoff.setDate(accountAgeCutoff.getDate() - inactive_days)

  const atRisk: AtRiskClient[] = allClients
    .filter(c => {
      if (alreadyTracked.has(c.id)) return false
      const accountOld = new Date(c.created_at) < accountAgeCutoff
      return overdueIds.has(c.id) || (!recentIds.has(c.id) && accountOld)
    })
    .map(c => ({
      ...c,
      risk_reason: (overdueIds.has(c.id) ? 'overdue_invoice' : 'inactive') as RetentionReason,
    }))

  if (dry_run) {
    return NextResponse.json({
      dry_run:        true,
      at_risk_count:  atRisk.length,
      at_risk_clients: atRisk,
    })
  }

  // ── 6. Record retention events ────────────────────────────────────────────
  let eventsCreated = 0
  const errors: string[] = []

  if (atRisk.length > 0) {
    const rows = atRisk.map(c => ({
      company_id,
      client_id:    c.id,
      reason:       c.risk_reason,
      action_taken: 'none',
      result:       'pending',
      metadata:     { client_name: c.name, client_email: c.email },
    }))

    const { error: insertErr } = await db.from('retention_events').insert(rows)
    if (insertErr) {
      errors.push(insertErr.message)
    } else {
      eventsCreated = rows.length
    }
  }

  // ── 7. Find flows with CLIENT_AT_RISK trigger and enqueue them ────────────
  const { data: flows } = await db
    .from('flows')
    .select('id, name, definition')
    .eq('company_id', company_id)
    .eq('is_active', true)

  type FlowDef = { nodes?: Array<{ type?: string; config?: { triggerType?: string } }> }
  type FlowRow = { id: string; name: string; definition: FlowDef | null }

  const atRiskFlows = ((flows ?? []) as FlowRow[]).filter(f => {
    const nodes = f.definition?.nodes ?? []
    return nodes.some(n => n.config?.triggerType === 'client_at_risk')
  })

  const triggeredFlows: string[] = []

  for (const flow of atRiskFlows) {
    for (const client of atRisk) {
      try {
        await db.from('flow_queue').insert({
          flow_id:    flow.id,
          company_id,
          status:     'pending',
          variables:  { client, risk_reason: client.risk_reason },
          created_at: new Date().toISOString(),
        })
        triggeredFlows.push(`${flow.name} → ${client.name}`)
      } catch {
        // queue insert failures are non-critical
      }
    }
  }

  return NextResponse.json({
    at_risk_count:    atRisk.length,
    events_created:   eventsCreated,
    flows_triggered:  triggeredFlows.length,
    triggered_flows:  triggeredFlows,
    errors,
  })
}
