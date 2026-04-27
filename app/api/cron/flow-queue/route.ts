// GET /api/cron/flow-queue
// Safety-net cron: picks up any 'pending' executions that were never processed.
// Runs once daily at 06:00 UTC.

import { NextResponse } from 'next/server'
import { FlowQueue }    from '@/lib/flow-engine/flow-queue'

export async function GET() {
  const queue  = new FlowQueue()
  const result = await queue.drainPending()
  return NextResponse.json(result)
}
