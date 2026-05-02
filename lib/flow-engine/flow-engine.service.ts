import { FlowRepository }   from './flow-repository'
import { FlowNodeType }     from './types'
import type { FlowNode, FlowEdge, ExecutionContext, NodeResult, StepLog } from './types'
import { buildFlowContext } from './context-builder'
import { analyzeExecution } from './analyze-execution'
import { validateNodeConfig } from './validators/node-config.validator'
import { logFlowError }      from '@/lib/errors/flow-error-logger'

import { handleTrigger }    from './handlers/trigger.handler'
import { handleAnalysis }   from './handlers/analysis.handler'
import { handleDecision }   from './handlers/decision.handler'
import { handleAction }     from './handlers/action.handler'
import { handleResult }     from './handlers/result.handler'
import { handleMessageGen } from './handlers/message-gen.handler'

// ─── Flow Engine Service ──────────────────────────────────────────────────────
// Orchestrates execution of a saved flow:
//   1. Load flow definition from DB
//   2. Topological sort of nodes
//   3. Execute each node with full error isolation
//   4. Log every step in real-time
//   5. Persist final state + fire-and-forget analysis

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

    const flowContext = await buildFlowContext(companyId, flowId).catch(() => undefined)

    const ctx: ExecutionContext = {
      flowId,
      executionId,
      companyId,
      variables:  { flowContext },
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

      analyzeExecution(executionId, flowId, companyId, ctx.logs, ctx.lastOutput).catch(() => undefined)

    } catch (err) {
      const msg = String(err)
      logFlowError({
        companyId:   companyId,
        flowId:      flowId,
        executionId: executionId,
        message:     msg,
        stack:       err instanceof Error ? err.stack : undefined,
        errorCode:   'FLOW_EXECUTION_ERROR',
      }).catch(() => undefined)

      await this.repo.updateExecution(
        executionId, 'error', ctx.logs,
        { error: msg },
        new Date().toISOString(),
      )
    }
  }

  // ─── Direct execution (no DB flow lookup) ───────────────────────────────────

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

  // ─── Node normaliser ─────────────────────────────────────────────────────────
  // Canvas nodes are stored as GrowthNode: { id, type, position, data: { label, config } }
  // The engine FlowNode interface expects a top-level `config` field.
  // This method bridges the gap by promoting data.config → config so every
  // handler can safely read `node.config` without touching `node.data`.

  private normaliseNode(raw: FlowNode): FlowNode {
    const data = raw.data as Record<string, unknown> | undefined

    // Config is already at top level (engine-native format) — keep as-is
    if (raw.config && Object.keys(raw.config).length > 0) return raw

    // Promote data.config to top-level config (canvas / template format)
    const dataConfig = (data?.config ?? {}) as Record<string, unknown>

    return {
      ...raw,
      config: dataConfig,
      label:  raw.label ?? (data?.label as string | undefined),
    }
  }

  // ─── Node runner ────────────────────────────────────────────────────────────
  // RESILIENCE: each node is individually isolated. An error in any single
  // node is logged and execution continues — it does NOT halt the flow.
  // The only exception is the TRIGGER node failing its condition.

  private async runNodes(
    nodes:       FlowNode[],
    edges:       FlowEdge[],
    ctx:         ExecutionContext,
    executionId: string,
  ): Promise<void> {
    const sorted          = this.topologicalSort(nodes, edges)
    const branchDecisions = new Map<string, string>()

    for (const rawNode of sorted) {
      // Normalise canvas format → engine format before any access
      const node    = this.normaliseNode(rawNode)
      const skipped = this.shouldSkip(node, edges, branchDecisions)

      if (skipped) {
        ctx.logs.push(this.makeLog(node, 'skipped', ctx.lastOutput, null, 0, 'Pulado — branch não tomado'))
        await this.repo.appendLog(executionId, ctx.logs)
        continue
      }

      // Validate node config before execution — log warnings, don't halt
      const configErrors = validateNodeConfig(node)
      if (configErrors.length > 0) {
        const warnMsg = configErrors.map(e => `${e.field}: ${e.message}`).join('; ')
        ctx.logs.push(this.makeLog(node, 'error', ctx.lastOutput, null, 0,
          `Config inválida — ${warnMsg}`))
        await this.repo.appendLog(executionId, ctx.logs)
        // TRIGGER config errors are fatal; other nodes skip gracefully
        if (this.normaliseType(node.type) === (FlowNodeType.TRIGGER as string)) {
          throw new Error(`Trigger config inválida: ${warnMsg}`)
        }
        continue
      }

      const t0 = Date.now()

      try {
        const result = await this.dispatch(node, ctx)
        const log    = this.makeLog(
          node,
          result.success ? 'success' : 'error',
          ctx.lastOutput,
          result.output,
          Date.now() - t0,
          result.message,
        )
        ctx.logs.push(log)

        if (result.nextBranch) {
          branchDecisions.set(node.id, result.nextBranch)
          log.message = result.message ?? `Decisão → "${result.nextBranch}"`
        }

        if (result.success) {
          ctx.lastOutput = result.output
        } else {
          // TRIGGER failure halts the flow; all other failures are logged and swallowed
          if (this.normaliseType(node.type) === (FlowNodeType.TRIGGER as string)) {
            log.status  = 'error'
            await this.repo.appendLog(executionId, ctx.logs)
            throw new Error(result.message ?? 'Trigger condition failed')
          }
          log.status = 'error'
        }

        await this.repo.appendLog(executionId, ctx.logs)

      } catch (err) {
        const errMsg = String(err)
        const log = this.makeLog(node, 'error', ctx.lastOutput, null, Date.now() - t0, errMsg)
        ctx.logs.push(log)
        await this.repo.appendLog(executionId, ctx.logs)

        // Persist node-level errors to the error dashboard
        logFlowError({
          companyId:   ctx.companyId,
          flowId:      ctx.flowId,
          executionId: ctx.executionId,
          nodeId:      node.id,
          nodeType:    node.type,
          message:     errMsg,
          stack:       err instanceof Error ? err.stack : undefined,
          errorCode:   'NODE_EXECUTION_ERROR',
          context:     { config: node.config },
        }).catch(() => undefined)

        if (this.normaliseType(node.type) === FlowNodeType.TRIGGER) throw err
        // All other nodes: swallow and continue
      }
    }
  }

  // ─── Node dispatcher ────────────────────────────────────────────────────────

  private async dispatch(node: FlowNode, ctx: ExecutionContext): Promise<NodeResult> {
    const type = this.normaliseType(node.type)

    if (type === FlowNodeType.TRIGGER)  return handleTrigger(node, ctx)
    if (type === FlowNodeType.ANALYSIS) return handleAnalysis(node, ctx)
    if (type === FlowNodeType.DECISION) return handleDecision(node, ctx)
    if (type === FlowNodeType.ACTION)   return handleAction(node, ctx)
    if (type === FlowNodeType.RESULT)   return handleResult(node, ctx)
    if (type === 'MESSAGE_GEN')         return handleMessageGen(node, ctx)

    return {
      success: true,
      output:  ctx.lastOutput,
      message: `Nó "${String(node.type)}" passado adiante`,
    }
  }

  // ─── Map canvas node types → engine enum ────────────────────────────────────

  private normaliseType(raw: string): string {
    if (Object.values(FlowNodeType).includes(raw as FlowNodeType)) {
      return raw as FlowNodeType
    }
    const legacyMap: Record<string, string> = {
      data_analysis: FlowNodeType.ANALYSIS,
      opportunity:   FlowNodeType.ANALYSIS,
      decision:      FlowNodeType.DECISION,
      message_gen:   'MESSAGE_GEN',
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

  private shouldSkip(
    node:            FlowNode,
    edges:           FlowEdge[],
    branchDecisions: Map<string, string>,
  ): boolean {
    const conditionalIncoming = edges.filter(e => e.target === node.id && e.condition != null)
    if (conditionalIncoming.length === 0) return false

    const sources = [...new Set(conditionalIncoming.map(e => e.source))]

    for (const sourceId of sources) {
      const decision = branchDecisions.get(sourceId)
      if (decision === undefined) continue

      const edgesFromSource = conditionalIncoming.filter(e => e.source === sourceId)

      if (edgesFromSource.some(e => e.condition === decision)) continue
      if (edgesFromSource.some(e => e.condition === 'default')) continue

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
