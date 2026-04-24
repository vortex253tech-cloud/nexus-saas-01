// GET /api/autopilot/logs — fetch autopilot run history for authenticated company

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('autopilot_logs')
    .select('id, triggered_by, actions_executed, actions_failed, new_insights, ai_summary, created_at')
    .eq('company_id', ctx.company.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: 'Erro ao buscar logs' }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
