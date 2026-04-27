import { Queue }              from 'bullmq'
import { getRedisConnection, hasRedis } from './queue-connection'
import { FlowQueue }           from './flow-queue'
import { FlowEngineService }   from './flow-engine.service'
import { FlowRepository }      from './flow-repository'

export const QUEUE_NAME = 'flow-execution'

export interface FlowJobData {
  flowId:      string
  companyId:   string
  executionId: string
}

// ─── FlowService ─────────────────────────────────────────────────────────────
// Single entry point for callers: "run this flow for this company".
// Enqueues via BullMQ when Redis is available; falls back to direct execution.

export class FlowService {
  async runFlow(flowId: string, companyId: string): Promise<{ executionId: string }> {
    // Always create the execution record first so callers get an ID immediately.
    const repo   = new FlowRepository()
    const execId = await repo.createExecution(flowId, companyId)

    if (hasRedis()) {
      await this.enqueueJob({ flowId, companyId, executionId: execId })
    } else {
      // Synchronous fallback — fine for development or when Redis is unavailable.
      const engine = new FlowEngineService()
      await engine.executeFlow(execId, flowId, companyId)
    }

    return { executionId: execId }
  }

  private async enqueueJob(data: FlowJobData): Promise<void> {
    const connection = getRedisConnection()!
    const queue      = new Queue<FlowJobData>(QUEUE_NAME, { connection })
    await queue.add('execute', data, {
      removeOnComplete: 1000,
      removeOnFail:     500,
    })
    await queue.close()
  }
}
