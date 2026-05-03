// ─── Product Tour — step definitions ──────────────────────────────────────

export interface TourStep {
  id: string
  title: string
  description: string
  selector: string   // CSS selector matching data-tour attribute
  page: string       // route that must be active for this step
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  canSkip: boolean
  cta?: string       // label for the primary action button (defaults to "Próximo")
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao NEXUS',
    description:
      'Este é o seu painel central. Aqui você vê um resumo completo do seu negócio em tempo real — receita, alertas, e ações de maior impacto.',
    selector: '[data-tour="nav-dashboard"]',
    page: '/dashboard',
    position: 'right',
    canSkip: false,
  },
  {
    id: 'dados',
    title: 'Conecte seus dados',
    description:
      'Importe faturamento, custos e clientes. Sem dados reais a IA não consegue gerar insights personalizados para o seu negócio.',
    selector: '[data-tour="nav-dados"]',
    page: '/dashboard/dados',
    position: 'right',
    canSkip: false,
    cta: 'Ir para Dados',
  },
  {
    id: 'clientes',
    title: 'Visualize seus clientes',
    description:
      'Gerencie toda a sua base de clientes com valor gerado, status e histórico de interações em um só lugar.',
    selector: '[data-tour="nav-clients"]',
    page: '/dashboard/clients',
    position: 'right',
    canSkip: true,
    cta: 'Ver Clientes',
  },
  {
    id: 'growth-map',
    title: 'Mapa de Crescimento',
    description:
      'A IA mapeia onde está o dinheiro escondido no seu negócio e prioriza as oportunidades de maior retorno — ordenadas por impacto.',
    selector: '[data-tour="nav-growth-map"]',
    page: '/dashboard/growth-map',
    position: 'right',
    canSkip: true,
    cta: 'Explorar Mapa',
  },
  {
    id: 'actions',
    title: 'Ações geradas pela IA',
    description:
      'A IA cria ações concretas com impacto estimado, passos detalhados e prazo sugerido. Cada ação é uma alavanca direta de receita.',
    selector: '[data-tour="nav-actions"]',
    page: '/dashboard/actions',
    position: 'right',
    canSkip: false,
    cta: 'Ver Ações',
  },
  {
    id: 'actions-execute',
    title: 'Execute e acompanhe',
    description:
      'Marque ações como concluídas e veja o ganho realizado acumulando no seu painel. Cada execução atualiza sua projeção de crescimento.',
    selector: '[data-tour="actions-first-card"]',
    page: '/dashboard/actions',
    position: 'bottom',
    canSkip: true,
  },
  {
    id: 'revenue',
    title: 'Seu primeiro resultado',
    description:
      'Este é o número que importa — receita incremental gerada pelas ações do NEXUS. Acompanhe o crescimento semana a semana.',
    selector: '[data-tour="nav-revenue"]',
    page: '/dashboard/revenue',
    position: 'right',
    canSkip: true,
    cta: 'Ver Receita',
  },
]

export const TOTAL_STEPS = TOUR_STEPS.length
