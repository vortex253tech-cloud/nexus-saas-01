// Shared Realtime API config — no 'use client' so it's importable by both
// server routes (session/route.ts) and client code (nexus-realtime-client.ts).

export const REALTIME_MODEL = 'gpt-4o-realtime-preview'

export const NEXUS_SYSTEM_PROMPT = `Você é o NEXUS — Sistema Operacional de IA da empresa. COO executivo de alto nível.
Você é o cérebro operacional central. Fala português, age como um COO + CEO de IA de elite.

IDENTIDADE:
- Nome: NEXUS
- Papel: Sistema Operacional Central — opera o negócio inteiro por comando de voz
- Tom: direto, confiante, executivo, assertivo, nunca vago, nunca verbose
- Personalidade: inteligente, proativo, decisivo — o sistema que "faz acontecer"
- Limite de resposta: máximo 2-3 frases. Seja cirúrgico.

OPERAÇÕES DISPONÍVEIS (use as tools sem hesitar):
WhatsApp & Atendimento:
  getWhatsAppStats       → métricas gerais de atendimento
  getUnreadMessages      → mensagens não lidas pendentes
  getHotLeads            → leads mais ativos e quentes
  sendWhatsAppMessage    → enviar mensagem a um contato (CONFIRME antes de enviar)
  searchConversations    → buscar conversa por nome ou número
  getConversationHistory → histórico de mensagens
  toggleAI               → ligar/desligar IA em conversa
  transferToHuman        → transferir para humano
  markConversationRead   → marcar como lida

CRM & Pipeline:
  getPipelineLeads       → leads e distribuição por estágio
  updateLeadStage        → mover lead de estágio
  createFollowUp         → agendar follow-up

Financeiro:
  getFinancialSummary    → faturamento, despesas, resultado
  getDashboardSummary    → visão executiva completa
  getSystemStatus        → saúde do sistema

Operações avançadas:
  analyzeCompany         → análise executiva completa da empresa
  orchestrateAgent       → aciona agente IA especializado (Marketing, Growth, Financeiro)
  getAutomations         → lista automações ativas
  triggerAutomation      → dispara uma automação
  createTask             → cria tarefa ou projeto
  createAutomation       → cria nova automação no sistema
  scheduleMeeting        → agenda reunião ou compromisso
  generateProposal       → gera proposta comercial para cliente/lead

Navegação:
  navigate               → abre módulo do dashboard
    Rotas: /dashboard/whatsapp, /dashboard/leads, /dashboard/revenue,
           /dashboard/financeiro, /dashboard/nexus, /dashboard/automations,
           /dashboard/pipeline, /dashboard/settings, /dashboard/agents,
           /dashboard/growth-map, /dashboard/projects

PROTOCOLO:
1. NUNCA invente dados — use tools
2. Confirme ANTES de enviar mensagem (ação irreversível)
3. 2-3 frases máx. Executivo, não verbose.
4. Após executar: resultado + próxima ação estratégica
5. Detecte intenção: "leads" → getHotLeads; "financeiro" → getFinancialSummary
6. Comando complexo → quebre em etapas, execute sequencialmente
7. Quando estiver em CEO MODE, monitore proativamente e sugira ações`

export const NEXUS_TOOLS = [
  { type: 'function', name: 'navigate',
    description: 'Navega para uma página do dashboard NEXUS',
    parameters: { type: 'object', properties: {
      path:      { type: 'string', description: 'Ex: /dashboard/whatsapp' },
      page_name: { type: 'string', description: 'Nome amigável' },
    }, required: ['path'] },
  },
  { type: 'function', name: 'getWhatsAppStats',
    description: 'Estatísticas do WhatsApp: total conversas, ativas, IA ativa, não lidas',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'getUnreadMessages',
    description: 'Conversas com mensagens não lidas pendentes',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'getHotLeads',
    description: 'Leads mais quentes e ativos, ordenados por atividade recente',
    parameters: { type: 'object', properties: {
      limit: { type: 'number', description: 'Quantidade (padrão 5, máx 10)' },
    }},
  },
  { type: 'function', name: 'sendWhatsAppMessage',
    description: 'Envia mensagem WhatsApp — CONFIRME antes',
    parameters: { type: 'object', properties: {
      phone:           { type: 'string', description: 'Número com DDI, só dígitos' },
      message:         { type: 'string', description: 'Conteúdo da mensagem' },
      conversation_id: { type: 'string', description: 'ID da conversa (opcional)' },
    }, required: ['phone', 'message'] },
  },
  { type: 'function', name: 'searchConversations',
    description: 'Busca conversas por nome ou número',
    parameters: { type: 'object', properties: {
      query: { type: 'string', description: 'Nome ou número' },
    }, required: ['query'] },
  },
  { type: 'function', name: 'getConversationHistory',
    description: 'Histórico de mensagens de uma conversa',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
      limit:           { type: 'number', description: 'Nº de mensagens (padrão 10)' },
    }, required: ['conversation_id'] },
  },
  { type: 'function', name: 'toggleAI',
    description: 'Ativa ou desativa IA em conversa WhatsApp',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
      enabled:         { type: 'boolean' },
    }, required: ['conversation_id', 'enabled'] },
  },
  { type: 'function', name: 'transferToHuman',
    description: 'Transfere conversa para atendimento humano',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
      note:            { type: 'string', description: 'Nota de transferência (opcional)' },
    }, required: ['conversation_id'] },
  },
  { type: 'function', name: 'markConversationRead',
    description: 'Marca conversa como lida',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
    }, required: ['conversation_id'] },
  },
  { type: 'function', name: 'getPipelineLeads',
    description: 'Leads e distribuição por estágio do pipeline',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'updateLeadStage',
    description: 'Move lead para outro estágio do pipeline',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
      stage:           { type: 'string', description: 'Ex: proposta, negociação, fechado' },
    }, required: ['conversation_id', 'stage'] },
  },
  { type: 'function', name: 'createFollowUp',
    description: 'Cria follow-up com um cliente',
    parameters: { type: 'object', properties: {
      phone:        { type: 'string' },
      contact_name: { type: 'string' },
      message:      { type: 'string' },
      scheduled_at: { type: 'string', description: 'ISO 8601' },
    }, required: ['phone', 'message', 'scheduled_at'] },
  },
  { type: 'function', name: 'getFinancialSummary',
    description: 'Faturamento, despesas e resultado do mês',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'getDashboardSummary',
    description: 'Visão executiva: conversas, leads, financeiro',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'getSystemStatus',
    description: 'Saúde operacional do sistema',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'analyzeCompany',
    description: 'Análise executiva completa da empresa: saúde, oportunidades, alertas, próximas ações',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'orchestrateAgent',
    description: 'Aciona agente IA especializado para uma tarefa específica',
    parameters: { type: 'object', properties: {
      agent: { type: 'string', description: 'Agente: marketing, growth, financeiro, projetos, suporte, operacoes' },
      task:  { type: 'string', description: 'O que o agente deve fazer' },
    }, required: ['agent', 'task'] },
  },
  { type: 'function', name: 'getAutomations',
    description: 'Lista automações ativas e em execução',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'triggerAutomation',
    description: 'Dispara uma automação específica',
    parameters: { type: 'object', properties: {
      automation_id:   { type: 'string', description: 'ID da automação' },
      automation_name: { type: 'string', description: 'Nome amigável' },
    }, required: ['automation_id'] },
  },
  { type: 'function', name: 'createTask',
    description: 'Cria uma tarefa ou nota operacional',
    parameters: { type: 'object', properties: {
      title:       { type: 'string', description: 'Título da tarefa' },
      description: { type: 'string', description: 'Descrição detalhada' },
      priority:    { type: 'string', description: 'low, medium, high, critical' },
      due_date:    { type: 'string', description: 'Data limite ISO 8601 (opcional)' },
    }, required: ['title'] },
  },
  { type: 'function', name: 'createAutomation',
    description: 'Cria uma nova automação no sistema',
    parameters: { type: 'object', properties: {
      name:        { type: 'string', description: 'Nome da automação' },
      trigger:     { type: 'string', description: 'Evento disparador: nova_mensagem, novo_lead, agendamento, webhook' },
      actions:     { type: 'string', description: 'Descrição das ações em texto natural' },
      description: { type: 'string', description: 'Descrição opcional da automação' },
    }, required: ['name', 'trigger', 'actions'] },
  },
  { type: 'function', name: 'scheduleMeeting',
    description: 'Agenda uma reunião ou compromisso',
    parameters: { type: 'object', properties: {
      title:        { type: 'string', description: 'Título/assunto da reunião' },
      contact_name: { type: 'string', description: 'Nome do participante ou cliente' },
      phone:        { type: 'string', description: 'Telefone do contato (opcional)' },
      scheduled_at: { type: 'string', description: 'Data e hora ISO 8601' },
      duration_min: { type: 'number', description: 'Duração em minutos (padrão 60)' },
      notes:        { type: 'string', description: 'Notas adicionais (opcional)' },
    }, required: ['title', 'scheduled_at'] },
  },
  { type: 'function', name: 'generateProposal',
    description: 'Gera uma proposta comercial para um lead ou cliente',
    parameters: { type: 'object', properties: {
      contact_name:    { type: 'string', description: 'Nome do cliente/lead' },
      conversation_id: { type: 'string', description: 'ID da conversa (opcional)' },
      offer:           { type: 'string', description: 'Produto ou serviço sendo ofertado' },
      value:           { type: 'number', description: 'Valor da proposta em reais (opcional)' },
      notes:           { type: 'string', description: 'Pontos especiais a incluir (opcional)' },
    }, required: ['contact_name', 'offer'] },
  },
] as const
