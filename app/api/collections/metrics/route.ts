// GET /api/collections/metrics?company_id=... — recovery metrics

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { computeEffectiveStatus } from '@/lib/collections'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const db = getSupabaseServerClient()

  // Fetch all clients
  const { data: clients } = await db
    .from('clients')
    .select('id, total_revenue, due_date, status')
    .eq('company_id', company_id)

  // Fetch collection logs
  const { data: logs } = await db
    .from('collection_logs')
    .select('client_id, amount_due, status, method')
    .eq('company_id', company_id)

  const allClients   = clients ?? []
  const allLogs      = logs ?? []

  // Compute overdue clients (via effective_status)
  const overdueClients = allClients.filter(c =>
    computeEffectiveStatus(
      (c.status as string) ?? 'pending',
      (c.due_date as string | null) ?? null,
    ) === 'overdue'
  )

  const overdueCount = overdueClients.length
  const overdueValue = overdueClients.reduce(
    (s, c) => s + ((c.total_revenue as number) ?? 0), 0
  )

  // Recovered = clients currently marked as paid who have at least one log
  const chargedClientIds = new Set(allLogs.map(l => l.client_id as string))
  const recoveredClients = allClients.filter(c =>
    (c.status as string) === 'paid' && chargedClientIds.has(c.id as string)
  )
  const recoveredValue = recoveredClients.reduce(
    (s, c) => s + ((c.total_revenue as number) ?? 0), 0
  )

  // Total charged = distinct clients with at least one log
  const chargedCount = chargedClientIds.size

  // Email-specific: clients that received at least one email
  const emailChargedCount = new Set(
    allLogs
      .filter(l => (l as { method?: string }).method === 'email')
      .map(l => l.client_id as string)
  ).size

  // Recovery rate = recovered / (recovered + overdue)
  const total        = recoveredValue + overdueValue
  const recoveryRate = total > 0 ? Math.round((recoveredValue / total) * 100) : 0

  return NextResponse.json({
    overdueCount,
    overdueValue,
    recoveredValue,
    recoveryRate,
    chargedCount,
    emailChargedCount,
  })
}
