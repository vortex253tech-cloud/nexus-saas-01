// GET /api/automations/[id]  — get automation with steps
// PUT /api/automations/[id]  — update
// DELETE /api/automations/[id] — delete

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, isRecord } from '@/lib/unknown'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const db = getSupabaseServerClient()

  const { data: auto, error } = await db
    .from('automations')
    .select('id, name, description, trigger_type, status, created_at')
    .eq('id', id)
    .eq('company_id', ctx.company.id)
    .single()

  if (error || !auto) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: steps } = await db
    .from('automation_steps')
    .select('id, step_order, subject, body_html, delay_days')
    .eq('automation_id', id)
    .order('step_order')

  const { count: enrolled } = await db
    .from('automation_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', id)
    .eq('status', 'active')

  const { count: totalSent } = await db
    .from('automation_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', id)
    .eq('status', 'completed')

  return NextResponse.json({ ...auto, steps: steps ?? [], enrolled_count: enrolled ?? 0, completed_count: totalSent ?? 0 })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as unknown
  if (!isRecord(body)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const db = getSupabaseServerClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (getString(body, 'name'))        update.name        = getString(body, 'name')
  if (getString(body, 'description') !== undefined) update.description = getString(body, 'description')
  if (getString(body, 'trigger_type')) update.trigger_type = getString(body, 'trigger_type')

  const { error } = await db
    .from('automations')
    .update(update)
    .eq('id', id)
    .eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Replace steps if provided
  if (Array.isArray(body.steps)) {
    await db.from('automation_steps').delete().eq('automation_id', id)
    if (body.steps.length > 0) {
      const stepsToInsert = body.steps.map((s: unknown, i: number) => {
        const step = isRecord(s) ? s : {}
        return {
          automation_id: id,
          step_order:    i,
          subject:       getString(step, 'subject') ?? '',
          body_html:     getString(step, 'body_html') ?? '',
          delay_days:    typeof step.delay_days === 'number' ? step.delay_days : 0,
        }
      })
      await db.from('automation_steps').insert(stepsToInsert)
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const db = getSupabaseServerClient()

  const { error } = await db
    .from('automations')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
