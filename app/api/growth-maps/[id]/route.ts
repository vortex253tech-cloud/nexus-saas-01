// GET    /api/growth-maps/[id]
// PATCH  /api/growth-maps/[id]  — save canvas (nodes + edges)
// DELETE /api/growth-maps/[id]

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('growth_maps')
    .select('*')
    .eq('id', id)
    .eq('company_id', ctx.company.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Mapa não encontrado' }, { status: 404 })

  // Last execution from the flow engine table
  const { data: lastExec } = await db
    .from('flow_executions')
    .select('id, status, logs, output, started_at, finished_at')
    .eq('flow_id', id)
    .eq('company_id', ctx.company.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastExecution = lastExec
    ? {
        id:         (lastExec as Record<string, unknown>).id as string,
        flowId:     id,
        companyId:  ctx.company.id,
        status:     (lastExec as Record<string, unknown>).status as string,
        logs:       (lastExec as Record<string, unknown>).logs ?? [],
        output:     (lastExec as Record<string, unknown>).output ?? null,
        startedAt:  (lastExec as Record<string, unknown>).started_at as string,
        finishedAt: (lastExec as Record<string, unknown>).finished_at as string | undefined,
      }
    : null

  return NextResponse.json({ map: data, lastExecution })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    name?: string; description?: string; nodes?: unknown; edges?: unknown; status?: string
  }

  const db = getSupabaseServerClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name        !== undefined) update.name        = body.name
  if (body.description !== undefined) update.description = body.description
  if (body.nodes       !== undefined) update.nodes       = body.nodes
  if (body.edges       !== undefined) update.edges       = body.edges
  if (body.status      !== undefined) update.status      = body.status

  const { error } = await db.from('growth_maps').update(update)
    .eq('id', id).eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { error } = await db.from('growth_maps').delete()
    .eq('id', id).eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
