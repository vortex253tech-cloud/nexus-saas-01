// GET /api/automations — list automations for company
// POST /api/automations — create automation with steps

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, isRecord } from '@/lib/unknown'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()

  const { data: automations, error } = await db
    .from('automations')
    .select('id, name, description, trigger_type, status, created_at, updated_at')
    .eq('company_id', ctx.company.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach step count and enrollment count
  const enriched = await Promise.all((automations ?? []).map(async (auto) => {
    const [{ count: stepCount }, { count: enrollCount }] = await Promise.all([
      db.from('automation_steps').select('id', { count: 'exact', head: true }).eq('automation_id', auto.id),
      db.from('automation_enrollments').select('id', { count: 'exact', head: true }).eq('automation_id', auto.id).eq('status', 'active'),
    ])
    return { ...auto, step_count: stepCount ?? 0, enrolled_count: enrollCount ?? 0 }
  }))

  return NextResponse.json({ automations: enriched })
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as unknown
  if (!isRecord(body)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const name         = getString(body, 'name')
  const description  = getString(body, 'description') ?? ''
  const trigger_type = getString(body, 'trigger_type') ?? 'manual'
  const steps        = Array.isArray(body.steps) ? body.steps : []

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const db = getSupabaseServerClient()

  const { data: auto, error } = await db
    .from('automations')
    .insert({ company_id: ctx.company.id, name, description, trigger_type, status: 'draft' })
    .select('id')
    .single()

  if (error || !auto) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })

  if (steps.length > 0) {
    const stepsToInsert = steps.map((s: unknown, i: number) => {
      const step = isRecord(s) ? s : {}
      return {
        automation_id: auto.id,
        step_order:    i,
        subject:       getString(step, 'subject') ?? '',
        body_html:     getString(step, 'body_html') ?? '',
        delay_days:    typeof step.delay_days === 'number' ? step.delay_days : 0,
      }
    })
    await db.from('automation_steps').insert(stepsToInsert)
  }

  return NextResponse.json({ id: auto.id }, { status: 201 })
}
