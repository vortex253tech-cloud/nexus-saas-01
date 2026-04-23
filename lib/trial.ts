// ─── Trial + Plan access helpers ────────────────────────────────
// Server-safe (no browser APIs). Used in API routes and auth context.

import type { DBSubscription, Plan } from './db'
import { isAtLeast } from './plan-gates'

// ─── Days left in trial ─────────────────────────────────────────

export function getTrialDaysLeft(subscription: DBSubscription | null): number | null {
  if (!subscription) return null
  if (subscription.status !== 'trialing') return null
  if (!subscription.trial_ends_at) return null

  const diffMs = new Date(subscription.trial_ends_at).getTime() - Date.now()
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

// ─── Is the trial currently active (not expired)? ───────────────

export function isTrialActive(subscription: DBSubscription | null): boolean {
  if (!subscription || subscription.status !== 'trialing') return false
  if (!subscription.trial_ends_at) return false
  return new Date(subscription.trial_ends_at) > new Date()
}

// ─── Effective plan — trial users get PRO access ────────────────

export function getEffectivePlan(
  subscription: DBSubscription | null,
  basePlan: Plan,
): Plan {
  if (isTrialActive(subscription)) return 'pro'
  return basePlan
}

// ─── Feature gate ────────────────────────────────────────────────

export type GatedFeature =
  | 'whatsapp'
  | 'ai_auto'
  | 'reports_advanced'
  | 'export_csv'
  | 'clients_module'

const FEATURE_MIN_PLAN: Record<GatedFeature, Plan> = {
  whatsapp:          'pro',
  ai_auto:           'starter',
  reports_advanced:  'pro',
  export_csv:        'pro',
  clients_module:    'starter',
}

export function checkPlanAccess(
  subscription: DBSubscription | null,
  basePlan: Plan,
  feature: GatedFeature,
): boolean {
  const effective = getEffectivePlan(subscription, basePlan)
  return isAtLeast(effective, FEATURE_MIN_PLAN[feature])
}
