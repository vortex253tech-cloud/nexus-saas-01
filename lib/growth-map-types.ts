// ─── Growth Map types & templates (client-safe — no server imports) ──────────

export type NodeType =
  | 'data_analysis'
  | 'opportunity'
  | 'decision'
  | 'message_gen'
  | 'auto_action'
  | 'result'

export interface GrowthNodeConfig {
  dataSource?:   'overdue' | 'inactive' | 'financial' | 'all_clients'
  focus?:        string
  question?:     string
  messageType?:  'recovery' | 'upsell' | 'reactivation' | 'campaign'
  channel?:      'email' | 'whatsapp'
  tone?:         string
  segment?:      'overdue' | 'inactive' | 'all'
  metrics?:      string[]
}

export interface GrowthNode {
  id:       string
  type:     NodeType
  position: { x: number; y: number }
  data: {
    label:   string
    config:  GrowthNodeConfig
    result?: NodeResult
  }
}

export interface GrowthEdge {
  id: string; source: string; target: string
}

export interface NodeResult {
  success: boolean
  label:   string
  output:  Record<string, unknown>
  error?:  string
}

// ─── Templates ────────────────────────────────────────────────────────────────

export const GROWTH_TEMPLATES: Record<string, {
  name: string; description: string; icon: string; color: string
  nodes: GrowthNode[]; edges: GrowthEdge[]
}> = {
  recover_overdue: {
    name:        'Recuperar Inadimplentes',
    description: 'Identifica clientes em atraso e dispara email de cobrança inteligente',
    icon:        '💸',
    color:       'red',
    nodes: [
      { id: 'n1', type: 'data_analysis', position: { x: 50,  y: 200 }, data: { label: 'Clientes Inadimplentes', config: { dataSource: 'overdue' } } },
      { id: 'n2', type: 'opportunity',   position: { x: 320, y: 200 }, data: { label: 'Detectar Oportunidade',  config: { focus: 'recuperação de receita' } } },
      { id: 'n3', type: 'message_gen',   position: { x: 590, y: 200 }, data: { label: 'Gerar Mensagem',         config: { messageType: 'recovery', channel: 'email' } } },
      { id: 'n4', type: 'auto_action',   position: { x: 860, y: 200 }, data: { label: 'Enviar Email',           config: { channel: 'email', segment: 'overdue' } } },
      { id: 'n5', type: 'result',        position: { x: 1130,y: 200 }, data: { label: 'Resultado',              config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },
  increase_revenue: {
    name:        'Aumentar Faturamento',
    description: 'Analisa dados financeiros e cria estratégia de upsell personalizada',
    icon:        '📈',
    color:       'emerald',
    nodes: [
      { id: 'n1', type: 'data_analysis', position: { x: 50,  y: 200 }, data: { label: 'Análise Financeira',  config: { dataSource: 'financial' } } },
      { id: 'n2', type: 'opportunity',   position: { x: 320, y: 200 }, data: { label: 'Oportunidades',       config: { focus: 'aumento de receita e upsell' } } },
      { id: 'n3', type: 'decision',      position: { x: 590, y: 200 }, data: { label: 'Decisão Estratégica', config: { question: 'Qual produto ou serviço devo priorizar para aumentar receita?' } } },
      { id: 'n4', type: 'message_gen',   position: { x: 860, y: 200 }, data: { label: 'Campanha de Upsell',  config: { messageType: 'upsell', channel: 'email' } } },
      { id: 'n5', type: 'auto_action',   position: { x: 1130,y: 200 }, data: { label: 'Disparar Campanha',   config: { channel: 'email', segment: 'all' } } },
      { id: 'n6', type: 'result',        position: { x: 1400,y: 200 }, data: { label: 'Resultado',           config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n5', target: 'n6' },
    ],
  },
  reactivate_clients: {
    name:        'Reativar Clientes',
    description: 'Encontra clientes inativos e cria campanha de reativação por WhatsApp',
    icon:        '🔄',
    color:       'blue',
    nodes: [
      { id: 'n1', type: 'data_analysis', position: { x: 50,  y: 200 }, data: { label: 'Clientes Inativos',    config: { dataSource: 'inactive' } } },
      { id: 'n2', type: 'decision',      position: { x: 320, y: 200 }, data: { label: 'Estratégia de Retorno', config: { question: 'Como reativar clientes que pararam de comprar?' } } },
      { id: 'n3', type: 'message_gen',   position: { x: 590, y: 200 }, data: { label: 'Mensagem Reativação',  config: { messageType: 'reactivation', channel: 'whatsapp' } } },
      { id: 'n4', type: 'auto_action',   position: { x: 860, y: 200 }, data: { label: 'WhatsApp',             config: { channel: 'whatsapp', segment: 'inactive' } } },
      { id: 'n5', type: 'result',        position: { x: 1130,y: 200 }, data: { label: 'Resultado',            config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },
  full_campaign: {
    name:        'Criar Campanha Completa',
    description: 'IA decide estratégia, cria mensagem e executa campanha para toda a base',
    icon:        '🚀',
    color:       'violet',
    nodes: [
      { id: 'n1', type: 'data_analysis', position: { x: 50,  y: 200 }, data: { label: 'Visão Geral',       config: { dataSource: 'all_clients' } } },
      { id: 'n2', type: 'opportunity',   position: { x: 320, y: 100 }, data: { label: 'Identificar Gaps',  config: { focus: 'crescimento rápido' } } },
      { id: 'n3', type: 'decision',      position: { x: 320, y: 300 }, data: { label: 'Definir Campanha',  config: { question: 'Qual campanha teria maior impacto no faturamento agora?' } } },
      { id: 'n4', type: 'message_gen',   position: { x: 590, y: 200 }, data: { label: 'Criar Conteúdo',    config: { messageType: 'campaign', channel: 'email', tone: 'urgente e persuasivo' } } },
      { id: 'n5', type: 'auto_action',   position: { x: 860, y: 200 }, data: { label: 'Disparar Campanha', config: { channel: 'email', segment: 'all' } } },
      { id: 'n6', type: 'result',        position: { x: 1130,y: 200 }, data: { label: 'Métricas Finais',   config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n1', target: 'n3' },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n4' },
      { id: 'e5', source: 'n4', target: 'n5' },
      { id: 'e6', source: 'n5', target: 'n6' },
    ],
  },
}
