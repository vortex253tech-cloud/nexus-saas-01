import { decideNextAction } from '@/lib/ai/decision-engine'
import type { FlowNode, ExecutionContext, NodeResult } from '../types'

interface DecisionConfig {
  condition?: string    // e.g. "lastOutput.count > 10" | "lastOutput.summary.profit < 0"
  useAI?:     boolean
  aiPrompt?:  string
  threshold?: number
}

// ─── Decision handler ─────────────────────────────────────────────────────────
// Evaluates a logical condition and sets the branch for downstream edges.
// Edges with condition='true' fire on truthy result; condition='false' on falsy.

export async function handleDecision(
  node: FlowNode,
  ctx:  ExecutionContext,
): Promise<NodeResult> {
  const config = node.config as DecisionConfig

  let branch: 'true' | 'false'
  let reasoning = ''

  if (config.useAI) {
    const result = await decideNextAction({
      context:    ctx.variables,
      lastOutput: ctx.lastOutput,
      prompt:     config.aiPrompt ?? 'Should we proceed with this flow?',
      threshold:  config.threshold,
    })
    branch    = result.proceed ? 'true' : 'false'
    reasoning = result.reasoning
  } else {
    const passed = evaluateCondition(config.condition ?? 'true', ctx.lastOutput, ctx.variables)
    branch    = passed ? 'true' : 'false'
    reasoning = `Condition "${config.condition ?? 'default'}" evaluated to ${branch}`
  }

  return {
    success:    true,
    output:     { branch, condition: config.condition, reasoning },
    nextBranch: branch,
    message:    reasoning,
  }
}

// ─── Condition evaluator ──────────────────────────────────────────────────────
// Supports: "true", "false", "lastOutput.path > N", "lastOutput.path === value"

function evaluateCondition(
  condition: string,
  lastOutput: unknown,
  variables:  Record<string, unknown>,
): boolean {
  const expr = condition.trim()

  if (expr === 'true')  return true
  if (expr === 'false') return false

  // Operators in priority order (longest first to avoid partial matches)
  const operators = ['>=', '<=', '!==', '===', '>', '<']

  for (const op of operators) {
    const idx = expr.indexOf(op)
    if (idx === -1) continue

    const lhsPath = expr.slice(0, idx).trim()
    const rhsRaw  = expr.slice(idx + op.length).trim()

    const lhsVal  = resolvePath(lhsPath, lastOutput, variables)
    const rhsVal  = isNaN(Number(rhsRaw)) ? rhsRaw.replace(/['"]/g, '') : Number(rhsRaw)

    switch (op) {
      case '>':   return Number(lhsVal) >  Number(rhsVal)
      case '<':   return Number(lhsVal) <  Number(rhsVal)
      case '>=':  return Number(lhsVal) >= Number(rhsVal)
      case '<=':  return Number(lhsVal) <= Number(rhsVal)
      case '===': return String(lhsVal) === String(rhsVal)
      case '!==': return String(lhsVal) !== String(rhsVal)
    }
  }

  // Bare path — truthy check
  return Boolean(resolvePath(expr, lastOutput, variables))
}

function resolvePath(
  path:       string,
  lastOutput: unknown,
  variables:  Record<string, unknown>,
): unknown {
  const parts = path.split('.')

  if (parts[0] === 'lastOutput') {
    let val: unknown = lastOutput
    for (const key of parts.slice(1)) {
      if (val == null || typeof val !== 'object') return undefined
      val = (val as Record<string, unknown>)[key]
    }
    return val
  }

  // Direct variable reference
  if (parts.length === 1) return variables[parts[0]]

  let val: unknown = variables
  for (const key of parts) {
    if (val == null || typeof val !== 'object') return undefined
    val = (val as Record<string, unknown>)[key]
  }
  return val
}
