// ─── Plan feature gating ────────────────────────────────────────
// Plans: free → starter → pro → scale → enterprise
// Pricing (monthly): free=0, starter=R$197, pro=R$397, scale=R$797

import type { Plan } from './db'

export interface PlanFeatures {
  // Content limits
  maxInsights:         number   // -1 = unlimited
  maxFinancialRecords: number   // -1 = unlimited
  maxClients:          number   // -1 = unlimited
  maxLeads:            number   // -1 = unlimited
  multipleCompanies:   number   // -1 = unlimited

  // AI features
  realAI:              boolean  // Claude-powered insights
  continuousLoop:      boolean  // auto re-generate on new data
  revenueEngine:       boolean  // autonomous revenue engine (decision + action)

  // Automation
  autopilot:           boolean  // auto-execute actions
  unlimitedFlows:      boolean  // unlimited automation flows (vs 5/mo cap)
  whatsappAlerts:      boolean  // WhatsApp notifications

  // Analytics & reporting
  alertas:             boolean  // automatic alerts
  advancedAnalytics:   boolean  // learning metrics, trend charts, recovery %
  charts:              boolean  // financial evolution charts
  exportReports:       boolean  // export PDF reports

  // Pricing / billing
  priceMonthly:        number   // BRL cents (0 = free)
  priceAnnual:         number   // BRL cents per year (0 = free)
  stripePriceIdMonthly?: string
  stripePriceIdAnnual?:  string
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    maxInsights:         2,
    maxFinancialRecords: 1,
    maxClients:          10,
    maxLeads:            10,
    multipleCompanies:   1,
    realAI:              false,
    continuousLoop:      false,
    revenueEngine:       false,
    autopilot:           false,
    unlimitedFlows:      false,
    whatsappAlerts:      false,
    alertas:             false,
    advancedAnalytics:   false,
    charts:              false,
    exportReports:       false,
    priceMonthly:        0,
    priceAnnual:         0,
  },

  starter: {
    maxInsights:         5,
    maxFinancialRecords: 6,
    maxClients:          50,
    maxLeads:            50,
    multipleCompanies:   1,
    realAI:              true,
    continuousLoop:      true,
    revenueEngine:       false,
    autopilot:           false,
    unlimitedFlows:      false,
    whatsappAlerts:      false,
    alertas:             true,
    advancedAnalytics:   false,
    charts:              false,
    exportReports:       false,
    priceMonthly:        19700,
    priceAnnual:         177300,  // -25%
    stripePriceIdMonthly: process.env.STRIPE_STARTER_MONTHLY,
    stripePriceIdAnnual:  process.env.STRIPE_STARTER_ANNUAL,
  },

  pro: {
    maxInsights:         -1,
    maxFinancialRecords: -1,
    maxClients:          500,
    maxLeads:            500,
    multipleCompanies:   3,
    realAI:              true,
    continuousLoop:      true,
    revenueEngine:       true,
    autopilot:           true,
    unlimitedFlows:      false,  // 20/day cap
    whatsappAlerts:      true,
    alertas:             true,
    advancedAnalytics:   true,
    charts:              true,
    exportReports:       true,
    priceMonthly:        39700,
    priceAnnual:         357300,  // -25%
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY,
    stripePriceIdAnnual:  process.env.STRIPE_PRO_ANNUAL,
  },

  scale: {
    maxInsights:         -1,
    maxFinancialRecords: -1,
    maxClients:          -1,
    maxLeads:            -1,
    multipleCompanies:   -1,
    realAI:              true,
    continuousLoop:      true,
    revenueEngine:       true,
    autopilot:           true,
    unlimitedFlows:      true,
    whatsappAlerts:      true,
    alertas:             true,
    advancedAnalytics:   true,
    charts:              true,
    exportReports:       true,
    priceMonthly:        79700,
    priceAnnual:         717300,  // -25%
    stripePriceIdMonthly: process.env.STRIPE_SCALE_MONTHLY,
    stripePriceIdAnnual:  process.env.STRIPE_SCALE_ANNUAL,
  },

  enterprise: {
    maxInsights:         -1,
    maxFinancialRecords: -1,
    maxClients:          -1,
    maxLeads:            -1,
    multipleCompanies:   -1,
    realAI:              true,
    continuousLoop:      true,
    revenueEngine:       true,
    autopilot:           true,
    unlimitedFlows:      true,
    whatsappAlerts:      true,
    alertas:             true,
    advancedAnalytics:   true,
    charts:              true,
    exportReports:       true,
    priceMonthly:        0,       // Custom pricing
    priceAnnual:         0,
  },
}

// ─── Accessors ────────────────────────────────────────────────────────────────

export function getFeatures(plan: Plan): PlanFeatures {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.free
}

export function canUse(plan: Plan, feature: keyof PlanFeatures): boolean {
  const f   = getFeatures(plan)
  const val = f[feature]
  if (typeof val === 'boolean') return val
  if (typeof val === 'number')  return val !== 0
  return false
}

export function isWithinLimit(plan: Plan, feature: keyof PlanFeatures, count: number): boolean {
  const limit = getFeatures(plan)[feature] as number
  return limit === -1 || count < limit
}

export function planLabel(plan: Plan): string {
  const labels: Record<Plan, string> = {
    free: 'Free', starter: 'Starter', pro: 'Pro', scale: 'Scale', enterprise: 'Enterprise',
  }
  return labels[plan] ?? 'Free'
}

export function planPrice(plan: Plan, period: 'monthly' | 'annual' = 'monthly'): number {
  const f = getFeatures(plan)
  return period === 'annual' ? f.priceAnnual : f.priceMonthly
}

export const PLAN_HIERARCHY: Plan[] = ['free', 'starter', 'pro', 'scale', 'enterprise']

export function planRank(plan: Plan): number {
  return PLAN_HIERARCHY.indexOf(plan)
}

export function isAtLeast(userPlan: Plan, required: Plan): boolean {
  return planRank(userPlan) >= planRank(required)
}

// ─── Feature → minimum plan ───────────────────────────────────────────────────

export const FEATURE_MINIMUM_PLAN: Partial<Record<keyof PlanFeatures, Plan>> = {
  realAI:            'starter',
  alertas:           'starter',
  continuousLoop:    'starter',
  autopilot:         'pro',
  revenueEngine:     'pro',
  advancedAnalytics: 'pro',
  charts:            'pro',
  whatsappAlerts:    'pro',
  exportReports:     'pro',
  unlimitedFlows:    'scale',
}

export function requiredPlanFor(feature: keyof PlanFeatures): Plan {
  return FEATURE_MINIMUM_PLAN[feature] ?? 'free'
}

// ─── Paywall helper ───────────────────────────────────────────────────────────

export function paywallMessage(feature: keyof PlanFeatures): string {
  const plan = requiredPlanFor(feature)
  const messages: Partial<Record<keyof PlanFeatures, string>> = {
    autopilot:         'Auto-Pilot é exclusivo do plano Pro. Deixe a IA executar ações automaticamente.',
    revenueEngine:     'O Motor de Receita está disponível no plano Pro.',
    advancedAnalytics: 'Analytics avançados disponíveis no plano Pro.',
    unlimitedFlows:    'Fluxos ilimitados disponíveis no plano Scale.',
    whatsappAlerts:    'Alertas via WhatsApp disponíveis no plano Pro.',
    exportReports:     'Exportar relatórios disponível no plano Pro.',
    charts:            'Gráficos de evolução disponíveis no plano Pro.',
  }
  return messages[feature] ?? `Disponível a partir do plano ${planLabel(plan)}.`
}
