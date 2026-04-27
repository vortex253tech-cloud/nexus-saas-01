import { getSupabaseServerClient } from '@/lib/supabase'
import type {
  FlowDefinition, FlowNode, FlowEdge,
  ExecutionRecord, ExecutionStatus, StepLog,
} from './types'

// ─── Repository — all DB access for the flow engine ─────────────────────────
// No business logic here. Pure data access.

export class FlowRepository {
  private get db() { return getSupabaseServerClient() }

  // ─── Flows ────────────────────────────────────────────────────────────────

  async getFlow(flowId: string, companyId: string): Promise<FlowDefinition | null> {
    const { data, error } = await this.db
      .from('growth_maps')
      .select('id, name, nodes, edges, company_id')
      .eq('id', flowId)
      .eq('company_id', companyId)
      .single()

    if (error || !data) return null

    const d = data as Record<string, unknown>
    return {
      id:        d.id as string,
      name:      d.name as string,
      nodes:     (d.nodes as unknown[] ?? []) as FlowNode[],
      edges:     (d.edges as unknown[] ?? []) as FlowEdge[],
      companyId: d.company_id as string,
    }
  }

  async updateLastExecuted(flowId: string): Promise<void> {
    await this.db
      .from('growth_maps')
      .update({ last_executed_at: new Date().toISOString() })
      .eq('id', flowId)
  }

  // ─── Executions ───────────────────────────────────────────────────────────

  async createExecution(flowId: string, companyId: string): Promise<string> {
    const { data, error } = await this.db
      .from('flow_executions')
      .insert({
        flow_id:    flowId,
        company_id: companyId,
        status:     'pending',
        logs:       [],
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !data) throw new Error(`Failed to create execution: ${error?.message ?? 'unknown'}`)
    return (data as { id: string }).id
  }

  async markRunning(id: string): Promise<void> {
    await this.db
      .from('flow_executions')
      .update({ status: 'running' })
      .eq('id', id)
  }

  async appendLog(id: string, logs: StepLog[]): Promise<void> {
    await this.db
      .from('flow_executions')
      .update({ logs })
      .eq('id', id)
  }

  async updateExecution(
    id:          string,
    status:      ExecutionStatus,
    logs:        StepLog[],
    output:      unknown,
    finishedAt?: string,
  ): Promise<void> {
    const update: Record<string, unknown> = { status, logs, output }
    if (finishedAt) update.finished_at = finishedAt

    await this.db.from('flow_executions').update(update).eq('id', id)
  }

  async getExecution(id: string): Promise<ExecutionRecord | null> {
    const { data, error } = await this.db
      .from('flow_executions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null

    const d = data as Record<string, unknown>
    return {
      id:          d.id as string,
      flowId:      d.flow_id as string,
      companyId:   d.company_id as string,
      status:      d.status as ExecutionStatus,
      logs:        (d.logs as StepLog[]) ?? [],
      output:      d.output ?? null,
      startedAt:   d.started_at as string,
      finishedAt:  d.finished_at as string | undefined,
    }
  }

  async listExecutions(flowId: string, companyId: string, limit = 10): Promise<ExecutionRecord[]> {
    const { data } = await this.db
      .from('flow_executions')
      .select('id, flow_id, company_id, status, logs, output, started_at, finished_at')
      .eq('flow_id', flowId)
      .eq('company_id', companyId)
      .order('started_at', { ascending: false })
      .limit(limit)

    return (data ?? []).map(d => {
      const r = d as Record<string, unknown>
      return {
        id:          r.id as string,
        flowId:      r.flow_id as string,
        companyId:   r.company_id as string,
        status:      r.status as ExecutionStatus,
        logs:        (r.logs as StepLog[]) ?? [],
        output:      r.output ?? null,
        startedAt:   r.started_at as string,
        finishedAt:  r.finished_at as string | undefined,
      }
    })
  }

  async getPendingExecutions(): Promise<Array<{ id: string; flowId: string; companyId: string }>> {
    const { data } = await this.db
      .from('flow_executions')
      .select('id, flow_id, company_id')
      .eq('status', 'pending')
      .order('started_at', { ascending: true })
      .limit(10)

    return (data ?? []).map(d => {
      const r = d as Record<string, string>
      return { id: r.id, flowId: r.flow_id, companyId: r.company_id }
    })
  }
}
