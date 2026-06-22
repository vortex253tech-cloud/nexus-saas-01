// lib/usage.ts
// Usage counters — back the 'max_ai_messages' and 'max_flow_executions' plan limits.
// Reuses the increment_usage(company_id, field, amount) RPC
// (supabase/migrations/20240003_hardening.sql, made period-aware by
// 20260622_usage_period_reset.sql). Reads/writes are always scoped to the
// current calendar month (period_start) — counters reset naturally every
// month because increment_usage() creates a new row per period.

import { getSupabaseServerClient } from '@/lib/supabase'

function currentPeriodStart(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

async function getUsageField(companyId: string, field: 'ai_messages_count' | 'flow_executions_count'): Promise<number> {
  const db = getSupabaseServerClient()

  const { data } = await db
    .from('company_usage')
    .select(field)
    .eq('company_id', companyId)
    .eq('period_start', currentPeriodStart())
    .maybeSingle()

  const row = data as Record<string, number> | null
  return row?.[field] ?? 0
}

async function incrementUsageField(companyId: string, field: 'ai_messages_count' | 'flow_executions_count', amount = 1): Promise<void> {
  const db = getSupabaseServerClient()

  await db.rpc('increment_usage', {
    p_company_id: companyId,
    p_field:      field,
    p_amount:     amount,
  })
}

export async function getAiUsage(companyId: string): Promise<number> {
  return getUsageField(companyId, 'ai_messages_count')
}

export async function incrementAiUsage(companyId: string, amount = 1): Promise<void> {
  return incrementUsageField(companyId, 'ai_messages_count', amount)
}

export async function getFlowExecutionUsage(companyId: string): Promise<number> {
  return getUsageField(companyId, 'flow_executions_count')
}

export async function incrementFlowExecutionUsage(companyId: string, amount = 1): Promise<void> {
  return incrementUsageField(companyId, 'flow_executions_count', amount)
}
