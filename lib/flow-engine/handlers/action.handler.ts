import { ActionHandlerService }   from '../action-handler.service'
import type { FlowNode, ExecutionContext, NodeResult } from '../types'
import type { ActionContext }       from '../actions/action.types'

// ─── Action handler ───────────────────────────────────────────────────────────
// Thin adapter between the FlowEngine and ActionHandlerService.
// All business logic lives in action-handler.service.ts + actions/*.ts.

export async function handleAction(
  node: FlowNode,
  ctx:  ExecutionContext,
): Promise<NodeResult> {
  const config     = node.config as Record<string, unknown>
  const actionType = (config.actionType as string | undefined) ?? 'create_log'

  const context: ActionContext = {
    companyId:   ctx.companyId,
    executionId: ctx.executionId,
    flowId:      ctx.flowId,
    lastOutput:  ctx.lastOutput,
    variables:   ctx.variables,
  }

  const svc    = new ActionHandlerService()
  const result = await svc.executeAction(actionType, config, context)

  return {
    success: result.success,
    output:  {
      actionType,
      processed: result.processed,
      succeeded: result.succeeded,
      errors:    result.errors,
      payload:   result.payload,
    },
    message: result.message,
  }
}
