import { FlowRepository }    from './flow-repository'
import { FlowEngineService } from './flow-engine.service'

// ─── Flow Queue ───────────────────────────────────────────────────────────────
// Abstracts "enqueue execution" from "run execution".
//
// Current implementation: DB-backed, processes synchronously in the same
// serverless invocation. The caller gets an executionId immediately; the
// record is created as 'pending' first, then processed to completion.
//
// Future: swap process() for a message-queue publish (SQS, Upstash, etc.)
// and let a separate worker pick it up — zero changes to callers.

export class FlowQueue {
  private repo:   FlowRepository
  private engine: FlowEngineService

  constructor() {
    this.repo   = new FlowRepository()
    this.engine = new FlowEngineService()
  }

  /**
   * Enqueue a flow execution.
   * Creates a persistent record → runs it → returns when done.
   * The executionId is stable and can be polled via the API.
   */
  async enqueue(flowId: string, companyId: string): Promise<string> {
    const executionId = await this.repo.createExecution(flowId, companyId)
    await this.engine.executeFlow(executionId, flowId, companyId)
    return executionId
  }

  /**
   * Process all stale 'pending' executions.
   * Called by the /api/cron/flow-queue route (daily safety net).
   */
  async drainPending(): Promise<{ processed: number; errors: number }> {
    const pending = await this.repo.getPendingExecutions()
    let processed = 0
    let errors    = 0

    for (const item of pending) {
      try {
        await this.engine.executeFlow(item.id, item.flowId, item.companyId)
        processed++
      } catch {
        errors++
      }
    }

    return { processed, errors }
  }
}
