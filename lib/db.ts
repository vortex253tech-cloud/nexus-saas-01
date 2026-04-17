// ─── Database types for NEXUS SaaS ────────────────────────────

export interface DBUser {
  id: string
  email: string
  name: string | null
  plan: Plan
  created_at: string
  updated_at: string
}

export interface DBCompany {
  id: string
  user_id: string
  name: string
  sector: string | null
  perfil: string | null
  email: string | null       // Contact email for action delivery
  phone: string | null       // WhatsApp number (E.164 format)
  created_at: string
}

export interface DBFinancialData {
  id: string
  company_id: string
  revenue: number
  costs: number
  profit: number
  period_label: string
  period_date: string
  note: string | null
  created_at: string
}

export interface DBDiagnostic {
  id: string
  company_id: string
  score: number | null
  resumo: string | null
  ganho_total_estimado: number | null
  benchmark_label: string | null
  ai_summary: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
}

export interface DBAction {
  id: string
  company_id: string
  diagnostic_id: string | null
  titulo: string
  descricao: string | null
  detalhe: string | null
  impacto_estimado: number
  ganho_realizado: number
  prazo: string | null
  prioridade: 'critica' | 'alta' | 'media'
  categoria: string | null
  icone: string
  passos: string[]
  status: 'pending' | 'in_progress' | 'done'
  source: 'ai' | 'manual'
  created_at: string
  updated_at: string
}

export interface DBAlert {
  id: string
  company_id: string
  tipo: 'perigo' | 'atencao' | 'oportunidade' | 'info'
  titulo: string
  descricao: string | null
  impacto: string | null
  lido: boolean
  dismissed: boolean
  source: 'ai' | 'system'
  created_at: string
}

export interface DBSubscription {
  id: string
  user_id: string
  plan: Plan
  status: 'trialing' | 'active' | 'canceled' | 'past_due'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

// ─── Plan types ────────────────────────────────────────────────

export type Plan = 'free' | 'starter' | 'pro' | 'enterprise'

// ─── API response shape for dashboard ─────────────────────────

export interface CompanyContext {
  user: DBUser
  company: DBCompany
  subscription: DBSubscription | null
  plan: Plan
  trialDaysLeft: number | null
}
