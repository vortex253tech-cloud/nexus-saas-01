// GET /api/cron/flow-queue
// Safety-net cron: picks up any 'pending' executions that were never processed.
// Runs once daily at 06:00 UTC.
// Protected by CRON_SECRET bearer token (same pattern as other cron routes).

import { NextRequest, NextResponse } from 'next/server'
import { FlowQueue }    from '@/lib/flow-engine/flow-queue'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return true   // no secret configured → open (dev only)
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  return secret === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const queue  = new FlowQueue()
  const result = await queue.drainPending()
  return NextResponse.json(result)
}
