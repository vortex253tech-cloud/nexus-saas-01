// ─── Plan Definitions + Feature Gating ───────────────────────────────────────
// Source of truth for all plan limits and feature flags.
// Usage: import { PLANS, checkFeature, getPlanLimits } from '@/lib/plans'

export type PlanId = 'free' | 'pro' | 'scale'

export interface PlanLimits {
  automations:     number  // max saved flows
  messagesPerMonth: number  // emails + whatsapps sent
  clientsTracked:  number  // active clients
  paymentLinks:    number  // payment links generated/month
  aiAnalysis:      boolean // AI-powered recommendations
  whiteLabel:      boolean // custom logo + brand name
  retentionEngine: boolean // at-risk detection + cron
  advancedFlows:   boolean // full flow builder (otherwise 3-node max)
  apiAccess:       boolean // REST API keys
  teamMembers:     number  // seats
}

export interface Plan {
  id:          PlanId
  name:        string
  priceMonthly: number  // BRL
  priceAnnual:  number  // BRL
  limits:      PlanLimits
}

// ─── Plan catalogue ───────────────────────────────────────────────────────────

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id:           'free',
    name:         'Free',
    priceMonthly: 0,
    priceAnnual:  0,
    limits: {
      automations:      3,
      messagesPerMonth: 50,
      clientsTracked:   50,
      paymentLinks:     10,
      aiAnalysis:       false,
      whiteLabel:       false,
      retentionEngine:  false,
      advancedFlows:    false,
      apiAccess:        false,
      teamMembers:      1,
    },
  },

  pro: {
    id:           'pro',
    name:         'Pro',
    priceMonthly: 297,
    priceAnnual:  2_970,
    limits: {
      automations:      25,
      messagesPerMonth: 2_000,
      clientsTracked:   500,
      paymentLinks:     200,
      aiAnalysis:       true,
      whiteLabel:       false,
      retentionEngine:  true,
      advancedFlows:    true,
      apiAccess:        false,
      teamMembers:      3,
    },
  },

  scale: {
    id:           'scale',
    name:         'Scale',
    priceMonthly: 997,
    priceAnnual:  9_970,
    limits: {
      automations:      -1,   // unlimited
      messagesPerMonth: -1,
      clientsTracked:   -1,
      paymentLinks:     -1,
      aiAnalysis:       true,
      whiteLabel:       true,
      retentionEngine:  true,
      advancedFlows:    true,
      apiAccess:        true,
      teamMembers:      -1,
    },
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPlanLimits(planId: string): PlanLimits {
  return (PLANS[planId as PlanId] ?? PLANS.free).limits
}

/** Boolean feature gate — returns false if the plan doesn't include the feature. */
export function checkFeature(
  planId: string,
  feature: keyof Pick<PlanLimits,
    'aiAnalysis' | 'whiteLabel' | 'retentionEngine' | 'advancedFlows' | 'apiAccess'>,
): boolean {
  return getPlanLimits(planId)[feature] as boolean
}

/** Usage gate — returns true if current count is within plan limit. */
export function withinLimit(
  planId:  string,
  counter: keyof Pick<PlanLimits, 'automations' | 'messagesPerMonth' | 'clientsTracked' | 'paymentLinks' | 'teamMembers'>,
  current: number,
): boolean {
  const limit = getPlanLimits(planId)[counter] as number
  return limit === -1 || current < limit
}

export interface UsageStatus {
  allowed:   boolean
  current:   number
  limit:     number
  unlimited: boolean
}

export function usageStatus(
  planId:  string,
  counter: keyof Pick<PlanLimits, 'automations' | 'messagesPerMonth' | 'clientsTracked' | 'paymentLinks' | 'teamMembers'>,
  current: number,
): UsageStatus {
  const limit = getPlanLimits(planId)[counter] as number
  return {
    allowed:   limit === -1 || current < limit,
    current,
    limit,
    unlimited: limit === -1,
  }
}
