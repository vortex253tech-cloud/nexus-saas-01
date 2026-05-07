// GET /api/engine/status — Revenue Engine real-time status for current tenant
//
// Returns: is_running, last_run, actions_today, revenue_today,
//          pending_count, approval_mode, decisions from last analysis

import { NextResponse }              from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { analyzeCompany }            from '@/lib/decision-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db      = getSupabaseServerClient()
  const today   = new Date().toISOString().slice(0, 10)

  const [
    companyRes,
    lastRunRes,
    pendingRes,
    todayActionsRes,
    todayRevenueRes,
  ] = await Promise.all([
    db.from('companies')
      .select('autopilot_enabled, approval_mode, max_actions_per_day')
      .eq('id', auth.companyId)
      .single(),

    db.from('engine_runs')
      .select('run_at, summary, decisions_found, actions_executed, revenue_impact, error')
      .eq('company_id', auth.companyId)
      .order('run_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    db.from('actions')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', auth.companyId)
      .eq('status', 'pending')
      .eq('auto_executable', true),

    db.from('execution_history')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', auth.companyId)
      .gte('executed_at', today),

    db.from('execution_history')
      .select('ganho_realizado')
      .eq('company_id', auth.companyId)
      .gte('executed_at', today),
  ])

  const company      = companyRes.data
  const lastRun      = lastRunRes.data
  const pendingCount = pendingRes.count ?? 0
  const actionsToday = todayActionsRes.count ?? 0
  const revenueToday = (todayRevenueRes.data ?? []).reduce(
    (s: number, r: { ganho_realizado: number }) => s + (r.ganho_realizado ?? 0), 0
  )
  const maxPerDay    = (company as { max_actions_per_day?: number } | null)?.max_actions_per_day ?? 20

  // Run a lightweight decision analysis to show current decisions
  let decisions: import('@/lib/decision-engine').Decision[] = []
  try {
    const report = await analyzeCompany(auth.companyId)
    decisions    = report.decisions
  } catch {
    // Non-blocking — status still works without decisions
  }

  return NextResponse.json({
    autopilot_enabled: (company as { autopilot_enabled?: boolean } | null)?.autopilot_enabled ?? false,
    approval_mode:     (company as { approval_mode?: string } | null)?.approval_mode ?? 'auto',
    max_actions_per_day: maxPerDay,
    actions_today:     actionsToday,
    actions_remaining: Math.max(0, maxPerDay - actionsToday),
    revenue_today:     revenueToday,
    pending_count:     pendingCount,
    last_run:          lastRun ?? null,
    decisions,
    // Simple heuristic: if a run happened in the last 5 minutes it's "running"
    is_running: lastRun?.run_at
      ? Date.now() - new Date(lastRun.run_at).getTime() < 5 * 60_000
      : false,
  })
}
