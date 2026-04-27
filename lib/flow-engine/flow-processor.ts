import { Worker, Job }          from 'bullmq'
import { getRedisConnection }    from './queue-connection'
import { FlowEngineService }     from './flow-engine.service'
import { FlowRepository }        from './flow-repository'
import { QUEUE_NAME, FlowJobData } from './flow.service'

// ─── createFlowProcessor ─────────────────────────────────────────────────────
// Returns a BullMQ Worker that processes flow-execution jobs.
// Call this from a long-running process (Node.js worker, dedicated dyno, etc.).
// On Vercel serverless, use processPendingJobs() instead.

export function createFlowProcessor(): Worker<FlowJobData> {
  const connection = getRedisConnection()
  if (!connection) throw new Error('Redis not configured — cannot start Worker')

  const engine = new FlowEngineService()

  return new Worker<FlowJobData>(
    QUEUE_NAME,
    async (job: Job<FlowJobData>) => {
      const { flowId, companyId, executionId } = job.data
      await engine.executeFlow(executionId, flowId, companyId)
    },
    { connection, concurrency: 5 },
  )
}

// ─── processPendingJobs ───────────────────────────────────────────────────────
// Serverless-friendly alternative: pulls pending executions from the DB and
// runs them inline. Designed to be called from a cron API route.

export async function processPendingJobs(limit = 10): Promise<{
  processed: number
  errors:    string[]
}> {
  const repo    = new FlowRepository()
  const engine  = new FlowEngineService()
  const pending = await repo.getPendingExecutions()

  let processed = 0
  const errors: string[] = []

  for (const exec of pending.slice(0, limit)) {
    try {
      await engine.executeFlow(exec.id, exec.flowId, exec.companyId)
      processed++
    } catch (err) {
      errors.push(`${exec.id}: ${String(err)}`)
    }
  }

  return { processed, errors }
}
