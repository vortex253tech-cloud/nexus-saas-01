// ─── 30-day financial projection engine ─────────────────────────

export interface Projection {
  ganhoEstimado30d: number
  ganhoEstimado12m: number
  desperdicioReduzido: number   // % reduction
  actionsRestantes: number
  topWin: { titulo: string; valor: number } | null
  velocidade: 'alta' | 'media' | 'baixa'  // execution speed based on effort mix
}

interface PendingAction {
  impacto_estimado: number
  titulo: string
  effort_level?: string
  prioridade?: string
}

function effortCompletionRate(effort?: string): number {
  if (effort === 'low')  return 0.85
  if (effort === 'high') return 0.35
  return 0.55
}

export function calcularProjection(params: {
  pendingActions: PendingAction[]
  ganhoJaRecuperado: number
  revenueAtual?: number
}): Projection {
  const { pendingActions, ganhoJaRecuperado, revenueAtual = 0 } = params

  // Ganho estimado em 30 dias = Σ(impacto * taxa de conclusão)
  const ganhoEstimado30d = pendingActions.reduce((sum, a) => {
    return sum + (a.impacto_estimado * effortCompletionRate(a.effort_level))
  }, 0)

  // Anual = (mensal recuperado + mensal estimado) × 12
  const ganhoEstimado12m = (ganhoEstimado30d + ganhoJaRecuperado) * 12

  // Desperdício reduzido: proporcional ao ganho vs receita (ou estimado)
  const base = revenueAtual > 0 ? revenueAtual : Math.max(ganhoEstimado30d * 8, 10000)
  const desperdicioReduzido = Math.min(40, Math.max(5, Math.round((ganhoEstimado30d / base) * 100)))

  // Top win
  const sorted = [...pendingActions].sort((a, b) => b.impacto_estimado - a.impacto_estimado)
  const topWin = sorted[0] ? { titulo: sorted[0].titulo, valor: sorted[0].impacto_estimado } : null

  // Velocidade: mix of low-effort actions
  const lowCount = pendingActions.filter(a => a.effort_level === 'low').length
  const ratio = pendingActions.length > 0 ? lowCount / pendingActions.length : 0
  const velocidade: Projection['velocidade'] = ratio >= 0.5 ? 'alta' : ratio >= 0.25 ? 'media' : 'baixa'

  return {
    ganhoEstimado30d: Math.round(ganhoEstimado30d),
    ganhoEstimado12m: Math.round(ganhoEstimado12m),
    desperdicioReduzido,
    actionsRestantes: pendingActions.length,
    topWin,
    velocidade,
  }
}

// ─── Score progression ──────────────────────────────────────────

export function calcularScoreAfter(scoreBefore: number, pendingActions: PendingAction[]): number {
  if (!pendingActions.length) return scoreBefore
  const boost = pendingActions.reduce((sum, a) => {
    const base = a.prioridade === 'critica' ? 5 : a.prioridade === 'alta' ? 3 : 1.5
    return sum + base
  }, 0)
  return Math.min(100, Math.round(scoreBefore + boost * 0.6))
}

// ─── Social proof by perfil ─────────────────────────────────────

interface SocialProofData {
  empresaTipo: string
  ganho7d: number
  ganho30d: number
  totalEmpresas: number
  depoimento: string
}

const SOCIAL_PROOF_MAP: Record<string, SocialProofData> = {
  escala: {
    empresaTipo: 'empresas em crescimento',
    ganho7d: 8200,
    ganho30d: 24500,
    totalEmpresas: 187,
    depoimento: 'Identificamos R$ 18k de custo oculto que não sabíamos que existia.',
  },
  crise: {
    empresaTipo: 'empresas em recuperação',
    ganho7d: 5800,
    ganho30d: 14200,
    totalEmpresas: 93,
    depoimento: 'Em 2 semanas cortamos R$ 6k de despesas invisíveis.',
  },
  otimizacao: {
    empresaTipo: 'empresas em otimização',
    ganho7d: 6400,
    ganho30d: 19800,
    totalEmpresas: 142,
    depoimento: 'A margem subiu 8 pontos percentuais em 30 dias.',
  },
  precificacao: {
    empresaTipo: 'empresas com ajuste de preço',
    ganho7d: 9100,
    ganho30d: 22300,
    totalEmpresas: 76,
    depoimento: 'Aumentamos o ticket médio 23% sem perder clientes.',
  },
  retencao: {
    empresaTipo: 'empresas focadas em retenção',
    ganho7d: 7300,
    ganho30d: 18600,
    totalEmpresas: 114,
    depoimento: 'Churn caiu de 9% para 4% em um mês.',
  },
  outro: {
    empresaTipo: 'empresas do mesmo setor',
    ganho7d: 6800,
    ganho30d: 17400,
    totalEmpresas: 203,
    depoimento: 'Não sabia que estava deixando tanto dinheiro na mesa.',
  },
}

export function getSocialProof(perfil: string): SocialProofData {
  return SOCIAL_PROOF_MAP[perfil] ?? SOCIAL_PROOF_MAP.outro
}
