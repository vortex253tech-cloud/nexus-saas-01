// ─── Auto-Pilot Engine ────────────────────────────────────────────
// Server-side only. Fetches pending auto-executable actions, runs them,
// generates new AI insights if queue is empty, then logs the run.

import { getSupabaseServerClient } from '@/lib/supabase'
import { executeActionById } from '@/lib/executor'
import { generateAIAnalysis } from '@/lib/ai'

// ─── Types ─────────────────────────────────────────────────────────

export interface AutoPilotResult {
  actionsExecuted: number
  actionsFailed:  number
  whatsappSent:   number
  newInsights:    number
  summary:        string
}

// ─── Main engine ───────────────────────────────────────────────────

export async function runAutoPilot(
  companyId:   string,
  triggeredBy: 'cron' | 'user' | 'api' = 'cron',
): Promise<AutoPilotResult> {
  const db = getSupabaseServerClient()

  // ── 1. Fetch pending auto-executable actions ────────────────────
  const { data: pending } = await db
    .from('actions')
    .select('id, titulo, execution_type')
    .eq('company_id', companyId)
    .eq('auto_executable', true)
    .eq('status', 'pending')
    .limit(10)

  let actionsExecuted = 0
  let actionsFailed   = 0
  let whatsappSent    = 0
  const results: unknown[] = []

  // ── 2. Execute each action ──────────────────────────────────────
  for (const action of pending ?? []) {
    try {
      const res = await executeActionById(action.id)
      if (res.success) {
        actionsExecuted++
        if (action.execution_type === 'whatsapp') whatsappSent++
      } else {
        actionsFailed++
      }
      results.push({ action_id: action.id, titulo: action.titulo, ...res })
    } catch (err) {
      actionsFailed++
      results.push({ action_id: action.id, titulo: action.titulo, error: String(err) })
    }
  }

  // ── 3. If queue was empty → generate new insights with AI ───────
  let newInsights = 0

  if ((pending ?? []).length === 0) {
    try {
      // Fetch company + financial context
      const [{ data: company }, { data: fd }, { data: quiz }] = await Promise.all([
        db.from('companies').select('id, name, perfil, sector').eq('id', companyId).single(),
        db.from('financial_data').select('*').eq('company_id', companyId)
          .order('period_date', { ascending: false }).limit(6),
        db.from('quiz_responses').select('meta_mensal, principal_desafio')
          .eq('company_id', companyId).order('created_at', { ascending: false })
          .limit(1).single(),
      ])

      if (company) {
        const quizRow = quiz as { meta_mensal?: number; principal_desafio?: string } | null

        const analysis = await generateAIAnalysis({
          perfil:           company.perfil  ?? 'outro',
          setor:            company.sector  ?? 'geral',
          metaMensal:       quizRow?.meta_mensal       ?? 10000,
          principalDesafio: quizRow?.principal_desafio ?? 'crescimento',
          nomeEmpresa:      company.name,
          financialData:    fd ?? [],
        })

        // Save top-3 auto-executable insights back to actions table
        for (const insight of analysis.insights.slice(0, 3)) {
          await db.from('actions').insert({
            company_id:       companyId,
            titulo:           insight.titulo,
            descricao:        insight.descricao,
            detalhe:          insight.detalhe,
            impacto_estimado: insight.impacto_estimado,
            prioridade:       insight.prioridade,
            urgencia:         insight.urgencia,
            icone:            insight.icone,
            passos:           insight.passos,
            effort_level:     insight.effort_level,
            auto_executable:  insight.auto_executable,
            execution_type:   insight.execution_type,
            message_email:    insight.message_email     ?? null,
            message_whatsapp: insight.message_whatsapp  ?? null,
            status:           'pending',
          })
          newInsights++
        }
      }
    } catch (err) {
      console.error('[autopilot] insight generation failed:', err)
    }
  }

  // ── 4. Build summary ────────────────────────────────────────────
  const summary =
    actionsExecuted > 0
      ? `Auto-Pilot executou ${actionsExecuted} ação${actionsExecuted !== 1 ? 'ões' : ''}${whatsappSent > 0 ? ` (${whatsappSent} via WhatsApp)` : ''}`
      : newInsights > 0
        ? `Auto-Pilot gerou ${newInsights} novo${newInsights !== 1 ? 's' : ''} insight${newInsights !== 1 ? 's' : ''} para execução`
        : 'Auto-Pilot rodou — sem ações pendentes e dados insuficientes para novos insights'

  // ── 5. Persist run to autopilot_logs ───────────────────────────
  await db.from('autopilot_logs').insert({
    company_id:       companyId,
    triggered_by:     triggeredBy,
    actions_executed: actionsExecuted,
    actions_failed:   actionsFailed,
    whatsapp_sent:    whatsappSent,
    new_insights:     newInsights,
    ai_summary:       summary,
    results,
  })

  return { actionsExecuted, actionsFailed, whatsappSent, newInsights, summary }
}
