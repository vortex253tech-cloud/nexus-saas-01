import { decideNextAction } from '@/lib/ai/decision-engine'
import type { FlowNode, ExecutionContext, NodeResult } from '../types'

// ─── Rule-based Decision config ───────────────────────────────────────────────

/**
 * A single named rule.
 *
 *   { condition: 'high_value', expression: 'lastOutput.count > 500' }
 *
 * Rules are evaluated in order. The first match wins.
 * If no rule matches, the DECISION returns 'default'.
 */
export interface DecisionRule {
  condition:  string   // label for this branch (e.g. 'high_value')
  expression: string   // boolean expression against lastOutput / variables
}

interface DecisionConfig {
  // ── New format: named rules ──────────────────────────────────────────────
  rules?:    DecisionRule[]

  // ── Legacy format: single expression → returns 'true' | 'false' ─────────
  condition?: string

  // ── AI path (future) ─────────────────────────────────────────────────────
  useAI?:    boolean
  aiPrompt?: string
  threshold?: number
}

// ─── Decision handler ─────────────────────────────────────────────────────────
// Evaluates rules and sets the named branch for downstream edges.
//
// New format  → edges labelled with named conditions  (e.g. 'high_value')
// Legacy format → edges labelled 'true' / 'false'
// Fallback    → returns 'default' when no rule matches (catches 'default' edges)

export async function handleDecision(
  node: FlowNode,
  ctx:  ExecutionContext,
): Promise<NodeResult> {
  const config = node.config as DecisionConfig

  // ── AI path ──────────────────────────────────────────────────────────────
  if (config.useAI) {
    const result = await decideNextAction({
      context:    ctx.variables,
      lastOutput: ctx.lastOutput,
      prompt:     config.aiPrompt ?? 'Should we proceed with this flow?',
      threshold:  config.threshold,
    })
    const branch = result.proceed ? 'true' : 'false'
    return {
      success:    true,
      output:     { branch, reasoning: result.reasoning },
      nextBranch: branch,
      message:    `AI decision: ${branch} — ${result.reasoning}`,
    }
  }

  // ── New format: named rules ───────────────────────────────────────────────
  if (config.rules && config.rules.length > 0) {
    for (const rule of config.rules) {
      const matched = evaluateExpression(rule.expression, ctx.lastOutput, ctx.variables)
      if (matched) {
        return buildResult(rule.condition, rule.expression, true)
      }
    }
    // No rule matched → default fallback
    return buildResult('default', '(no rule matched)', false)
  }

  // ── Legacy format: single boolean expression ──────────────────────────────
  const passed = evaluateExpression(config.condition ?? 'true', ctx.lastOutput, ctx.variables)
  const branch = passed ? 'true' : 'false'
  return buildResult(branch, config.condition ?? 'true', passed)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildResult(
  branch:     string,
  expression: string,
  matched:    boolean,
): NodeResult {
  const message = matched
    ? `Decision → "${branch}" (expression "${expression}" matched)`
    : `Decision → "default" (no rule matched)`

  return {
    success:    true,
    output:     { branch, expression, matched },
    nextBranch: branch,
    message,
  }
}

// ─── Expression evaluator ─────────────────────────────────────────────────────
// Supports:
//   'true' | 'false'
//   'lastOutput.count > 500'
//   'lastOutput.summary.profit < 0'
//   'variables.score >= 80'
//   'lastOutput.status === "active"'

function evaluateExpression(
  expression: string,
  lastOutput: unknown,
  variables:  Record<string, unknown>,
): boolean {
  const expr = expression.trim()

  if (expr === 'true')  return true
  if (expr === 'false') return false

  // Operators longest-first to avoid partial matches (>= before >)
  const operators = ['>=', '<=', '!==', '===', '!=', '==', '>', '<']

  for (const op of operators) {
    const idx = expr.indexOf(op)
    if (idx === -1) continue

    const lhsPath = expr.slice(0, idx).trim()
    const rhsRaw  = expr.slice(idx + op.length).trim()

    const lhsVal = resolvePath(lhsPath, lastOutput, variables)
    const rhsVal = parseRhs(rhsRaw)

    switch (op) {
      case '>':
      case '!=':   // numeric intent when no quotes
        return op === '>' ? Number(lhsVal) >  Number(rhsVal) : String(lhsVal) !== String(rhsVal)
      case '<':    return Number(lhsVal) <  Number(rhsVal)
      case '>=':   return Number(lhsVal) >= Number(rhsVal)
      case '<=':   return Number(lhsVal) <= Number(rhsVal)
      case '===':
      case '==':   return String(lhsVal) === String(rhsVal)
      case '!==':  return String(lhsVal) !== String(rhsVal)
    }
  }

  // Bare path — truthy check
  return Boolean(resolvePath(expr, lastOutput, variables))
}

function parseRhs(raw: string): string | number {
  // Strip quotes → string comparison
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1)
  }
  const n = Number(raw)
  return isNaN(n) ? raw : n
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

  if (parts[0] === 'variables') {
    let val: unknown = variables
    for (const key of parts.slice(1)) {
      if (val == null || typeof val !== 'object') return undefined
      val = (val as Record<string, unknown>)[key]
    }
    return val
  }

  // Direct variable reference (bare name)
  if (parts.length === 1) return variables[parts[0]]

  let val: unknown = variables
  for (const key of parts) {
    if (val == null || typeof val !== 'object') return undefined
    val = (val as Record<string, unknown>)[key]
  }
  return val
}
