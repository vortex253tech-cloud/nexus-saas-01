import type { SupabaseClient } from '@supabase/supabase-js'

export type ClientSegment  = 'overdue' | 'inactive' | 'active'
export type DecisionAction = 'collect_payment' | 'reactivate_client' | 'upsell'

export interface RawClient {
  id:               string
  name:             string
  email:            string | null
  phone:            string | null
  total_revenue:    number
  due_date:         string | null
  status:           'pending' | 'paid' | 'overdue'
  last_interaction: string | null
}

export interface SegmentedClient extends RawClient {
  segment:      ClientSegment
  action:       DecisionAction
  days_overdue: number
  days_inactive: number
}

// Clients with no interaction in 30+ days are considered inactive
const INACTIVE_THRESHOLD = 30

export function segmentClient(raw: RawClient): SegmentedClient {
  const now = Date.now()

  const days_overdue = raw.due_date
    ? Math.max(0, Math.floor((now - new Date(raw.due_date).getTime()) / 86_400_000))
    : 0

  const days_inactive = raw.last_interaction
    ? Math.floor((now - new Date(raw.last_interaction).getTime()) / 86_400_000)
    : INACTIVE_THRESHOLD + 1   // no interaction on record → treat as inactive

  let segment: ClientSegment

  if (raw.status === 'overdue' || (days_overdue > 0 && raw.status !== 'paid')) {
    segment = 'overdue'
  } else if (days_inactive >= INACTIVE_THRESHOLD) {
    segment = 'inactive'
  } else {
    segment = 'active'
  }

  const action: DecisionAction =
    segment === 'overdue'  ? 'collect_payment'   :
    segment === 'inactive' ? 'reactivate_client' :
    'upsell'

  return { ...raw, segment, action, days_overdue, days_inactive }
}

export async function fetchAndSegmentClients(
  db: SupabaseClient,
  companyId: string,
): Promise<SegmentedClient[]> {
  const { data, error } = await db
    .from('clients')
    .select('id, name, email, phone, total_revenue, due_date, status, last_interaction')
    .eq('company_id', companyId)
    .neq('status', 'paid')

  if (error || !data) return []

  return (data as RawClient[]).map(segmentClient)
}
