// POST /api/core/actions — execute an AI action

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { executeAction }             from '@/lib/core/ai'
import type { NexusAction }          from '@/lib/core/types'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<NexusAction>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.type) {
    return NextResponse.json({ error: 'action type is required' }, { status: 400 })
  }

  const action: NexusAction = {
    type:       body.type,
    company_id: ctx.company.id,
    payload:    body.payload ?? {},
    triggered_by: body.triggered_by ?? 'api',
    ai_session:   body.ai_session,
  }

  const result = await executeAction(action)
  return NextResponse.json(result, { status: result.success ? 200 : 502 })
}
