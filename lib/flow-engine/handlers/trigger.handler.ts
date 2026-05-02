import type { FlowNode, ExecutionContext, NodeResult } from '../types'

interface TriggerConfig {
  triggerType?: 'manual' | 'scheduled' | 'webhook' | 'condition' | 'client_at_risk'
  condition?:   string   // e.g. "variable=value"
}

// ─── Trigger handler ─────────────────────────────────────────────────────────
// Validates the initial condition that gates the entire flow.

export async function handleTrigger(
  node: FlowNode,
  ctx:  ExecutionContext,
): Promise<NodeResult> {
  const config = node.config as TriggerConfig

  if (config.condition) {
    const met = evaluateCondition(config.condition, ctx.variables)
    if (!met) {
      return {
        success: false,
        output:  null,
        message: `Trigger condition not met: "${config.condition}"`,
      }
    }
  }

  // CLIENT_AT_RISK: pass through the at-risk client data from variables
  const atRiskData = config.triggerType === 'client_at_risk'
    ? { client: ctx.variables.client ?? null, risk_reason: ctx.variables.risk_reason ?? null }
    : {}

  const output = {
    triggeredAt: new Date().toISOString(),
    triggerType: config.triggerType ?? 'manual',
    companyId:   ctx.companyId,
    ...atRiskData,
  }

  return {
    success: true,
    output,
    message: `Trigger activated (${config.triggerType ?? 'manual'})`,
  }
}

// ─── Simple key=value condition ───────────────────────────────────────────────

function evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
  const [key, value] = condition.split('=').map(s => s.trim())
  if (!key) return true
  if (!value) return Boolean(variables[key])
  return String(variables[key]) === value
}
