// ─── Flow Error Logger ────────────────────────────────────────────────────────
// Centralised DB-backed error logger for the flow engine.
// All writes are fire-and-forget — never throw, never block execution.

import { getSupabaseServerClient } from '@/lib/supabase'

export interface FlowErrorInput {
  companyId:   string
  flowId?:     string
  executionId?: string
  nodeId?:     string
  nodeType?:   string
  errorCode?:  string
  message:     string
  stack?:      string
  context?:    Record<string, unknown>
}

export async function logFlowError(input: FlowErrorInput): Promise<void> {
  try {
    const db = getSupabaseServerClient()
    await db.from('flow_errors').insert({
      company_id:   input.companyId,
      flow_id:      input.flowId ?? null,
      execution_id: input.executionId ?? null,
      node_id:      input.nodeId ?? null,
      node_type:    input.nodeType ?? null,
      error_code:   input.errorCode ?? null,
      message:      input.message,
      stack:        input.stack ?? null,
      context:      input.context ?? {},
    })
  } catch {
    // Logging must never break the caller
  }
}

export async function resolveFlowError(
  errorId:   string,
  companyId: string,
): Promise<boolean> {
  try {
    const db = getSupabaseServerClient()
    const { error } = await db
      .from('flow_errors')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', errorId)
      .eq('company_id', companyId)
    return !error
  } catch {
    return false
  }
}
