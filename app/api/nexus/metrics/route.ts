// GET /api/nexus/metrics — 7-day time-series for dashboard KPI sparklines
// Returns daily counts for: leads, messages, deals (proposals+negotiations), revenue proxy

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function buildDayMap(): Record<string, number> {
  const map: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    map[daysAgo(i)] = 0
  }
  return map
}

export interface MetricsResponse {
  days:     string[]   // ISO date strings, 7 items oldest→newest
  leads:    number[]
  messages: number[]
  deals:    number[]   // leads in proposta|negociando stages
  totals: {
    leads:    number
    messages: number
    deals:    number
    closed:   number
  }
}

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const supabase = db()
  const cutoff   = daysAgo(6) + 'T00:00:00'

  const [leadsRes, msgsRes, dealsRes, closedRes] = await Promise.all([
    // New leads per day
    supabase.from('leads')
      .select('created_at')
      .eq('company_id', companyId)
      .gte('created_at', cutoff),

    // Outgoing messages per day
    supabase.from('whatsapp_messages')
      .select('created_at')
      .eq('company_id', companyId)
      .eq('direction', 'outgoing')
      .gte('created_at', cutoff),

    // Leads in active deal stages
    supabase.from('leads')
      .select('updated_at')
      .eq('company_id', companyId)
      .in('stage', ['proposta', 'negociando'])
      .gte('updated_at', cutoff),

    // Total closed (all time) for KPI totals
    supabase.from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('stage', 'fechado'),
  ])

  const leadMap   = buildDayMap()
  const msgMap    = buildDayMap()
  const dealMap   = buildDayMap()

  for (const l of (leadsRes.data ?? [])) {
    const day = l.created_at?.split('T')[0]
    if (day && day in leadMap) leadMap[day]++
  }
  for (const m of (msgsRes.data ?? [])) {
    const day = m.created_at?.split('T')[0]
    if (day && day in msgMap) msgMap[day]++
  }
  for (const d of (dealsRes.data ?? [])) {
    const day = d.updated_at?.split('T')[0]
    if (day && day in dealMap) dealMap[day]++
  }

  const days = Object.keys(leadMap).sort()

  const response: MetricsResponse = {
    days,
    leads:    days.map(d => leadMap[d]),
    messages: days.map(d => msgMap[d]),
    deals:    days.map(d => dealMap[d]),
    totals: {
      leads:    (leadsRes.data?.length ?? 0),
      messages: (msgsRes.data?.length ?? 0),
      deals:    (dealsRes.data?.length ?? 0),
      closed:   (closedRes.count ?? 0),
    },
  }

  return NextResponse.json(response)
}
