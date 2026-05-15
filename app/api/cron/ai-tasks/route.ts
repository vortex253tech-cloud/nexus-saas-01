// GET /api/cron/ai-tasks — Cron job: executes pending AI tasks
// Called by Vercel Cron every 5 minutes
// Processes up to 10 pending tasks that are due

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 55

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  const { data: tasks, error } = await db()
    .from('ai_tasks')
    .select('id, company_id, lead_id, tipo, canal, conteudo, metadata')
    .eq('status', 'pendente')
    .lte('agendado_para', now)
    .lt('tentativas', 3)
    .order('prioridade', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No pending tasks' })
  }

  const results: Array<{ task_id: string; status: string; error?: string }> = []

  for (const task of tasks) {
    try {
      // Get lead phone
      const { data: lead } = await db()
        .from('leads')
        .select('phone, name')
        .eq('id', task.lead_id)
        .maybeSingle()

      if (!lead?.phone) {
        results.push({ task_id: task.id, status: 'skipped', error: 'no_phone' })
        continue
      }

      // Delegate to seller engine
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/nexus/seller`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: task.company_id,
          task_id:    task.id,
          action: {
            type:    task.tipo,
            leadId:  task.lead_id,
            phone:   lead.phone,
            context: task.conteudo,
          },
        }),
      })

      const json = await res.json().catch(() => ({})) as { ok?: boolean }
      results.push({ task_id: task.id, status: json.ok ? 'completed' : 'failed' })

    } catch (err) {
      results.push({ task_id: task.id, status: 'error', error: String(err) })

      await db().from('ai_tasks').update({
        tentativas: 1,
        updated_at: new Date().toISOString(),
      }).eq('id', task.id)
    }
  }

  return NextResponse.json({ ok: true, processed: tasks.length, results })
}
