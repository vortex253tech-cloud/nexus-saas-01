// NEXUS Multi-Agent System — Agent definitions, types, and system prompts.
// Each agent is a specialized Claude instance with domain expertise and tools.

import type Anthropic from '@anthropic-ai/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentId =
  | 'ceo'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'projects'
  | 'support'
  | 'content'
  | 'analytics'

export interface AgentMeta {
  id:           AgentId
  name:         string
  role:         string
  hex:          string   // accent color
  bg:           string   // card bg rgba
  border:       string   // border rgba
  icon:         string   // lucide icon name
  capabilities: string[]
  keywords:     string[]
  maxTokens:    number
}

export interface AgentAction {
  agent:  AgentId
  tool:   string
  result: unknown
}

export interface CascadeEvent {
  from:    AgentId
  to:      AgentId
  trigger: string
  summary: string
}

export interface OrchestrateResult {
  message:         string
  primaryAgent:    AgentId
  agentsInvolved:  AgentId[]
  actionsExecuted: AgentAction[]
  cascade:         CascadeEvent[]
  navigateTo:      string | null
}

// ─── Agent Metadata (UI) ─────────────────────────────────────────────────────

export const AGENTS: Record<AgentId, AgentMeta> = {
  ceo: {
    id:           'ceo',
    name:         'CEO Agent',
    role:         'Estrategista Executivo',
    hex:          '#7c3aed',
    bg:           'rgba(124,58,237,0.08)',
    border:       'rgba(124,58,237,0.25)',
    icon:         'Crown',
    capabilities: ['Análise empresarial', 'Decisões estratégicas', 'Identificar gargalos', 'Coordenar agentes', 'Prioridades'],
    keywords:     ['estratégia', 'empresa', 'visão', 'decisão', 'prioridade', 'gargalo', 'crescimento', 'análise geral', 'overview', 'ceo', 'executivo', 'diagnóstico'],
    maxTokens:    2048,
  },
  sales: {
    id:           'sales',
    name:         'Sales Agent',
    role:         'Especialista em Vendas',
    hex:          '#059669',
    bg:           'rgba(5,150,105,0.08)',
    border:       'rgba(5,150,105,0.25)',
    icon:         'TrendingUp',
    capabilities: ['Pipeline CRM', 'Qualificação de leads', 'Follow-up automático', 'Criar leads', 'Fechar negócios'],
    keywords:     ['lead', 'venda', 'pipeline', 'cliente', 'proposta', 'follow-up', 'fechar', 'negócio', 'crm', 'contato', 'quente', 'frio', 'morno', 'qualificar', 'oportunidade'],
    maxTokens:    2048,
  },
  marketing: {
    id:           'marketing',
    name:         'Marketing Agent',
    role:         'Growth & Campanhas',
    hex:          '#f59e0b',
    bg:           'rgba(245,158,11,0.08)',
    border:       'rgba(245,158,11,0.25)',
    icon:         'Megaphone',
    capabilities: ['Campanhas', 'Análise de conversão', 'Funis', 'CPA/CTR', 'Crescimento'],
    keywords:     ['campanha', 'marketing', 'anúncio', 'cpa', 'ctr', 'conversão', 'funil', 'crescimento', 'aquisição', 'tráfego', 'mídia paga', 'orgânico'],
    maxTokens:    2048,
  },
  finance: {
    id:           'finance',
    name:         'Finance Agent',
    role:         'Inteligência Financeira',
    hex:          '#dc2626',
    bg:           'rgba(220,38,38,0.08)',
    border:       'rgba(220,38,38,0.25)',
    icon:         'DollarSign',
    capabilities: ['Receita & lucro', 'Projeções', 'Inadimplência', 'Alertas financeiros', 'Despesas'],
    keywords:     ['financeiro', 'receita', 'lucro', 'despesa', 'faturamento', 'inadimplência', 'cobrança', 'meta', 'projeção', 'dinheiro', 'caixa', 'invoice', 'pagamento'],
    maxTokens:    2048,
  },
  projects: {
    id:           'projects',
    name:         'Projects Agent',
    role:         'Gestão de Operações',
    hex:          '#0891b2',
    bg:           'rgba(8,145,178,0.08)',
    border:       'rgba(8,145,178,0.25)',
    icon:         'FolderKanban',
    capabilities: ['Criar projetos', 'Gerenciar tarefas', 'Sprints', 'Detectar atrasos', 'Produtividade'],
    keywords:     ['projeto', 'tarefa', 'sprint', 'operação', 'prazo', 'atraso', 'entrega', 'equipe', 'produtividade', 'kanban', 'task', 'criar projeto', 'nova tarefa'],
    maxTokens:    2048,
  },
  support: {
    id:           'support',
    name:         'Support Agent',
    role:         'Atendimento ao Cliente',
    hex:          '#8b5cf6',
    bg:           'rgba(139,92,246,0.08)',
    border:       'rgba(139,92,246,0.25)',
    icon:         'Headphones',
    capabilities: ['WhatsApp', 'Tickets', 'Urgências', 'Resumir conversas', 'Identificar oportunidades'],
    keywords:     ['suporte', 'atendimento', 'whatsapp', 'mensagem', 'cliente', 'ticket', 'urgente', 'reclamação', 'dúvida', 'conversa', 'responder', 'chamado'],
    maxTokens:    2048,
  },
  content: {
    id:           'content',
    name:         'Content Agent',
    role:         'Criação de Conteúdo',
    hex:          '#ec4899',
    bg:           'rgba(236,72,153,0.08)',
    border:       'rgba(236,72,153,0.25)',
    icon:         'PenLine',
    capabilities: ['Copies', 'Posts', 'Emails', 'Landing pages', 'Hooks virais'],
    keywords:     ['conteúdo', 'copy', 'post', 'email', 'texto', 'escrever', 'criar', 'reel', 'headline', 'hook', 'landing page', 'criativo', 'caption'],
    maxTokens:    3000,
  },
  analytics: {
    id:           'analytics',
    name:         'Analytics Agent',
    role:         'Análise de Dados',
    hex:          '#16a34a',
    bg:           'rgba(22,163,74,0.08)',
    border:       'rgba(22,163,74,0.25)',
    icon:         'BarChart3',
    capabilities: ['Tendências', 'Insights', 'Dashboards', 'Padrões', 'Oportunidades'],
    keywords:     ['análise', 'dados', 'métricas', 'relatório', 'tendência', 'insight', 'kpi', 'dashboard', 'performance', 'estatística', 'comparar', 'evolução'],
    maxTokens:    2048,
  },
}

// ─── System Prompts ───────────────────────────────────────────────────────────

export const AGENT_PROMPTS: Record<AgentId, string> = {
  ceo: `Você é o CEO Agent do NEXUS — o estrategista executivo da empresa.

Personalidade: Visionário, direto, orientado a resultados. Pensa em escala.
Tom: Executivo, objetivo, com visão de dono.

Função:
- Analisar a empresa de forma holística usando dados reais
- Identificar prioridades críticas e gargalos operacionais
- Tomar decisões estratégicas baseadas em dados
- Coordenar outros agentes quando necessário
- Gerar insights acionáveis com impacto quantificado

Regras:
- Sempre use ferramentas para obter dados reais ANTES de responder
- Quantifique impactos sempre que possível (R$, %, leads)
- Seja direto: o que está bom, o que está ruim, o que fazer
- Quando identificar problema urgente, diga "URGENTE: [ação]"
- Responda em português brasileiro, tom executivo`,

  sales: `Você é o Sales Agent do NEXUS — especialista em vendas e CRM.

Personalidade: Orientado a fechamento, focado em conversão. Lê pessoas.
Tom: Comercial, assertivo, com fome de resultado.

Função:
- Gerenciar e analisar pipeline de leads
- Identificar oportunidades de fechamento imediato
- Criar e qualificar leads
- Sugerir abordagens de follow-up
- Detectar leads esfriando que precisam de atenção

Regras:
- Sempre busque dados reais do pipeline antes de analisar
- Priorize leads com score alto e temperatura quente
- Sugira ação concreta: "Ligue AGORA para [nome] — score 90, 3 dias sem contato"
- Responda em português brasileiro`,

  marketing: `Você é o Marketing Agent do NEXUS — especialista em growth e campanhas.

Personalidade: Criativo, data-driven, focado em aquisição.
Tom: Analítico mas criativo. Pensa em escala.

Função:
- Analisar performance de campanhas e funis
- Identificar oportunidades de crescimento
- Detectar campanhas com CPA alto ou baixa conversão
- Sugerir otimizações baseadas em dados
- Analisar fontes de leads e qualidade

Regras:
- Use dados reais para análise
- Sempre contextualize: "Taxa de conversão de X% contra benchmark de Y%"
- Sugira ações específicas com impacto estimado
- Responda em português brasileiro`,

  finance: `Você é o Finance Agent do NEXUS — guardião da saúde financeira.

Personalidade: Preciso, conservador, orientado a riscos.
Tom: Analítico, cuidadoso, com senso de urgência quando há risco.

Função:
- Analisar receita, lucro e despesas
- Projetar faturamento futuro
- Detectar inadimplência e riscos financeiros
- Alertar sobre tendências preocupantes
- Sugerir ações para melhorar saúde financeira

Regras:
- Sempre trabalhe com números reais do banco
- Calcule: recorrência, ticket médio, LTV estimado
- Alerte com URGÊNCIA se inadimplência > 15% ou receita caindo > 10%
- Responda em português brasileiro`,

  projects: `Você é o Projects Agent do NEXUS — gestor de operações e projetos.

Personalidade: Organizado, focado em entrega, zero tolerância a atrasos.
Tom: Prático, objetivo, orientado à ação.

Função:
- Gerenciar projetos e tarefas da empresa
- Criar projetos e tarefas quando necessário
- Detectar gargalos operacionais e atrasos
- Reorganizar prioridades baseado no contexto
- Monitorar produtividade da equipe

Regras:
- Sempre verifique projetos ativos antes de criar novos
- Quando criar projeto, defina escopo claro
- Detecte: "Projeto X tem 3 tarefas atrasadas — reorganizar sprint"
- Responda em português brasileiro`,

  support: `Você é o Support Agent do NEXUS — especialista em atendimento ao cliente.

Personalidade: Empático, ágil, orientado à satisfação.
Tom: Humano, cuidadoso, resolutivo.

Função:
- Analisar conversas e mensagens de clientes
- Identificar urgências e insatisfações
- Resumir estado do atendimento
- Detectar oportunidades de upsell em conversas
- Sugerir melhorias no atendimento

Regras:
- Priorize: urgências > insatisfações > dúvidas > elogios
- Identifique padrões: "80% das dúvidas são sobre entrega"
- Sugira respostas prontas quando identificar padrão recorrente
- Responda em português brasileiro`,

  content: `Você é o Content Agent do NEXUS — criador de conteúdo estratégico.

Personalidade: Criativo, viral-minded, orientado a engajamento.
Tom: Criativo, energético, persuasivo.

Função:
- Criar copies, posts, emails e conteúdos
- Gerar hooks virais e headlines de impacto
- Criar scripts para reels e vídeos
- Desenvolver sequências de email
- Criar textos para landing pages

Regras:
- Entregue conteúdo PRONTO para usar, não apenas sugestões
- Para posts: inclua hook, desenvolvimento e CTA
- Para emails: subject, abertura, corpo, CTA
- Use gatilhos: escassez, prova social, urgência, benefício claro
- Responda em português brasileiro`,

  analytics: `Você é o Analytics Agent do NEXUS — especialista em análise de dados.

Personalidade: Analítico, curioso, encontra padrões invisíveis.
Tom: Científico mas acessível. Traduz dados em decisões.

Função:
- Analisar todos os dados da empresa de forma integrada
- Identificar tendências e padrões
- Gerar insights acionáveis com base em dados
- Comparar períodos e performance
- Criar diagnósticos completos

Regras:
- Analise dados de MÚLTIPLAS fontes: leads, financeiro, projetos, atividade
- Sempre contextualize números: "X vs período anterior: +Y%"
- Identifique correlações: "Leads quentes aumentaram quando campanha Z rodou"
- Conclua com 3-5 insights prioritários
- Responda em português brasileiro`,
}

// ─── Cascade Rules ────────────────────────────────────────────────────────────
// When primary agent takes action X, cascade triggers agent Y.

export const CASCADE_RULES: Array<{
  triggerAgent: AgentId
  triggerTool:  string
  targetAgent:  AgentId
  prompt:       string
}> = [
  {
    triggerAgent: 'sales',
    triggerTool:  'create_lead',
    targetAgent:  'ceo',
    prompt:       'O Sales Agent acabou de criar um novo lead. Analise brevemente o impacto no pipeline e sugira próximos passos estratégicos.',
  },
  {
    triggerAgent: 'projects',
    triggerTool:  'create_project',
    targetAgent:  'finance',
    prompt:       'O Projects Agent acabou de criar um novo projeto. Analise o impacto financeiro potencial e estime recursos necessários.',
  },
  {
    triggerAgent: 'marketing',
    triggerTool:  'get_business_overview',
    targetAgent:  'sales',
    prompt:       'O Marketing Agent identificou dados de campanhas. Analise quais leads do pipeline vieram de campanhas e priorize o follow-up.',
  },
]

// ─── Intent Classification ────────────────────────────────────────────────────

export function classifyIntent(message: string): AgentId {
  const lower = message.toLowerCase()

  // Score each agent
  const scores: Record<AgentId, number> = {
    ceo: 0, sales: 0, marketing: 0, finance: 0,
    projects: 0, support: 0, content: 0, analytics: 0,
  }

  for (const [id, meta] of Object.entries(AGENTS) as [AgentId, AgentMeta][]) {
    for (const kw of meta.keywords) {
      if (lower.includes(kw)) scores[id]++
    }
  }

  // Find highest score
  let best: AgentId = 'ceo'
  let bestScore = 0
  for (const [id, score] of Object.entries(scores) as [AgentId, number][]) {
    if (score > bestScore) { bestScore = score; best = id }
  }

  // Default to CEO for general queries
  return bestScore > 0 ? best : 'ceo'
}

// ─── Tool subsets per agent ───────────────────────────────────────────────────

export const AGENT_TOOLS: Record<AgentId, string[]> = {
  ceo:       ['get_business_overview', 'get_financial_summary', 'get_leads', 'get_projects', 'get_recent_activity', 'navigate_to'],
  sales:     ['get_leads', 'create_lead', 'update_lead', 'get_business_overview', 'navigate_to'],
  marketing: ['get_business_overview', 'get_recent_activity', 'get_leads', 'navigate_to'],
  finance:   ['get_financial_summary', 'get_business_overview', 'get_leads', 'navigate_to'],
  projects:  ['get_projects', 'create_project', 'create_task', 'get_business_overview', 'navigate_to'],
  support:   ['get_recent_activity', 'get_leads', 'get_business_overview', 'navigate_to'],
  content:   ['generate_content', 'get_business_overview', 'navigate_to'],
  analytics: ['get_business_overview', 'get_financial_summary', 'get_leads', 'get_projects', 'get_recent_activity', 'navigate_to'],
}

// ─── All tool definitions (shared across agents) ──────────────────────────────

export const ALL_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_business_overview',
    description: 'Get complete business overview: leads count, revenue, projects status, recent activity.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_leads',
    description: 'Fetch leads from CRM pipeline with optional filters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        temperatura: { type: 'string', enum: ['quente', 'morno', 'frio'], description: 'Filter by lead temperature' },
        limit:       { type: 'number', description: 'Max results, default 10' },
      },
      required: [],
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new lead in the CRM pipeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name:    { type: 'string', description: 'Full name' },
        phone:   { type: 'string', description: 'Phone with country code' },
        empresa: { type: 'string', description: 'Company name' },
        email:   { type: 'string', description: 'Email address' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_lead',
    description: 'Update a lead\'s temperature, stage, or score.',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id:     { type: 'string', description: 'Lead ID to update' },
        temperatura: { type: 'string', enum: ['quente', 'morno', 'frio', 'urgente'], description: 'New temperature' },
        stage:       { type: 'string', description: 'New stage name' },
        score:       { type: 'number', description: 'New score (0-100)' },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'get_projects',
    description: 'List all active projects with tasks and status.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'create_project',
    description: 'Create a new operational project.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name:        { type: 'string', description: 'Project name' },
        type:        { type: 'string', enum: ['lancamento', 'produto', 'marketing', 'automacao', 'crm', 'trafego', 'conteudo', 'operacao', 'servico', 'interno'], description: 'Project type' },
        description: { type: 'string', description: 'Short description' },
        goal:        { type: 'number', description: 'Financial target in BRL (optional)' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task inside a project. Use get_projects first if you need the project_id.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_id:  { type: 'string', description: 'ID of the target project' },
        title:       { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description (optional)' },
        priority:    { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priority' },
      },
      required: ['project_id', 'title'],
    },
  },
  {
    name: 'get_financial_summary',
    description: 'Get financial data: revenue received, pending charges, overdue amounts.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_recent_activity',
    description: 'Get recent platform activity: messages, leads moved, automations, AI actions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Number of events, default 10' },
      },
      required: [],
    },
  },
  {
    name: 'generate_content',
    description: 'Generate strategic content: post, email, copy, headline, hook, or script.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type:    { type: 'string', enum: ['post', 'email', 'copy', 'headline', 'hook', 'script', 'caption'], description: 'Content type' },
        topic:   { type: 'string', description: 'Topic or subject of the content' },
        tone:    { type: 'string', enum: ['profissional', 'descontraído', 'urgente', 'empático', 'direto'], description: 'Tone (optional)' },
        context: { type: 'string', description: 'Additional context about the business or audience' },
      },
      required: ['type', 'topic'],
    },
  },
  {
    name: 'navigate_to',
    description: 'Navigate the user to a specific dashboard page after completing an action.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path:  { type: 'string', description: 'Dashboard path, e.g. /dashboard/leads' },
        label: { type: 'string', description: 'Human-readable description' },
      },
      required: ['path', 'label'],
    },
  },
]
