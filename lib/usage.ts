// lib/usage.ts
// AI usage counter — backs the 'max_ai_messages' plan limit.
// Reuses the existing increment_usage(company_id, field, amount) RPC
// (supabase/migrations/20240003_hardening.sql) instead of new SQL logic.

import { getSupabaseServerClient } from '@/lib/supabase'

export async function getAiUsage(companyId: string): Promise<number> {
  const db = getSupabaseServerClient()

  const { data } = await db
    .from('company_usage')
    .select('ai_messages_count')
    .eq('company_id', companyId)
    .maybeSingle()

  return data?.ai_messages_count ?? 0
}

export async function incrementAiUsage(companyId: string, amount = 1): Promise<void> {
  const db = getSupabaseServerClient()

  await db.rpc('increment_usage', {
    p_company_id: companyId,
    p_field:      'ai_messages_count',
    p_amount:     amount,
  })
}
