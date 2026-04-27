import type { FlowNode, ExecutionContext, NodeResult, StepLog } from '../types'

interface ResultOutput {
  stepsExecuted:    number
  successCount:     number
  errorCount:       number
  skippedCount:     number
  actionsExecuted:  number
  emailsSent:       number
  recordsUpdated:   number
  completedAt:      string
  finalData:        unknown
}

// ─── Result handler ───────────────────────────────────────────────────────────
// Aggregates all step logs into a final summary. Always the last node.

export async function handleResult(
  _node: FlowNode,
  ctx:   ExecutionContext,
): Promise<NodeResult> {
  const summary = buildSummary(ctx.logs, ctx.lastOutput)

  return {
    success: true,
    output:  summary,
    message: `Flow complete — ${summary.stepsExecuted} steps, ${summary.successCount} succeeded, ${summary.actionsExecuted} actions taken`,
  }
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(logs: StepLog[], lastOutput: unknown): ResultOutput {
  const stepsExecuted  = logs.length
  const successCount   = logs.filter(l => l.status === 'success').length
  const errorCount     = logs.filter(l => l.status === 'error').length
  const skippedCount   = logs.filter(l => l.status === 'skipped').length

  const actionLogs     = logs.filter(l => l.nodeType === 'ACTION')
  const actionsExecuted = actionLogs.length

  const emailsSent = actionLogs.reduce((sum, l) => {
    const out = l.output as Record<string, number> | null
    return sum + (out?.succeeded ?? 0)
  }, 0)

  const recordsUpdated = actionLogs.reduce((sum, l) => {
    const out = l.output as Record<string, number> | null
    return sum + (out?.updated ?? 0)
  }, 0)

  return {
    stepsExecuted,
    successCount,
    errorCount,
    skippedCount,
    actionsExecuted,
    emailsSent,
    recordsUpdated,
    completedAt: new Date().toISOString(),
    finalData:   lastOutput,
  }
}
