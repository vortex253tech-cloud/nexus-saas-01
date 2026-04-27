import type { FlowNode, ExecutionContext, NodeResult, StepLog } from '../types'
import type { FlowContext } from '../context-builder'

interface ResultOutput {
  stepsExecuted:   number
  successCount:    number
  errorCount:      number
  skippedCount:    number
  actionsExecuted: number
  emailsSent:      number
  whatsappSent:    number
  recordsUpdated:  number
  // Business metrics
  clientsReached:  number
  revenueImpact:   number   // sum of overdue amounts targeted
  conversionRate:  number   // emailsSent / clientsReached if >0
  completedAt:     string
  finalData:       unknown
  insights:        string[]
}

// ─── Result handler ───────────────────────────────────────────────────────────
// Aggregates all step logs + business context into a final summary.

export async function handleResult(
  _node: FlowNode,
  ctx:   ExecutionContext,
): Promise<NodeResult> {
  const flowCtx  = ctx.variables.flowContext as FlowContext | undefined
  const summary  = buildSummary(ctx.logs, ctx.lastOutput, flowCtx)

  return {
    success: true,
    output:  summary,
    message: `Fluxo concluído — ${summary.stepsExecuted} passos, ${summary.actionsExecuted} ações, ${summary.emailsSent} emails, ${summary.whatsappSent} WhatsApps`,
  }
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(
  logs:      StepLog[],
  lastOutput: unknown,
  flowCtx?:  FlowContext,
): ResultOutput {
  const stepsExecuted  = logs.length
  const successCount   = logs.filter(l => l.status === 'success').length
  const errorCount     = logs.filter(l => l.status === 'error').length
  const skippedCount   = logs.filter(l => l.status === 'skipped').length

  const actionLogs      = logs.filter(l => l.nodeType === 'ACTION')
  const actionsExecuted = actionLogs.filter(l => l.status === 'success').length

  const emailsSent = actionLogs.reduce((sum, l) => {
    const out = l.output as Record<string, number> | null
    return sum + (out?.succeeded ?? 0)
  }, 0)

  const whatsappSent = actionLogs.reduce((sum, l) => {
    const out = l.output as Record<string, unknown> | null
    if (out?.channel === 'whatsapp') return sum + (Number(out?.sent ?? 0))
    const payload = out?.payload as Record<string, unknown> | undefined
    if (payload?.recipients && Array.isArray(payload.recipients)) return sum + payload.recipients.length
    return sum
  }, 0)

  const recordsUpdated = actionLogs.reduce((sum, l) => {
    const out = l.output as Record<string, number> | null
    return sum + (out?.updated ?? 0)
  }, 0)

  // Business metrics from flow context
  const clientsReached  = emailsSent + whatsappSent
  const revenueImpact   = flowCtx?.financial.overdueAmount ?? 0
  const conversionRate  = clientsReached > 0
    ? Math.round((actionsExecuted / clientsReached) * 100) / 100
    : 0

  // Execution insights
  const insights: string[] = []
  if (emailsSent > 0)     insights.push(`${emailsSent} emails enviados`)
  if (whatsappSent > 0)   insights.push(`${whatsappSent} WhatsApps enviados`)
  if (recordsUpdated > 0) insights.push(`${recordsUpdated} registros atualizados`)
  if (errorCount > 0)     insights.push(`${errorCount} nó(s) com erro — revise a configuração`)
  if (revenueImpact > 0)  {
    const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    insights.push(`Potencial de recuperação: ${fmtBRL(revenueImpact)}`)
  }
  if (flowCtx?.insights.length) insights.push(...flowCtx.insights)

  return {
    stepsExecuted,
    successCount,
    errorCount,
    skippedCount,
    actionsExecuted,
    emailsSent,
    whatsappSent,
    recordsUpdated,
    clientsReached,
    revenueImpact,
    conversionRate,
    completedAt: new Date().toISOString(),
    finalData:   lastOutput,
    insights,
  }
}
