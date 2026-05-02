// GET /api/revenue/metrics
// Returns revenue engine KPIs: recovered, overdue, conversion rate, actions by type.

import { NextResponse }             from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { companyId } = ctx

  const [logsRes, clientsRes, eventsRes] = await Promise.all([
    db.from('collection_logs')
      .select('status, amount_due, action_type, segment, created_at')
      .eq('company_id', companyId),

    db.from('clients')
      .select('status, total_revenue')
      .eq('company_id', companyId),

    // revenue_events only exists after migration 20240006
    db.from('revenue_events')
      .select('amount, event_type, source, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
  ])

  // Gracefully handle missing revenue_events table (pre-migration)
  const logs    = logsRes.data    ?? []
  const clients = clientsRes.data ?? []
  const events  = eventsRes.error ? [] : (eventsRes.data ?? [])

  // ── Collection funnel ─────────────────────────────────────────
  const totalSent     = logs.length
  const totalDelivered = logs.filter(l => l.status === 'sent' || l.status === 'paid').length
  const totalPaid     = logs.filter(l => l.status === 'paid').length
  const conversionRate = totalDelivered > 0
    ? Math.round((totalPaid / totalDelivered) * 100)
    : 0

  // ── Recovery amounts ──────────────────────────────────────────
  const recoveredAmount = events
    .filter(e => e.event_type === 'payment_received')
    .reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0)

  // ── Client segment breakdown ──────────────────────────────────
  const overdueClients = clients.filter(c => c.status === 'overdue').length
  const overdueValue   = clients
    .filter(c => c.status === 'overdue')
    .reduce((sum, c) => sum + Number(c.total_revenue), 0)

  const paidClients    = clients.filter(c => c.status === 'paid').length
  const totalRevenue   = clients.reduce((sum, c) => sum + Number(c.total_revenue), 0)

  // ── Actions breakdown ─────────────────────────────────────────
  const actionsByType = logs.reduce<Record<string, number>>((acc, l) => {
    const k = (l.action_type as string | null) ?? 'unknown'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

  const messagesByMethod = logs.reduce<Record<string, number>>((acc, l) => {
    const k = 'method' in l ? String((l as Record<string, unknown>).method ?? 'unknown') : 'unknown'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

  // ── Recent events (last 10) ───────────────────────────────────
  const recentEvents = events.slice(0, 10)

  return NextResponse.json({
    // Money
    recoveredAmount,
    overdueValue,
    totalRevenue,

    // Clients
    totalClients:  clients.length,
    overdueClients,
    paidClients,

    // Funnel
    totalSent,
    totalDelivered,
    totalPaid,
    conversionRate,

    // Breakdowns
    actionsByType,
    messagesByMethod,

    // Recent
    recentEvents,
  })
}
