// POST /api/actions/execute
// Executes an action by ID, transitioning status and accumulating ganho.
// The action must belong to the authenticated company.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { executeActionById } from '@/lib/executor'
import { getString, readJsonObject } from '@/lib/unknown'
import { getAuthContext } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await readJsonObject(req)
    const action_id = body ? getString(body, 'action_id') : undefined

    if (!action_id) {
      return NextResponse.json({ error: 'action_id required' }, { status: 400 })
    }

    // Verify the action belongs to the authenticated company before executing
    const db = getSupabaseServerClient()
    const { data: action } = await db
      .from('actions')
      .select('id, company_id')
      .eq('id', action_id)
      .eq('company_id', ctx.companyId)   // ← isolation: must own this action
      .maybeSingle()

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
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
