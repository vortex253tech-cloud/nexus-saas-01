// POST /api/automations/[id]/enroll — manually enroll all eligible clients

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { enrollClient, type AutomationStep } from '@/lib/automations-engine'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const db = getSupabaseServerClient()

  const { data: auto } = await db
    .from('automations')
    .select('id, trigger_type, status')
    .eq('id', id)
    .eq('company_id', ctx.company.id)
    .single()

  if (!auto) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: steps } = await db
    .from('automation_steps')
    .select('id, step_order, subject, body_html, delay_days')
    .eq('automation_id', id)
    .order('step_order')

  if (!steps?.length) return NextResponse.json({ error: 'No steps configured' }, { status: 400 })

  // Fetch all clients with email for this company
  let query = db
    .from('clients')
    .select('id')
    .eq('company_id', ctx.company.id)
    .not('email', 'is', null)

  // Filter by trigger type
  if (auto.trigger_type === 'client_overdue') {
    query = query.eq('status', 'overdue')
  }

  const { data: clients } = await query
  if (!clients?.length) return NextResponse.json({ enrolled: 0 })

  let enrolled = 0
  for (const client of clients) {
    await enrollClient({
      automationId: id,
      clientId:     client.id,
      companyId:    ctx.company.id,
      steps:        steps as AutomationStep[],
    })
    enrolled++
  }

  return NextResponse.json({ enrolled })
}
