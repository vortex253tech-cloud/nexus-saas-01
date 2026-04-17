// ─── Diagnóstico mock ─────────────────────────────────────────
// Gera um diagnóstico personalizado baseado nas respostas do wizard.
// Lógica fake/determinística por perfil — será substituída por IA real.

import type { Perfil } from './types'

export interface Problema {
  id: string
  titulo: string
  descricao: string
  impacto: 'alto' | 'medio' | 'baixo'
  categoria: string
  perdaEstimada: number // R$/mês
}

export interface Oportunidade {
  id: string
  titulo: string
  descricao: string
  ganhoEstimado: number // R$/mês
  prazo: string
  dificuldade: 'facil' | 'medio' | 'complexo'
}

export interface Diagnostico {
  score: number              // 0–100 (saúde financeira)
  problemas: Problema[]
  oportunidades: Oportunidade[]
  perdaTotalEstimada: number
  ganhoTotalEstimado: number
  resumo: string
  benchmarkLabel: string
  benchmarkPct: number       // 0–100 (posição vs setor)
}

export interface ResultadoInput {
  perfil: Perfil | null
  nomeEmpresa?: string
  setor?: string
  metaMensal?: number | null
  principalDesafio?: string
  stage?: string
  revenueRange?: string
  teamSize?: string
}

// ─── Banco de problemas por perfil ────────────────────────────

const PROBLEMAS: Record<Perfil, Problema[]> = {
  ecommerce: [
    {
      id: 'cac-alto',
      titulo: 'CAC acima do benchmark',
      descricao: 'Seu custo de aquisição por cliente está estimado 40% acima da média do setor. Cada venda custa mais do que deveria.',
      impacto: 'alto',
      categoria: 'Marketing',
      perdaEstimada: 4200,
    },
    {
      id: 'margem-frete',
      titulo: 'Frete corroendo margem',
      descricao: 'Operações de e-commerce com frete não otimizado perdem entre 8-15% da margem bruta. Seu perfil de pedido sugere que isso está acontecendo.',
      impacto: 'alto',
      categoria: 'Logística',
      perdaEstimada: 3100,
    },
    {
      id: 'abandono-carrinho',
      titulo: 'Alta taxa de abandono de carrinho',
      descricao: 'Sem recuperação automatizada, você está deixando 67% dos carrinhos abandonados sem followup — dinheiro que já estava quase na sua conta.',
      impacto: 'medio',
      categoria: 'Conversão',
      perdaEstimada: 2400,
    },
  ],
  servicos: [
    {
      id: 'precificacao',
      titulo: 'Precificação abaixo do valor entregue',
      descricao: 'Empresas de serviço frequentemente cobram por hora em vez de por resultado. Isso limita seu faturamento ao número de horas disponíveis.',
      impacto: 'alto',
      categoria: 'Precificação',
      perdaEstimada: 5800,
    },
    {
      id: 'churn-cliente',
      titulo: 'Churn silencioso de clientes',
      descricao: 'Sem processo de retenção ativo, a maioria das empresas de serviço perde 20-30% da base por ano sem perceber — e gasta mais adquirindo novos.',
      impacto: 'alto',
      categoria: 'Retenção',
      perdaEstimada: 3900,
    },
    {
      id: 'escala-limitada',
      titulo: 'Gargalo de capacidade operacional',
      descricao: 'Seu modelo atual depende diretamente do tempo da equipe. Sem processos e ferramentas de alavancagem, o crescimento tem teto baixo.',
      impacto: 'medio',
      categoria: 'Operações',
      perdaEstimada: 2100,
    },
  ],
  tech: [
    {
      id: 'churn-mrr',
      titulo: 'Churn impactando MRR',
      descricao: 'Um churn de 5% ao mês significa que você perde metade da base em 14 meses. Pequenas melhorias no onboarding e suporte revertem isso rapidamente.',
      impacto: 'alto',
      categoria: 'Retenção',
      perdaEstimada: 6200,
    },
    {
      id: 'cac-ltv',
      titulo: 'Relação CAC/LTV desequilibrada',
      descricao: 'O LTV médio de clientes SaaS deve ser pelo menos 3x o CAC. Abaixo disso, cada cliente novo queima mais caixa do que gera.',
      impacto: 'alto',
      categoria: 'Unit Economics',
      perdaEstimada: 4800,
    },
    {
      id: 'expansao-receita',
      titulo: 'Receita de expansão inexplorada',
      descricao: 'Upsell e cross-sell para base existente custa 5x menos que aquisição. Sem uma motion de expansão ativa, você está deixando MRR na mesa.',
      impacto: 'medio',
      categoria: 'Crescimento',
      perdaEstimada: 3300,
    },
  ],
  consultoria: [
    {
      id: 'pipeline-fraco',
      titulo: 'Pipeline de novos clientes inconsistente',
      descricao: 'Dependência de indicações sem processo ativo de geração de demanda cria meses de alta e baixa — o "feast or famine" que drena o caixa.',
      impacto: 'alto',
      categoria: 'Vendas',
      perdaEstimada: 5100,
    },
    {
      id: 'proposta-conversao',
      titulo: 'Taxa de conversão de propostas baixa',
      descricao: 'Consultoras com proposta padronizada convertem 15-20%. Com metodologia de diagnóstico e proposta customizada, essa taxa sobe para 40-60%.',
      impacto: 'alto',
      categoria: 'Vendas',
      perdaEstimada: 4400,
    },
    {
      id: 'hora-nao-faturada',
      titulo: 'Horas não faturadas acima de 30%',
      descricao: 'Reuniões internas, retrabalho e escopo mal definido consomem horas que poderiam estar gerando receita. Isso é dinheiro invisível perdido toda semana.',
      impacto: 'medio',
      categoria: 'Eficiência',
      perdaEstimada: 2700,
    },
  ],
  varejo: [
    {
      id: 'margem-produto',
      titulo: 'Margem por produto não calculada',
      descricao: 'Sem análise de margem por SKU, você pode estar mantendo produtos que vendem bem mas destroem seu lucro líquido.',
      impacto: 'alto',
      categoria: 'Precificação',
      perdaEstimada: 4600,
    },
    {
      id: 'estoque-parado',
      titulo: 'Capital imobilizado em estoque',
      descricao: 'Estoque com giro baixo representa dinheiro parado. Cada R$ 10k em produto sem giro equivale a um custo de oportunidade de R$ 800-1.200/mês.',
      impacto: 'alto',
      categoria: 'Estoque',
      perdaEstimada: 3800,
    },
    {
      id: 'ticket-medio',
      titulo: 'Ticket médio abaixo do potencial',
      descricao: 'Sem estratégia ativa de upsell no ponto de venda, você converte o cliente mas não maximiza o valor de cada visita.',
      impacto: 'medio',
      categoria: 'Vendas',
      perdaEstimada: 2200,
    },
  ],
  outro: [
    {
      id: 'fluxo-caixa',
      titulo: 'Fluxo de caixa sem previsibilidade',
      descricao: 'Sem projeção de 90 dias, você reage a problemas em vez de preveni-los. Isso leva a decisões caras: empréstimos emergenciais, atrasos de fornecedor.',
      impacto: 'alto',
      categoria: 'Financeiro',
      perdaEstimada: 3500,
    },
    {
      id: 'custos-fixos',
      titulo: 'Custos fixos não revisados',
      descricao: 'Empresas que não revisam custos fixos anualmente acumulam gastos fantasma: assinaturas esquecidas, contratos auto-renovados, estrutura superdimensionada.',
      impacto: 'medio',
      categoria: 'Custos',
      perdaEstimada: 2800,
    },
    {
      id: 'precificacao-custo',
      titulo: 'Precificação baseada em feeling',
      descricao: 'Sem cálculo estruturado de custos + margem + posicionamento, você provavelmente está cobrando menos do que poderia — ou com margem negativa.',
      impacto: 'alto',
      categoria: 'Precificação',
      perdaEstimada: 4100,
    },
  ],
}

const OPORTUNIDADES: Record<Perfil, Oportunidade[]> = {
  ecommerce: [
    {
      id: 'recuperacao-abandono',
      titulo: 'Automação de carrinho abandonado',
      descricao: 'Sequência de 3 e-mails/SMS recupera em média 15% dos carrinhos. Com seu volume estimado, isso representa receita nova sem custo de aquisição.',
      ganhoEstimado: 3800,
      prazo: '2 semanas',
      dificuldade: 'facil',
    },
    {
      id: 'recompra',
      titulo: 'Programa de recompra automatizado',
      descricao: 'Clientes que compram 2x têm 60% de chance de comprar uma terceira vez. Um fluxo de reengajamento ativa essa janela.',
      ganhoEstimado: 5200,
      prazo: '1 mês',
      dificuldade: 'medio',
    },
    {
      id: 'frete-negociacao',
      titulo: 'Renegociação de contratos logísticos',
      descricao: 'Com volume consolidado, é possível reduzir custo de frete em 20-35% negociando com transportadoras alternativas.',
      ganhoEstimado: 2900,
      prazo: '3 semanas',
      dificuldade: 'facil',
    },
  ],
  servicos: [
    {
      id: 'retainer',
      titulo: 'Migração para modelo retainer',
      descricao: 'Transformar projetos pontuais em contratos mensais garante previsibilidade. Clientes em retainer pagam mais e ficam mais tempo.',
      ganhoEstimado: 6100,
      prazo: '6 semanas',
      dificuldade: 'medio',
    },
    {
      id: 'upsell-base',
      titulo: 'Upsell de serviços adicionais',
      descricao: 'Clientes atuais têm custo de venda 5x menor. Mapear quais serviços complementares sua base precisa é a ação de maior ROI imediato.',
      ganhoEstimado: 4200,
      prazo: '2 semanas',
      dificuldade: 'facil',
    },
    {
      id: 'pacotes',
      titulo: 'Criação de pacotes com âncora de preço',
      descricao: 'Ter 3 opções de pacote (básico, premium, VIP) aumenta o ticket médio em 30-40% — clientes migram naturalmente para o meio.',
      ganhoEstimado: 3700,
      prazo: '1 mês',
      dificuldade: 'facil',
    },
  ],
  tech: [
    {
      id: 'onboarding-ativacao',
      titulo: 'Onboarding de ativação redesenhado',
      descricao: 'Reduzir o time-to-value diminui churn precoce em até 40%. O primeiro sucesso do usuário precisa acontecer nos primeiros 7 dias.',
      ganhoEstimado: 7400,
      prazo: '1 mês',
      dificuldade: 'medio',
    },
    {
      id: 'expansao-planos',
      titulo: 'Trilha de expansão de plano',
      descricao: 'Usuários que atingem 80% do limite de uso do plano raramente fazem upgrade sozinhos. Uma notificação proativa converte 25-35% desses usuários.',
      ganhoEstimado: 5100,
      prazo: '2 semanas',
      dificuldade: 'facil',
    },
    {
      id: 'annual-plan',
      titulo: 'Incentivo para plano anual',
      descricao: 'Oferecer 2 meses grátis no anual reduz churn em 60% e melhora seu fluxo de caixa imediatamente.',
      ganhoEstimado: 4300,
      prazo: '3 semanas',
      dificuldade: 'facil',
    },
  ],
  consultoria: [
    {
      id: 'lead-magnet',
      titulo: 'Conteúdo diagnóstico como lead magnet',
      descricao: 'Um diagnóstico gratuito que demonstra sua metodologia gera leads 3x mais qualificados do que tráfego frio — e já começa a construir confiança.',
      ganhoEstimado: 5800,
      prazo: '3 semanas',
      dificuldade: 'medio',
    },
    {
      id: 'proposta-roi',
      titulo: 'Proposta com ROI calculado',
      descricao: 'Mudar o enquadramento da proposta de "custo do projeto" para "retorno esperado" aumenta taxa de fechamento em 30-50%.',
      ganhoEstimado: 4600,
      prazo: '1 semana',
      dificuldade: 'facil',
    },
    {
      id: 'advisory',
      titulo: 'Serviço de advisory recorrente',
      descricao: 'Após entregar um projeto, oferecer mentoria mensal de baixo esforço captura valor recorrente sem custo de aquisição.',
      ganhoEstimado: 3900,
      prazo: '2 semanas',
      dificuldade: 'facil',
    },
  ],
  varejo: [
    {
      id: 'curva-abc',
      titulo: 'Gestão ativa por curva ABC',
      descricao: 'Concentrar estoque e esforço de venda nos 20% de produtos que geram 80% da receita reduz custos e aumenta giro.',
      ganhoEstimado: 4100,
      prazo: '2 semanas',
      dificuldade: 'facil',
    },
    {
      id: 'combo-crossell',
      titulo: 'Combos e cross-sell no PDV',
      descricao: 'Oferecer produto complementar no momento da compra aumenta ticket médio em 15-25% sem esforço adicional de vendas.',
      ganhoEstimado: 3200,
      prazo: '1 semana',
      dificuldade: 'facil',
    },
    {
      id: 'fidelidade',
      titulo: 'Programa de fidelidade com recompra',
      descricao: 'Clientes fidelizados gastam 67% mais. Um programa simples de pontos ou cashback aumenta frequência de visita em 30%.',
      ganhoEstimado: 4800,
      prazo: '1 mês',
      dificuldade: 'medio',
    },
  ],
  outro: [
    {
      id: 'revisao-custos',
      titulo: 'Auditoria de custos recorrentes',
      descricao: 'Revisar todas as assinaturas, contratos e despesas fixas frequentemente revela 10-15% de economia imediata sem impacto operacional.',
      ganhoEstimado: 2600,
      prazo: '1 semana',
      dificuldade: 'facil',
    },
    {
      id: 'precificacao-estruturada',
      titulo: 'Modelo de precificação estruturado',
      descricao: 'Calcular preço por custo real + margem alvo + posicionamento de mercado tipicamente permite um reajuste de 10-20% com baixa perda de clientes.',
      ganhoEstimado: 4300,
      prazo: '2 semanas',
      dificuldade: 'medio',
    },
    {
      id: 'projecao-caixa',
      titulo: 'Projeção de fluxo de caixa 90 dias',
      descricao: 'Com visibilidade antecipada, você negocia melhor com fornecedores, evita empréstimos caros e aproveita oportunidades de compra.',
      ganhoEstimado: 3100,
      prazo: '1 semana',
      dificuldade: 'facil',
    },
  ],
}

// ─── Score heuristic ──────────────────────────────────────────

function calcScore(input: ResultadoInput): number {
  let score = 62 // base
  if (input.stage === 'scaling') score += 12
  if (input.stage === 'growing') score += 6
  if (input.stage === 'starting') score -= 8
  if (input.revenueRange === '200k+') score += 10
  if (input.revenueRange === '50k-200k') score += 5
  if (input.revenueRange === '0-10k') score -= 10
  if (input.teamSize === 'medium' || input.teamSize === 'large') score += 5
  return Math.max(18, Math.min(78, score)) // cap: nunca perfeito (vende urgência)
}

// ─── Main export ─────────────────────────────────────────────

export function gerarDiagnostico(input: ResultadoInput): Diagnostico {
  const perfil: Perfil = (input.perfil as Perfil) ?? 'outro'

  const problemas = PROBLEMAS[perfil] ?? PROBLEMAS.outro
  const oportunidades = OPORTUNIDADES[perfil] ?? OPORTUNIDADES.outro

  const perdaTotal = problemas.reduce((s, p) => s + p.perdaEstimada, 0)
  const ganhoTotal = oportunidades.reduce((s, o) => s + o.ganhoEstimado, 0)
  const score = calcScore(input)

  const RESUMOS: Record<Perfil, string> = {
    ecommerce: 'Seu e-commerce tem estrutura para crescer, mas está vazando margem em aquisição e logística. Com os ajustes certos, é possível aumentar o lucro líquido sem aumentar o faturamento bruto.',
    servicos: 'Sua empresa de serviços entrega valor, mas o modelo de precificação e a falta de receita recorrente limitam o crescimento. Pequenas mudanças de estrutura têm impacto imediato no caixa.',
    tech: 'Seu produto tem potencial, mas unit economics desequilibrados podem transformar crescimento em queima de caixa. Reter e expandir a base atual é o caminho mais rápido para MRR saudável.',
    consultoria: 'Sua consultoria tem expertise, mas pipeline inconsistente e proposta mal posicionada deixam receita na mesa toda semana. A mudança mais urgente é criar demanda previsível.',
    varejo: 'Seu varejo tem clientes, mas margem e giro de estoque não estão otimizados. As oportunidades de maior impacto são simples de implementar e não exigem investimento.',
    outro: 'Sua empresa tem operação rodando, mas falta visibilidade financeira para tomar decisões com segurança. Com clareza de números, as melhorias de lucro aparecem rápido.',
  }

  const BENCHMARKS: Record<Perfil, string> = {
    ecommerce: 'E-commerces no mesmo estágio',
    servicos: 'Empresas de serviço do mesmo porte',
    tech: 'SaaS B2B em early growth',
    consultoria: 'Consultorias de pequeno-médio porte',
    varejo: 'Varejos do mesmo segmento',
    outro: 'PMEs do mesmo porte',
  }

  return {
    score,
    problemas,
    oportunidades,
    perdaTotalEstimada: perdaTotal,
    ganhoTotalEstimado: ganhoTotal,
    resumo: RESUMOS[perfil],
    benchmarkLabel: BENCHMARKS[perfil],
    benchmarkPct: score - 8, // ligeiramente abaixo do score (posição relativa)
  }
}
