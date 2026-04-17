// ─── Lead stored in Supabase ──────────────────────────────────

export interface OnboardingLead {
  id: string
  nome: string | null
  email: string | null
  perfil: string | null
  respostas: LeadRespostas
  fonte: string
  created_at: string
  updated_at: string
}

// Flexible answers object — accumulated as the wizard progresses
export interface LeadRespostas {
  // Step 1 — Identity
  nomeEmpresa?: string
  // Step 2 — Business
  setor?: string
  // Step 3 — Goal
  metaMensal?: number
  // Step 4 — Pain
  principalDesafio?: string
  // Extras from URL params (pre-filled, not re-asked)
  revenueRange?: string
  teamSize?: string
  stage?: string
  [key: string]: unknown
}

// ─── URL params accepted by /start ───────────────────────────

export interface StartParams {
  nome?: string
  email?: string
  perfil?: string   // ecommerce | servicos | tech | consultoria | varejo | outro
  fonte?: string    // lovable | typeform | direct | ...
  meta?: string     // monthly revenue goal (number as string)
  stage?: string
  empresa?: string
  setor?: string
  [key: string]: string | undefined
}

// ─── Perfil definitions ───────────────────────────────────────

export type Perfil = 'ecommerce' | 'servicos' | 'tech' | 'consultoria' | 'varejo' | 'outro'

export const PERFIL_CONFIG: Record<
  Perfil,
  {
    label: string
    emoji: string
    setorDefault: string
    desafios: { value: string; label: string }[]
    metaSugerida: number
  }
> = {
  ecommerce: {
    label: 'E-commerce',
    emoji: '🛒',
    setorDefault: 'E-commerce',
    desafios: [
      { value: 'custo_aquisicao', label: 'Custo de aquisição de clientes' },
      { value: 'margem_produto', label: 'Margem por produto' },
      { value: 'estoque', label: 'Gestão de estoque e capital' },
      { value: 'frete', label: 'Frete e logística' },
    ],
    metaSugerida: 50_000,
  },
  servicos: {
    label: 'Serviços',
    emoji: '🤝',
    setorDefault: 'Serviços',
    desafios: [
      { value: 'recorrencia', label: 'Receita recorrente vs projeto' },
      { value: 'ticket', label: 'Aumentar ticket médio' },
      { value: 'capacidade', label: 'Capacidade do time' },
      { value: 'inadimplencia', label: 'Inadimplência' },
    ],
    metaSugerida: 30_000,
  },
  tech: {
    label: 'Tech / SaaS',
    emoji: '⚡',
    setorDefault: 'Tecnologia',
    desafios: [
      { value: 'churn', label: 'Reduzir churn' },
      { value: 'mrr', label: 'Crescer MRR' },
      { value: 'cac', label: 'CAC vs LTV' },
      { value: 'burn', label: 'Controle de burn rate' },
    ],
    metaSugerida: 100_000,
  },
  consultoria: {
    label: 'Consultoria',
    emoji: '📊',
    setorDefault: 'Consultoria',
    desafios: [
      { value: 'pipeline', label: 'Pipeline de novos clientes' },
      { value: 'proposta', label: 'Taxa de conversão de propostas' },
      { value: 'hora', label: 'Rentabilidade por hora' },
      { value: 'retencao', label: 'Retenção de clientes' },
    ],
    metaSugerida: 50_000,
  },
  varejo: {
    label: 'Varejo',
    emoji: '🏪',
    setorDefault: 'Varejo',
    desafios: [
      { value: 'margem', label: 'Margem de lucro' },
      { value: 'estoque', label: 'Giro de estoque' },
      { value: 'sazonalidade', label: 'Sazonalidade' },
      { value: 'ticket', label: 'Ticket médio' },
    ],
    metaSugerida: 80_000,
  },
  outro: {
    label: 'Outro',
    emoji: '🏢',
    setorDefault: '',
    desafios: [
      { value: 'fluxo', label: 'Fluxo de caixa' },
      { value: 'custos', label: 'Controle de custos' },
      { value: 'crescimento', label: 'Crescimento de receita' },
      { value: 'visibilidade', label: 'Visibilidade financeira' },
    ],
    metaSugerida: 50_000,
  },
}

export const REVENUE_OPTIONS = [
  { label: 'R$ 10 mil/mês', value: 10_000 },
  { label: 'R$ 30 mil/mês', value: 30_000 },
  { label: 'R$ 50 mil/mês', value: 50_000 },
  { label: 'R$ 100 mil/mês', value: 100_000 },
  { label: 'R$ 300 mil/mês', value: 300_000 },
  { label: 'R$ 500 mil/mês', value: 500_000 },
  { label: 'R$ 1M+/mês', value: 1_000_000 },
]

export const SETORES = [
  'E-commerce', 'Serviços', 'Tecnologia', 'Saúde', 'Educação',
  'Alimentação', 'Varejo', 'Consultoria', 'Imobiliário',
  'Agência', 'Indústria', 'Outro',
]
