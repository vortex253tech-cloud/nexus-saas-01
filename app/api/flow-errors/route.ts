// GET  /api/flow-errors?limit=50&resolved=false
// PATCH /api/flow-errors — { id } resolve an error
// DELETE /api/flow-errors?id=... — dismiss an error

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { getAuthContext }            from '@/lib/auth'
import { getString, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params   = req.nextUrl.searchParams
  const limit    = Math.min(Number(params.get('limit') ?? 50), 200)
  const resolved = params.get('resolved')

  const db = getSupabaseServerClient()

  let q = db
    .from('flow_errors')
    .select('id, flow_id, execution_id, node_id, node_type, error_code, message, context, resolved, created_at')
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (resolved === 'false') q = q.eq('resolved', false)
  if (resolved === 'true')  q = q.eq('resolved', true)

  const { data, error } = await q

  // Table may not exist yet — return empty list gracefully
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ data: [], total: 0 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [], total: (data ?? []).length })
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const id = getString(body, 'id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('flow_errors')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('flow_errors')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
