// POST /api/actions/execute
// Executes an action by ID, transitioning status and accumulating ganho.

import { NextRequest, NextResponse } from 'next/server'
import { executeActionById } from '@/lib/executor'
import { getString, readJsonObject } from '@/lib/unknown'

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    const action_id = body ? getString(body, 'action_id') : undefined

    if (!action_id) {
      return NextResponse.json({ error: 'action_id required' }, { status: 400 })
    }

    const result = await executeActionById(action_id)

    if (!result.success) {
      return NextResponse.json({ error: result.log }, { status: 500 })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
