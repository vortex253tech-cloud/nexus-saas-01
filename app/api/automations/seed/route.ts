// POST /api/automations/seed — create the default overdue automation for this company
// Idempotent: returns existing id if already seeded.

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { buildOverdueEmailTemplate, executeFlow } from '@/lib/automations-engine'

export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db         = getSupabaseServerClient()
  const companyId  = ctx.company.id
  const template   = buildOverdueEmailTemplate()

  // Check if already seeded
  const { data: existing } = await db
    .from('automations')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('trigger_type', 'client_overdue')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ id: existing.id, created: false, status: existing.status })
  }

  // Create automation
  const { data: auto, error } = await db
    .from('automations')
    .insert({
      company_id:   companyId,
      name:         'Cobrança automática — clientes em atraso',
      description:  'Envia e-mails de cobrança em D+0, D+3 e D+7 para clientes inadimplentes.',
      trigger_type: 'client_overdue',
      status:       'active',
    })
    .select('id')
    .single()

  if (error || !auto) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create automation' }, { status: 500 })
  }

  // Create 3 steps: immediate, 3 days, 7 days
  await db.from('automation_steps').insert([
    {
      automation_id: auto.id,
      step_order:    0,
      delay_days:    0,
      subject:       'Lembrete de pagamento pendente — {empresa}',
      body_html:     template,
    },
    {
      automation_id: auto.id,
      step_order:    1,
      delay_days:    3,
      subject:       'Atenção: pagamento vencido — {empresa}',
      body_html:     template,
    },
    {
      automation_id: auto.id,
      step_order:    2,
      delay_days:    7,
      subject:       'Urgente: regularize seu pagamento — {empresa}',
      body_html:     template,
    },
  ])

  // Run immediately so the user sees it working right away
  const runResult = await executeFlow(auto.id, companyId)

  return NextResponse.json({
    id:      auto.id,
    created: true,
    status:  'active',
    run:     runResult,
  }, { status: 201 })
}
