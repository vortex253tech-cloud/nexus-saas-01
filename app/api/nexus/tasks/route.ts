// /api/nexus/tasks — AI Tasks (follow-ups, proposals, reactivations)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── GET: list tasks ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  const status    = req.nextUrl.searchParams.get('status')
  const limit     = parseInt(req.nextUrl.searchParams.get('limit') ?? '50')

  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  let query = db()
    .from('ai_tasks')
    .select('*, leads(name, phone, empresa, score)')
    .eq('company_id', companyId)
    .order('agendado_para', { ascending: true })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tasks: data ?? [] })
}

// ── POST: create task ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { company_id, lead_id, tipo, canal, agendado_para, conteudo, prioridade, metadata } = body

  if (!company_id || !tipo || !agendado_para) {
    return NextResponse.json({ error: 'company_id, tipo, agendado_para required' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('ai_tasks')
    .insert({
      company_id,
      lead_id:      lead_id ?? null,
      tipo,
      canal:        canal ?? 'whatsapp',
      agendado_para,
      conteudo:     conteudo ?? null,
      prioridade:   prioridade ?? 5,
      metadata:     metadata ?? {},
      status:       'pendente',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, task: data })
}

// ── DELETE: cancel task ────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const taskId    = req.nextUrl.searchParams.get('task_id')
  const companyId = req.nextUrl.searchParams.get('company_id')

  if (!taskId || !companyId) {
    return NextResponse.json({ error: 'task_id and company_id required' }, { status: 400 })
  }

  const { error } = await db()
    .from('ai_tasks')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
