// GET  /api/core/events  — recent events for current company
// POST /api/core/events  — emit a new event

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { emitEvent, getRecentEvents } from '@/lib/core/event-bus'
import type { NexusEventType }        from '@/lib/core/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const type  = searchParams.get('type') as NexusEventType | null

  const events = await getRecentEvents(ctx.company.id, limit, type ?? undefined)
  return NextResponse.json({ events, total: events.length })
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { type?: string; payload?: Record<string, unknown>; source?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 })
  }

  const event = await emitEvent(
    body.type as NexusEventType,
    ctx.company.id,
    body.payload ?? {},
    body.source ?? 'api',
  )

  return NextResponse.json({ event })
}
