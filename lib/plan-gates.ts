// ─── Plan feature gating ────────────────────────────────────────

import type { Plan } from './db'

export interface PlanFeatures {
  maxInsights: number          // -1 = unlimited
  realAI: boolean              // AI-generated insights
  alertas: boolean             // automatic alerts
  maxFinancialRecords: number  // -1 = unlimited
  charts: boolean              // financial evolution charts
  whatsappAlerts: boolean      // WhatsApp notifications
  exportReports: boolean       // export PDF reports
  multipleCompanies: number    // -1 = unlimited
  continuousLoop: boolean      // auto re-generate on new data
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    maxInsights: 2,
    realAI: false,
    alertas: false,
    maxFinancialRecords: 1,
    charts: false,
    whatsappAlerts: false,
    exportReports: false,
    multipleCompanies: 1,
    continuousLoop: false,
  },
  starter: {
    maxInsights: 5,
    realAI: true,
    alertas: true,
    maxFinancialRecords: 6,
    charts: false,
    whatsappAlerts: false,
    exportReports: false,
    multipleCompanies: 1,
    continuousLoop: true,
  },
  pro: {
    maxInsights: -1,
    realAI: true,
    alertas: true,
    maxFinancialRecords: -1,
    charts: true,
    whatsappAlerts: true,
    exportReports: true,
    multipleCompanies: 3,
    continuousLoop: true,
  },
  enterprise: {
    maxInsights: -1,
    realAI: true,
    alertas: true,
    maxFinancialRecords: -1,
    charts: true,
    whatsappAlerts: true,
    exportReports: true,
    multipleCompanies: -1,
    continuousLoop: true,
  },
}

export function getFeatures(plan: Plan): PlanFeatures {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.free
}

export function canUse(plan: Plan, feature: keyof PlanFeatures): boolean {
  const f = getFeatures(plan)
  const val = f[feature]
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val !== 0
  return false
}

export function planLabel(plan: Plan): string {
  return { free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }[plan]
}

export const PLAN_HIERARCHY: Plan[] = ['free', 'starter', 'pro', 'enterprise']

export function planRank(plan: Plan): number {
  return PLAN_HIERARCHY.indexOf(plan)
}

export function isAtLeast(userPlan: Plan, required: Plan): boolean {
  return planRank(userPlan) >= planRank(required)
}
