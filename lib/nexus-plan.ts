// lib/nexus-plan.ts
// Single source of truth for plans, features, and limits.
// DB stores: 'free' | 'starter' | 'pro' | 'scale' | 'enterprise'
// Display name for 'scale' is "Business" — no migration needed.

import type { Plan } from './db'

export type { Plan }

// ── Display labels ─────────────────────────────────────────────────────────────
export const PLAN_DISPLAY: Record<Plan, string> = {
  free:       'Free',
  starter:    'Starter',
  pro:        'Pro',
  scale:      'Business',   // "scale" in DB → "Business" in UI
  enterprise: 'Enterprise',
}

// Plan rank for comparisons
const PLAN_RANK: Record<Plan, number> = {
  free: 0, starter: 1, pro: 2, scale: 3, enterprise: 4,
}

export function isAtLeast(plan: Plan, required: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[required]
}

// ── Feature catalogue ─────────────────────────────────────────────────────────
export type PlanFeature =
  // Core (all paid plans)
  | 'crm' | 'leads' | 'pipeline' | 'tasks' | 'nexus_ai' | 'projects' | 'financial_dashboard'
  // PRO+
  | 'whatsapp' | 'automations' | 'revenue_engine' | 'export_reports' | 'advanced_analytics'
  // BUSINESS+
  | 'multi_users' | 'agents_advanced' | 'nexus_coo' | 'executive_ai' | 'api_access' | 'dashboard_advanced'
  // ENTERPRISE only
  | 'white_label' | 'multi_company' | 'api_advanced'

// ── Limit keys ────────────────────────────────────────────────────────────────
export type PlanLimit =
  | 'max_users' | 'max_leads' | 'max_projects' | 'max_agents' | 'max_ai_messages' | 'max_automations'

const UNLIMITED = -1

// ── Plan config matrix ────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<Plan, {
  features: PlanFeature[]
  limits:   Record<PlanLimit, number>
}> = {
  free: {
    features: [],
    limits: {
      max_users:        1,
      max_leads:        10,
      max_projects:     1,
      max_agents:       0,
      max_ai_messages:  50,
      max_automations:  0,
    },
  },

  starter: {
    features: ['crm', 'leads', 'pipeline', 'tasks', 'nexus_ai', 'projects', 'financial_dashboard'],
    limits: {
      max_users:        1,
      max_leads:        100,
      max_projects:     3,
      max_agents:       1,
      max_ai_messages:  500,
      max_automations:  0,
    },
  },

  pro: {
    features: [
      'crm', 'leads', 'pipeline', 'tasks', 'nexus_ai', 'projects', 'financial_dashboard',
      'whatsapp', 'automations', 'revenue_engine', 'export_reports', 'advanced_analytics',
    ],
    limits: {
      max_users:        5,
      max_leads:        1000,
      max_projects:     20,
      max_agents:       5,
      max_ai_messages:  5000,
      max_automations:  50,
    },
  },

  scale: {   // displayed as "Business"
    features: [
      'crm', 'leads', 'pipeline', 'tasks', 'nexus_ai', 'projects', 'financial_dashboard',
      'whatsapp', 'automations', 'revenue_engine', 'export_reports', 'advanced_analytics',
      'multi_users', 'agents_advanced', 'nexus_coo', 'executive_ai', 'api_access', 'dashboard_advanced',
    ],
    limits: {
      max_users:        20,
      max_leads:        UNLIMITED,
      max_projects:     UNLIMITED,
      max_agents:       20,
      max_ai_messages:  UNLIMITED,
      max_automations:  UNLIMITED,
    },
  },

  enterprise: {
    features: [
      'crm', 'leads', 'pipeline', 'tasks', 'nexus_ai', 'projects', 'financial_dashboard',
      'whatsapp', 'automations', 'revenue_engine', 'export_reports', 'advanced_analytics',
      'multi_users', 'agents_advanced', 'nexus_coo', 'executive_ai', 'api_access', 'dashboard_advanced',
      'white_label', 'multi_company', 'api_advanced',
    ],
    limits: {
      max_users:        UNLIMITED,
      max_leads:        UNLIMITED,
      max_projects:     UNLIMITED,
      max_agents:       UNLIMITED,
      max_ai_messages:  UNLIMITED,
      max_automations:  UNLIMITED,
    },
  },
}

// ── Feature access ────────────────────────────────────────────────────────────

export function canAccess(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_CONFIG[plan].features.includes(feature)
}

// Returns the minimum plan required for a feature (for upgrade prompts)
export function requiredPlanFor(feature: PlanFeature): Plan {
  const order: Plan[] = ['starter', 'pro', 'scale', 'enterprise']
  for (const p of order) {
    if (canAccess(p, feature)) return p
  }
  return 'enterprise'
}

// ── Limit access ──────────────────────────────────────────────────────────────

export function getLimit(plan: Plan, limit: PlanLimit): number {
  return PLAN_CONFIG[plan].limits[limit]
}

export function isUnlimited(plan: Plan, limit: PlanLimit): boolean {
  return PLAN_CONFIG[plan].limits[limit] === UNLIMITED
}

export function isWithinLimit(plan: Plan, limit: PlanLimit, current: number): boolean {
  const max = getLimit(plan, limit)
  if (max === UNLIMITED) return true
  return current < max
}

// ── Subscription status guard ─────────────────────────────────────────────────
// Returns false if subscription is in a state that revokes access.
export function isSubscriptionActive(status: string | null | undefined): boolean {
  if (!status) return false
  return ['active', 'trialing'].includes(status)
}

// ── Pricing ───────────────────────────────────────────────────────────────────
export const PLAN_PRICING: Record<Plan, { monthly: number; annual: number; display: string }> = {
  free:       { monthly: 0,      annual: 0,      display: 'Grátis'      },
  starter:    { monthly: 197,    annual: 1773,    display: 'R$ 197/mês'  },
  pro:        { monthly: 397,    annual: 3573,    display: 'R$ 397/mês'  },
  scale:      { monthly: 797,    annual: 7173,    display: 'R$ 797/mês'  },
  enterprise: { monthly: 0,      annual: 0,       display: 'Sob consulta'},
}

// ── Feature → human label (for UI) ───────────────────────────────────────────
export const FEATURE_LABEL: Partial<Record<PlanFeature, string>> = {
  whatsapp:           'WhatsApp AI',
  automations:        'Automações',
  revenue_engine:     'Motor de Receita',
  export_reports:     'Exportar Relatórios',
  advanced_analytics: 'Analytics Avançado',
  multi_users:        'Múltiplos Usuários',
  agents_advanced:    'Agentes IA Avançados',
  nexus_coo:          'Nexus COO',
  executive_ai:       'IA Executiva',
  api_access:         'Acesso à API',
  dashboard_advanced: 'Dashboard Avançado',
  white_label:        'White Label',
  multi_company:      'Múltiplas Empresas',
  api_advanced:       'API Avançada',
}
