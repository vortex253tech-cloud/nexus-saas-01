// POST /api/analytics/track — client-side event ingestion
// Lightweight, authenticated, non-blocking.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { trackEvent }                from '@/lib/analytics'
import { getString, readJsonObject } from '@/lib/unknown'
import type { EventName }            from '@/lib/analytics'

const ALLOWED_EVENTS = new Set<EventName>([
  'dashboard_viewed', 'upgrade_page_viewed', 'checkout_started',
  'autopilot_toggled', 'action_approved_manual', 'paywall_hit',
  'session_started', 'report_exported', 'financial_data_added',
  'client_added', 'lead_added',
])

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await readJsonObject(req)
  if (!body)  return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const name = getString(body, 'name') as EventName | undefined
  if (!name || !ALLOWED_EVENTS.has(name)) {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
  }

  // Fire and forget — 200 immediately
  void trackEvent({
    name,
    company_id: auth.companyId,
    user_id:    auth.user.id,
    plan:       auth.effectivePlan,
    value:      typeof body.value === 'number' ? body.value : undefined,
    properties: typeof body.properties === 'object' && body.properties !== null
      ? body.properties as Record<string, unknown>
      : undefined,
  })

  return NextResponse.json({ ok: true })
}
