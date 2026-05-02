// GET /api/retention/events?company_id=...&status=pending|resolved|all
// PATCH /api/retention/events — resolve an event { id, company_id, action_taken, result }

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params     = req.nextUrl.searchParams
  const company_id = params.get('company_id')
  const status     = params.get('status') ?? 'pending'

  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const db = getSupabaseServerClient()

  let q = db
    .from('retention_events')
    .select('id, client_id, reason, action_taken, result, metadata, triggered_at, resolved_at')
    .eq('company_id', company_id)
    .order('triggered_at', { ascending: false })
    .limit(100)

  if (status === 'pending')  q = q.is('resolved_at', null)
  if (status === 'resolved') q = q.not('resolved_at', 'is', null)

  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const id           = getString(body, 'id')
  const company_id   = getString(body, 'company_id')
  const action_taken = getString(body, 'action_taken')
  const result       = getString(body, 'result')

  if (!id || !company_id) {
    return NextResponse.json({ error: 'id and company_id required' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (action_taken) patch.action_taken = action_taken
  if (result)       patch.result       = result
  if (result === 'success' || result === 'failed') {
    patch.resolved_at = new Date().toISOString()
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('retention_events')
    .update(patch)
    .eq('id', id)
    .eq('company_id', company_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
