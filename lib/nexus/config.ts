// lib/nexus/config.ts
// NEXUS OS — system prompt and tool definitions for OpenAI Realtime

export const NEXUS_OS_SYSTEM_PROMPT = `Você é o NEXUS OS — sistema operacional de inteligência artificial para gestão empresarial de alta performance.

CAPACIDADES — você executa estas ações via ferramentas:
• Enviar mensagens WhatsApp para contatos e leads
• Criar tarefas e projetos
• Abrir leads no CRM
• Acessar central WhatsApp
• Criar automações e fluxos inteligentes
• Gerar propostas comerciais
• Agendar reuniões
• Consultar dados financeiros (receita, despesas, fluxo de caixa)
• Ativar monitoramento executivo CEO

REGRAS:
• Responda sempre em português brasileiro
• Seja direto, preciso e profissional
• Após executar uma ação, confirme o que foi feito em 1-2 frases
• Se um comando for ambíguo, peça esclarecimento
• Nunca invente dados ou resultados
• Nunca explique como você funciona — apenas execute e confirme`

export const NEXUS_OS_TOOLS = [
  {
    type: 'function',
    name: 'enviar_mensagem',
    description: 'Envia mensagem WhatsApp para um contato ou lead',
    parameters: {
      type: 'object',
      properties: {
        para:     { type: 'string', description: 'Nome ou número do destinatário' },
        mensagem: { type: 'string', description: 'Texto da mensagem a ser enviada' },
      },
      required: ['para', 'mensagem'],
    },
  },
  {
    type: 'function',
    name: 'criar_tarefa',
    description: 'Cria uma nova tarefa operacional',
    parameters: {
      type: 'object',
      properties: {
        titulo:      { type: 'string',  description: 'Título da tarefa' },
        descricao:   { type: 'string',  description: 'Descrição detalhada (opcional)' },
        prioridade:  { type: 'string',  enum: ['baixa', 'media', 'alta', 'urgente'], description: 'Prioridade' },
        responsavel: { type: 'string',  description: 'Nome do responsável (opcional)' },
      },
      required: ['titulo'],
    },
  },
  {
    type: 'function',
    name: 'criar_projeto',
    description: 'Cria um novo projeto',
    parameters: {
      type: 'object',
      properties: {
        nome:      { type: 'string', description: 'Nome do projeto' },
        descricao: { type: 'string', description: 'Descrição do projeto (opcional)' },
      },
      required: ['nome'],
    },
  },
  {
    type: 'function',
    name: 'abrir_lead',
    description: 'Abre ou busca um lead no CRM',
    parameters: {
      type: 'object',
      properties: {
        nome_ou_empresa: { type: 'string', description: 'Nome do lead ou empresa' },
      },
      required: ['nome_ou_empresa'],
    },
  },
  {
    type: 'function',
    name: 'abrir_whatsapp',
    description: 'Abre a central WhatsApp Business',
    parameters: {
      type: 'object',
      properties: {
        contato: { type: 'string', description: 'Nome ou número do contato (opcional)' },
      },
    },
  },
  {
    type: 'function',
    name: 'criar_automacao',
    description: 'Cria uma nova automação ou fluxo inteligente',
    parameters: {
      type: 'object',
      properties: {
        nome:    { type: 'string', description: 'Nome da automação' },
        gatilho: { type: 'string', description: 'Evento que dispara a automação (opcional)' },
        acao:    { type: 'string', description: 'O que a automação deve fazer (opcional)' },
      },
      required: ['nome'],
    },
  },
  {
    type: 'function',
    name: 'gerar_proposta',
    description: 'Gera uma proposta comercial inteligente',
    parameters: {
      type: 'object',
      properties: {
        cliente:  { type: 'string', description: 'Nome do cliente' },
        servico:  { type: 'string', description: 'Serviço ou produto a propor' },
        valor:    { type: 'number', description: 'Valor sugerido em reais (opcional)' },
      },
      required: ['cliente', 'servico'],
    },
  },
  {
    type: 'function',
    name: 'marcar_reuniao',
    description: 'Agenda uma reunião',
    parameters: {
      type: 'object',
      properties: {
        titulo:        { type: 'string', description: 'Assunto da reunião' },
        participantes: { type: 'string', description: 'Participantes (nomes ou e-mails, opcional)' },
        data_hora:     { type: 'string', description: 'Data e hora — ex: amanhã às 15h, sexta às 10h' },
        duracao:       { type: 'string', description: 'Duração — ex: 30 minutos, 1 hora (opcional)' },
      },
      required: ['titulo'],
    },
  },
  {
    type: 'function',
    name: 'consultar_financeiro',
    description: 'Consulta dados financeiros: receita, despesas, resultado, fluxo de caixa, métricas',
    parameters: {
      type: 'object',
      properties: {
        periodo: { type: 'string', description: 'Período de consulta — ex: este mês, últimos 30 dias' },
        metrica: { type: 'string', description: 'Métrica específica — ex: receita, lucro, CAC, LTV' },
      },
    },
  },
  {
    type: 'function',
    name: 'ativar_modo_ceo',
    description: 'Ativa o painel executivo CEO com monitoramento em tempo real de todas as métricas',
    parameters: {
      type: 'object',
      properties: {
        foco: { type: 'string', description: 'Área de foco — ex: vendas, financeiro, operações (opcional)' },
      },
    },
  },
] as const
