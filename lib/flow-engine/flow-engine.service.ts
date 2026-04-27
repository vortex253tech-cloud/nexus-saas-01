import { FlowRepository } from './flow-repository'
import { FlowNodeType }   from './types'
import type { FlowNode, FlowEdge, ExecutionContext, NodeResult, StepLog } from './types'

import { handleTrigger }  from './handlers/trigger.handler'
import { handleAnalysis } from './handlers/analysis.handler'
import { handleDecision } from './handlers/decision.handler'
import { handleAction }   from './handlers/action.handler'
import { handleResult }   from './handlers/result.handler'

// ─── Flow Engine Service ──────────────────────────────────────────────────────
// Orchestrates execution of a saved flow:
//   1. Load flow definition from DB
//   2. Topological sort of nodes
//   3. Execute each node sequentially (respecting DECISION branches)
//   4. Log every step in real-time
//   5. Persist final state

export class FlowEngineService {
  private repo: FlowRepository

  constructor() {
    this.repo = new FlowRepository()
  }

  // ─── Main entry point ───────────────────────────────────────────────────────

  async executeFlow(
    executionId: string,
    flowId:      string,
    companyId:   string,
  ): Promise<void> {
    await this.repo.markRunning(executionId)

    const flow = await this.repo.getFlow(flowId, companyId)
    if (!flow) {
      await this.repo.updateExecution(
        executionId, 'error', [],
        { error: 'Flow not found' },
        new Date().toISOString(),
      )
      return
    }

    const ctx: ExecutionContext = {
      flowId,
      executionId,
      companyId,
      variables:  {},
      logs:       [],
      lastOutput: null,
    }

    try {
      await this.runNodes(flow.nodes, flow.edges, ctx, executionId)

      await this.repo.updateExecution(
        executionId, 'completed', ctx.logs,
        ctx.lastOutput,
        new Date().toISOString(),
      )
      await this.repo.updateLastExecuted(flowId)

    } catch (err) {
      await this.repo.updateExecution(
        executionId, 'error', ctx.logs,
        { error: String(err) },
        new Date().toISOString(),
      )
    }
  }

  // ─── Direct execution (no DB flow lookup) ───────────────────────────────────
  // Used for tests and ad-hoc flows defined in code.

  async executeFlowDirect(
    nodes:     FlowNode[],
    edges:     FlowEdge[],
    companyId: string,
    variables: Record<string, unknown> = {},
  ): Promise<{ logs: StepLog[]; output: unknown }> {
    const ctx: ExecutionContext = {
      flowId:      'direct',
      executionId: 'direct',
      companyId,
      variables,
      logs:        [],
      lastOutput:  null,
    }
    await this.runNodes(nodes, edges, ctx, 'direct')
    return { logs: ctx.logs, output: ctx.lastOutput }
  }

  // ─── Node runner ────────────────────────────────────────────────────────────

  private async runNodes(
    nodes:       FlowNode[],
    edges:       FlowEdge[],
    ctx:         ExecutionContext,
    executionId: string,
  ): Promise<void> {
    const sorted          = this.topologicalSort(nodes, edges)
    const branchDecisions = new Map<string, string>()

    for (const node of sorted) {
      const skipped = this.shouldSkip(node, edges, branchDecisions)

      if (skipped) {
        ctx.logs.push(this.makeLog(node, 'skipped', ctx.lastOutput, null, 0, 'Skipped — branch not taken'))
        await this.repo.appendLog(executionId, ctx.logs)
        continue
      }

      const t0 = Date.now()

      try {
        const result  = await this.dispatch(node, ctx)
        const log     = this.makeLog(
          node,
          result.success ? 'success' : 'error',
          ctx.lastOutput,
          result.output,
          Date.now() - t0,
          result.message,
        )
        ctx.logs.push(log)

        // Propagate branch decision for DECISION nodes
        if (result.nextBranch) {
          branchDecisions.set(node.id, result.nextBranch)
          // Stamp the chosen path onto the log message for traceability
          log.message = result.message ?? `Decision → "${result.nextBranch}"`
        }

        // Non-DECISION failure halts the flow
        if (!result.success && this.normaliseType(node.type) !== FlowNodeType.DECISION) {
          await this.repo.updateExecution(
            executionId, 'error', ctx.logs,
            { error: result.message ?? 'Node failed' },
            new Date().toISOString(),
          )
          throw new Error(result.message ?? 'Node failed')
        }

        ctx.lastOutput = result.output

        // Persist incrementally so the UI can show live progress
        await this.repo.appendLog(executionId, ctx.logs)

      } catch (err) {
        const log = this.makeLog(node, 'error', ctx.lastOutput, null, Date.now() - t0, String(err))
        ctx.logs.push(log)
        await this.repo.appendLog(executionId, ctx.logs)
        throw err
      }
    }
  }

  // ─── Node dispatcher ────────────────────────────────────────────────────────

  private async dispatch(node: FlowNode, ctx: ExecutionContext): Promise<NodeResult> {
    const type = this.normaliseType(node.type)

    switch (type) {
      case FlowNodeType.TRIGGER:  return handleTrigger(node, ctx)
      case FlowNodeType.ANALYSIS: return handleAnalysis(node, ctx)
      case FlowNodeType.DECISION: return handleDecision(node, ctx)
      case FlowNodeType.ACTION:   return handleAction(node, ctx)
      case FlowNodeType.RESULT:   return handleResult(node, ctx)
      default:
        return {
          success: true,
          output:  ctx.lastOutput,
          message: `Node type "${String(node.type)}" passed through`,
        }
    }
  }

  // ─── Map legacy node types to new enum ──────────────────────────────────────
  // Allows the engine to run flows created with the old canvas (data_analysis, etc.)

  private normaliseType(raw: string): FlowNodeType {
    if (Object.values(FlowNodeType).includes(raw as FlowNodeType)) {
      return raw as FlowNodeType
    }
    const legacyMap: Record<string, FlowNodeType> = {
      data_analysis: FlowNodeType.ANALYSIS,
      opportunity:   FlowNodeType.ANALYSIS,
      decision:      FlowNodeType.DECISION,
      message_gen:   FlowNodeType.ACTION,
      auto_action:   FlowNodeType.ACTION,
      result:        FlowNodeType.RESULT,
    }
    return legacyMap[raw] ?? FlowNodeType.RESULT
  }

  // ─── Topological sort — Kahn's BFS ──────────────────────────────────────────

  private topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    const map      = new Map(nodes.map(n => [n.id, n]))
    const inDegree = new Map(nodes.map(n => [n.id, 0]))

    for (const e of edges) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    }

    const queue  = nodes.filter(n => (inDegree.get(n.id) ?? 0) === 0)
    const result: FlowNode[] = []

    while (queue.length > 0) {
      const node = queue.shift()!
      result.push(node)

      for (const e of edges.filter(e => e.source === node.id)) {
        const deg = (inDegree.get(e.target) ?? 1) - 1
        inDegree.set(e.target, deg)
        if (deg === 0) {
          const target = map.get(e.target)
          if (target) queue.push(target)
        }
      }
    }

    return result
  }

  // ─── Branch skip logic ───────────────────────────────────────────────────────
  // For each upstream DECISION node that has conditional edges to this node:
  //   - Direct match:    edge.condition === decision taken  → keep node
  //   - Default fallback: edge.condition === 'default'     → keep node (catch-all)
  //   - No match at all:                                   → skip node
  //
  // Unconditional edges (no condition) are always traversed.

  private shouldSkip(
    node:            FlowNode,
    edges:           FlowEdge[],
    branchDecisions: Map<string, string>,
  ): boolean {
    const conditionalIncoming = edges.filter(e => e.target === node.id && e.condition != null)
    if (conditionalIncoming.length === 0) return false

    // Group by source decision node
    const sources = [...new Set(conditionalIncoming.map(e => e.source))]

    for (const sourceId of sources) {
      const decision = branchDecisions.get(sourceId)
      if (decision === undefined) continue  // source hasn't run (shouldn't happen in toposort)

      const edgesFromSource = conditionalIncoming.filter(e => e.source === sourceId)

      // Direct match: this node has an edge for exactly the chosen condition
      if (edgesFromSource.some(e => e.condition === decision)) continue

      // Default fallback: this node has a catch-all edge from this source
      if (edgesFromSource.some(e => e.condition === 'default')) continue

      // Neither direct match nor default → this source blocks the node
      return true
    }

    return false
  }

  // ─── Log builder ─────────────────────────────────────────────────────────────

  private makeLog(
    node:       FlowNode,
    status:     StepLog['status'],
    input:      unknown,
    output:     unknown,
    durationMs: number,
    message?:   string,
  ): StepLog {
    return {
      nodeId:     node.id,
      nodeType:   String(node.type),
      status,
      input,
      output,
      durationMs,
      timestamp:  new Date().toISOString(),
      message,
    }
  }
}
