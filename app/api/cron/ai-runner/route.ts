// GET|POST /api/cron/ai-runner — NEXUS Revenue Engine: Master Orchestration Cron
//
// Runs every 4 hours (configurable in vercel.json).
// For each company with autopilot enabled:
//   1. Analyze current state → produce DecisionReport
//   2. Convert decisions to actions (skipping duplicates)
//   3. Execute auto-executable actions (respecting max_actions_per_day)
//   4. Log full run to engine_runs table
//
// Protected by CRON_SECRET header (same as all other cron routes).

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { analyzeCompany }            from '@/lib/decision-engine'
import { persistDecisions }          from '@/lib/engine-actions'
import { runAutoPilot }              from '@/lib/autopilot'

export const dynamic = 'force-dynamic'

// ─── Safety defaults ──────────────────────────────────────────────────────────

const DEFAULT_MAX_ACTIONS_PER_DAY = 20

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyRow {
  id:                  string
  autopilot_enabled:   boolean
  approval_mode:       string | null      // 'auto' | 'manual'
  max_actions_per_day: number | null
}

interface EngineRunLog {
  company_id:      string
  run_at:          string
  decisions_found: number
  actions_inserted: number
  actions_skipped: number
  actions_executed: number
  actions_failed:  number
  revenue_impact:  number
  approval_mode:   string
  summary:         string
  report_json:     unknown
  error?:          string | null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handler(req: NextRequest) {
  // Verify cron secret
  const auth   = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db     = getSupabaseServerClient()
  const runAt  = new Date().toISOString()
  const today  = runAt.slice(0, 10)  // YYYY-MM-DD

  // ── 1. Fetch all autopilot-enabled companies ──────────────────────────────
  const { data: companies, error: cErr } = await db
    .from('companies')
    .select('id, autopilot_enabled, approval_mode, max_actions_per_day')
    .eq('autopilot_enabled', true)
    .returns<CompanyRow[]>()

  if (cErr || !companies || companies.length === 0) {
    return NextResponse.json({
      ok: true, processed: 0,
      message: cErr ? cErr.message : 'No companies with autopilot enabled',
    })
  }

  const results: EngineRunLog[] = []

  // ── 2. Process each company ───────────────────────────────────────────────
  for (const company of companies) {
    const runLog: EngineRunLog = {
      company_id:       company.id,
      run_at:           runAt,
      decisions_found:  0,
      actions_inserted: 0,
      actions_skipped:  0,
      actions_executed: 0,
      actions_failed:   0,
      revenue_impact:   0,
      approval_mode:    company.approval_mode ?? 'auto',
      summary:          '',
      report_json:      null,
      error:            null,
    }

    try {
      // ── 2a. Enforce daily action cap ──────────────────────────────────────
      const maxPerDay = company.max_actions_per_day ?? DEFAULT_MAX_ACTIONS_PER_DAY

      const { count: todayCount } = await db
        .from('execution_history')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .gte('executed_at', today)

      const actionsUsedToday = todayCount ?? 0

      if (actionsUsedToday >= maxPerDay) {
        runLog.summary = `Daily cap reached (${actionsUsedToday}/${maxPerDay})`
        results.push(runLog)
        continue
      }

      // ── 2b. Run decision engine ────────────────────────────────────────────
      const report = await analyzeCompany(company.id)

      runLog.decisions_found = report.decisions.length
      runLog.revenue_impact  = report.totalImpact
      runLog.report_json     = report

      if (report.decisions.length === 0) {
        runLog.summary = 'Nenhuma decisão acionada — empresa saudável'
        results.push(runLog)
        await persistRunLog(db, runLog)
        continue
      }

      // ── 2c. Persist decisions as queued actions ────────────────────────────
      const persistResult = await persistDecisions(report.decisions, company.id)
      runLog.actions_inserted = persistResult.inserted
      runLog.actions_skipped  = persistResult.skipped

      // ── 2d. Execute if approval_mode === 'auto' ────────────────────────────
      if ((company.approval_mode ?? 'auto') === 'auto') {
        const remaining = maxPerDay - actionsUsedToday
        if (remaining > 0) {
          const pilotResult = await runAutoPilot(company.id, 'cron')
          runLog.actions_executed = pilotResult.actionsExecuted
          runLog.actions_failed   = pilotResult.actionsFailed
        }
      }

      runLog.summary = buildSummary(runLog)
    } catch (err) {
      runLog.error   = err instanceof Error ? err.message : String(err)
      runLog.summary = `Erro: ${runLog.error}`
      console.error(`[ai-runner] company ${company.id} failed:`, err)
    }

    results.push(runLog)
    await persistRunLog(db, runLog)
  }

  // ── 3. Return aggregate stats ─────────────────────────────────────────────
  const totals = results.reduce(
    (acc, r) => ({
      decisions: acc.decisions + r.decisions_found,
      inserted:  acc.inserted  + r.actions_inserted,
      executed:  acc.executed  + r.actions_executed,
      failed:    acc.failed    + r.actions_failed,
      impact:    acc.impact    + r.revenue_impact,
    }),
    { decisions: 0, inserted: 0, executed: 0, failed: 0, impact: 0 }
  )

  console.log(
    `[ai-runner] ${runAt} — companies: ${companies.length}, ` +
    `decisions: ${totals.decisions}, inserted: ${totals.inserted}, ` +
    `executed: ${totals.executed}, failed: ${totals.failed}, ` +
    `impact: R$ ${Math.round(totals.impact).toLocaleString('pt-BR')}`
  )

  return NextResponse.json({
    ok:               true,
    run_at:           runAt,
    companies:        companies.length,
    decisions_found:  totals.decisions,
    actions_inserted: totals.inserted,
    actions_executed: totals.executed,
    actions_failed:   totals.failed,
    revenue_impact:   totals.impact,
    results,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSummary(log: EngineRunLog): string {
  const parts: string[] = []
  if (log.decisions_found)  parts.push(`${log.decisions_found} decisão(ões) detectada(s)`)
  if (log.actions_inserted) parts.push(`${log.actions_inserted} ação(ões) criada(s)`)
  if (log.actions_executed) parts.push(`${log.actions_executed} executada(s)`)
  if (log.actions_failed)   parts.push(`${log.actions_failed} falha(s)`)
  return parts.join(', ') || 'Sem ações pendentes'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistRunLog(db: ReturnType<typeof getSupabaseServerClient>, log: EngineRunLog) {
  try {
    await db.from('engine_runs').insert({
      company_id:       log.company_id,
      run_at:           log.run_at,
      decisions_found:  log.decisions_found,
      actions_inserted: log.actions_inserted,
      actions_skipped:  log.actions_skipped,
      actions_executed: log.actions_executed,
      actions_failed:   log.actions_failed,
      revenue_impact:   log.revenue_impact,
      approval_mode:    log.approval_mode,
      summary:          log.summary,
      report_json:      log.report_json,
      error:            log.error ?? null,
    })
  } catch {
    // engine_runs table may not exist yet — non-blocking until migration is applied
  }
}

export const GET  = handler
export const POST = handler
