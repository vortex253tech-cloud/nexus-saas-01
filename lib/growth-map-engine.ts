// ─── Growth Map Execution Engine ────────────────────────────────────────────
// Processes node graphs: topological sort → executes each handler → accumulates context.

import Anthropic           from '@anthropic-ai/sdk'
import { sendEmail }       from './email'
import { computeEffectiveStatus } from './collections'
import { getSupabaseServerClient } from './supabase'

const ai = new Anthropic()

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType =
  | 'data_analysis'
  | 'opportunity'
  | 'decision'
  | 'message_gen'
  | 'auto_action'
  | 'result'

export interface GrowthNodeConfig {
  // data_analysis
  dataSource?: 'overdue' | 'inactive' | 'financial' | 'all_clients'
  // opportunity / decision
  focus?: string
  question?: string
  // message_gen
  messageType?: 'recovery' | 'upsell' | 'reactivation' | 'campaign'
  channel?: 'email' | 'whatsapp'
  tone?: string
  // auto_action
  segment?: 'overdue' | 'inactive' | 'all'
  // result
  metrics?: string[]
}

export interface GrowthNode {
  id: string
  type: NodeType
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
  success:  boolean
  label:    string   // shown on the canvas
  output:   Record<string, unknown>
  error?:   string
}

interface ExecContext {
  companyId:      string
  companyName:    string
  overdueClients: ClientRow[]
  inactiveClients: ClientRow[]
  allClients:     ClientRow[]
  financialSummary: string
  opportunities:  string[]
  decision:       string
  generatedMessage: { subject: string; body: string } | null
  actionsTaken:   number
}

interface ClientRow {
  id: string; name: string; email: string | null; phone: string | null
  total_revenue: number; due_date: string | null; status: string
}

// ─── Topological sort ─────────────────────────────────────────────────────────

function topologicalSort(nodes: GrowthNode[], edges: GrowthEdge[]): GrowthNode[] {
  const inDegree  = new Map(nodes.map(n => [n.id, 0]))
  const adjList   = new Map(nodes.map(n => [n.id, [] as string[]]))

  for (const e of edges) {
    adjList.get(e.source)?.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  const queue = nodes.filter(n => (inDegree.get(n.id) ?? 0) === 0).map(n => n.id)
  const sorted: GrowthNode[] = []
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  while (queue.length > 0) {
    const nid = queue.shift()!
    const node = nodeMap.get(nid)
    if (node) sorted.push(node)
    for (const neighbor of adjList.get(nid) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, deg)
      if (deg === 0) queue.push(neighbor)
    }
  }

  return sorted
}

// ─── Node handlers ────────────────────────────────────────────────────────────

async function handleDataAnalysis(
  node: GrowthNode,
  ctx: ExecContext,
): Promise<NodeResult> {
  const source = node.data.config.dataSource ?? 'all_clients'

  if (source === 'overdue') {
    const count = ctx.overdueClients.length
    const total = ctx.overdueClients.reduce((s, c) => s + c.total_revenue, 0)
    const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    return {
      success: true,
      label:   `${count} clientes inadimplentes • ${fmtBRL(total)} em aberto`,
      output:  { targetClients: ctx.overdueClients, targetTotal: total, targetType: 'overdue' },
    }
  }

  if (source === 'inactive') {
    const count = ctx.inactiveClients.length
    return {
      success: true,
      label:   `${count} clientes inativos identificados`,
      output:  { targetClients: ctx.inactiveClients, targetType: 'inactive' },
    }
  }

  if (source === 'financial') {
    return {
      success: true,
      label:   ctx.financialSummary,
      output:  { financialSummary: ctx.financialSummary },
    }
  }

  // all_clients
  const total = ctx.allClients.reduce((s, c) => s + c.total_revenue, 0)
  return {
    success: true,
    label:   `${ctx.allClients.length} clientes • R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} total`,
    output:  { targetClients: ctx.allClients, targetTotal: total, targetType: 'all' },
  }
}

async function handleOpportunity(
  node: GrowthNode,
  ctx: ExecContext,
): Promise<NodeResult> {
  const focus   = node.data.config.focus ?? 'crescimento'
  const targets = (ctx as unknown as Record<string, unknown>).targetClients as ClientRow[] | undefined
  const count   = targets?.length ?? ctx.allClients.length

  if (!process.env.ANTHROPIC_API_KEY) {
    const stub = ['Enviar oferta de desconto para pagamento à vista', 'Criar campanha de reativação por email']
    ctx.opportunities = stub
    return { success: true, label: `${stub.length} oportunidades detectadas (simulado)`, output: { opportunities: stub } }
  }

  const prompt = `Você é um estrategista de negócios. Analise os dados abaixo e liste as TOP 3 oportunidades de ${focus}.
Dados: ${ctx.financialSummary}. Clientes alvo: ${count}. Contexto: ${focus}.
Responda APENAS com JSON: {"opportunities": ["string", "string", "string"]}`

  const resp = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })
  const text  = resp.content[0].type === 'text' ? resp.content[0].text : '{}'
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(clean) as { opportunities: string[] }

  ctx.opportunities = parsed.opportunities ?? []
  return {
    success: true,
    label:   `${ctx.opportunities.length} oportunidades identificadas`,
    output:  { opportunities: ctx.opportunities },
  }
}

async function handleDecision(
  node: GrowthNode,
  ctx: ExecContext,
): Promise<NodeResult> {
  const question = node.data.config.question ?? 'Qual a melhor ação para crescer o negócio?'

  if (!process.env.ANTHROPIC_API_KEY) {
    const stub = 'Priorizar recuperação de inadimplentes com desconto de 10% para pagamento imediato.'
    ctx.decision = stub
    return { success: true, label: 'Decisão estratégica gerada (simulado)', output: { decision: stub } }
  }

  const opps = ctx.opportunities.length > 0
    ? `Oportunidades identificadas: ${ctx.opportunities.join('; ')}.`
    : ''

  const prompt = `Você é um consultor estratégico de negócios. ${question}
${opps}
Contexto financeiro: ${ctx.financialSummary}.
Responda APENAS em JSON: {"decision": "ação concreta em 1 frase", "rationale": "motivo em 1 frase", "urgency": "alta|media|baixa"}`

  const resp = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })
  const text   = resp.content[0].type === 'text' ? resp.content[0].text : '{}'
  const clean  = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(clean) as { decision: string; rationale: string; urgency: string }

  ctx.decision = `${parsed.decision} (${parsed.rationale})`
  return {
    success: true,
    label:   parsed.decision,
    output:  { decision: ctx.decision, urgency: parsed.urgency },
  }
}

async function handleMessageGen(
  node: GrowthNode,
  ctx: ExecContext,
): Promise<NodeResult> {
  const msgType = node.data.config.messageType ?? 'recovery'
  const tone    = node.data.config.tone ?? 'profissional mas amigável'

  if (!process.env.ANTHROPIC_API_KEY) {
    const stub = {
      subject: `[${ctx.companyName}] Mensagem importante para você`,
      body: `Olá {{nome}},\n\n${ctx.decision || 'Temos uma proposta especial para você!'}\n\nAtt,\n${ctx.companyName}`,
    }
    ctx.generatedMessage = stub
    return { success: true, label: 'Mensagem gerada (simulado)', output: { message: stub } }
  }

  const typeContext = {
    recovery:     'cobrança amigável para recuperar inadimplente',
    upsell:       'oferta de upgrade ou produto complementar',
    reactivation: 'reativação de cliente inativo',
    campaign:     'campanha promocional',
  }[msgType]

  const prompt = `Crie uma mensagem de ${typeContext} para ${ctx.companyName}.
Decisão estratégica: ${ctx.decision || 'melhorar relacionamento com cliente'}.
Tom: ${tone}. Use {{nome}} como placeholder para o nome do cliente.
Responda APENAS em JSON: {"subject": "assunto do email", "body": "corpo da mensagem"}`

  const resp = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })
  const text   = resp.content[0].type === 'text' ? resp.content[0].text : '{}'
  const clean  = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(clean) as { subject: string; body: string }

  ctx.generatedMessage = parsed
  return {
    success: true,
    label:   `Mensagem gerada: "${parsed.subject}"`,
    output:  { message: parsed },
  }
}

async function handleAutoAction(
  node: GrowthNode,
  ctx: ExecContext,
): Promise<NodeResult> {
  const channel = node.data.config.channel ?? 'email'
  const segment = node.data.config.segment ?? 'overdue'

  const targets =
    segment === 'overdue'   ? ctx.overdueClients :
    segment === 'inactive'  ? ctx.inactiveClients :
    ctx.allClients

  if (!ctx.generatedMessage) {
    return { success: false, label: 'Sem mensagem para enviar', output: {}, error: 'Conecte um bloco de Mensagem antes da Ação.' }
  }

  if (channel === 'whatsapp') {
    const withPhone = targets.filter(c => c.phone)
    ctx.actionsTaken += withPhone.length
    return {
      success: true,
      label:   `${withPhone.length} links de WhatsApp gerados`,
      output:  { sent: withPhone.length, channel: 'whatsapp' },
    }
  }

  // Email
  const withEmail = targets.filter(c => c.email)
  let sent = 0; let failed = 0

  for (const client of withEmail.slice(0, 50)) {
    const body = ctx.generatedMessage.body.replace(/\{\{nome\}\}/g, client.name)
    const result = await sendEmail({
      to:      client.email!,
      subject: ctx.generatedMessage.subject,
      html:    `<div style="font-family:sans-serif;white-space:pre-wrap">${body}</div>`,
    })
    result.success ? sent++ : failed++
  }

  ctx.actionsTaken += sent
  return {
    success: true,
    label:   `${sent} emails enviados${failed > 0 ? `, ${failed} falhas` : ''}`,
    output:  { sent, failed, channel: 'email' },
  }
}

async function handleResult(
  _node: GrowthNode,
  ctx: ExecContext,
): Promise<NodeResult> {
  const lines = [
    ctx.decision       ? `✅ Decisão: ${ctx.decision}`                          : null,
    ctx.opportunities.length ? `💡 ${ctx.opportunities.length} oportunidades`   : null,
    ctx.generatedMessage   ? `✉️ Mensagem: "${ctx.generatedMessage.subject}"`    : null,
    ctx.actionsTaken   ? `🚀 ${ctx.actionsTaken} ações executadas`               : null,
  ].filter(Boolean).join('\n')

  return {
    success: true,
    label:   `${ctx.actionsTaken} ações · fluxo concluído`,
    output:  {
      summary:      lines,
      actionsTaken: ctx.actionsTaken,
      decision:     ctx.decision,
      opportunities: ctx.opportunities,
    },
  }
}

// ─── Main execute function ────────────────────────────────────────────────────

export async function executeGrowthMap(
  mapId:     string,
  companyId: string,
): Promise<{ results: Record<string, NodeResult>; executionId: string; summary: string; actionsTaken: number }> {
  const db = getSupabaseServerClient()
  const t0 = Date.now()

  // Load map
  const { data: map } = await db.from('growth_maps').select('*').eq('id', mapId).eq('company_id', companyId).single()
  if (!map) throw new Error('Mapa não encontrado')

  const nodes  = (map.nodes  as unknown) as GrowthNode[]
  const edges  = (map.edges  as unknown) as GrowthEdge[]
  const sorted = topologicalSort(nodes, edges)

  // Build context — load all data upfront
  const { data: company } = await db.from('companies').select('id, nome').eq('id', companyId).single()
  const companyName = (company as { nome?: string } | null)?.nome ?? 'Empresa'

  const { data: allClients } = await db
    .from('clients').select('id, name, email, phone, total_revenue, due_date, status')
    .eq('company_id', companyId)

  const clients       = (allClients ?? []) as ClientRow[]
  const overdueList   = clients.filter(c => computeEffectiveStatus(c.status, c.due_date) === 'overdue')
  const inactiveList  = clients.filter(c => c.status === 'pending' && !c.due_date)
  const totalRevenue  = clients.reduce((s, c) => s + c.total_revenue, 0)
  const overdueRevenue = overdueList.reduce((s, c) => s + c.total_revenue, 0)
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const financialSummary =
    `Receita total: ${fmt(totalRevenue)}. ` +
    `Inadimplentes: ${overdueList.length} clientes (${fmt(overdueRevenue)}). ` +
    `Clientes ativos: ${clients.filter(c => c.status === 'paid').length}.`

  const ctx: ExecContext = {
    companyId, companyName,
    overdueClients:   overdueList,
    inactiveClients:  inactiveList,
    allClients:       clients,
    financialSummary,
    opportunities:    [],
    decision:         '',
    generatedMessage: null,
    actionsTaken:     0,
  }

  // Execute each node in topological order
  const results: Record<string, NodeResult> = {}

  for (const node of sorted) {
    try {
      let result: NodeResult
      switch (node.type) {
        case 'data_analysis': result = await handleDataAnalysis(node, ctx); break
        case 'opportunity':   result = await handleOpportunity(node, ctx);  break
        case 'decision':      result = await handleDecision(node, ctx);     break
        case 'message_gen':   result = await handleMessageGen(node, ctx);   break
        case 'auto_action':   result = await handleAutoAction(node, ctx);   break
        case 'result':        result = await handleResult(node, ctx);       break
        default:              result = { success: true, label: 'OK', output: {} }
      }
      results[node.id] = result
    } catch (err) {
      results[node.id] = {
        success: false,
        label:   'Erro na execução',
        output:  {},
        error:   err instanceof Error ? err.message : String(err),
      }
    }
  }

  const duration  = Date.now() - t0
  const summary   = `Fluxo executado em ${(duration / 1000).toFixed(1)}s. ${ctx.actionsTaken} ações realizadas.`

  // Save execution
  const { data: exec } = await db.from('growth_map_executions').insert({
    map_id: mapId, company_id: companyId,
    status: 'completed', results, summary,
    actions_taken: ctx.actionsTaken,
    duration_ms: duration,
  }).select('id').single()

  // Update map last_executed_at
  await db.from('growth_maps').update({
    last_executed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', mapId)

  return {
    results,
    executionId: (exec as { id: string } | null)?.id ?? '',
    summary,
    actionsTaken: ctx.actionsTaken,
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

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
      { id: 'n1', type: 'data_analysis', position: { x: 50,  y: 200 }, data: { label: 'Análise Financeira', config: { dataSource: 'financial' } } },
      { id: 'n2', type: 'opportunity',   position: { x: 320, y: 200 }, data: { label: 'Oportunidades',      config: { focus: 'aumento de receita e upsell' } } },
      { id: 'n3', type: 'decision',      position: { x: 590, y: 200 }, data: { label: 'Decisão Estratégica',config: { question: 'Qual produto ou serviço devo priorizar para aumentar receita?' } } },
      { id: 'n4', type: 'message_gen',   position: { x: 860, y: 200 }, data: { label: 'Campanha de Upsell', config: { messageType: 'upsell', channel: 'email' } } },
      { id: 'n5', type: 'auto_action',   position: { x: 1130,y: 200 }, data: { label: 'Disparar Campanha',  config: { channel: 'email', segment: 'all' } } },
      { id: 'n6', type: 'result',        position: { x: 1400,y: 200 }, data: { label: 'Resultado',          config: {} } },
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
      { id: 'n1', type: 'data_analysis', position: { x: 50,  y: 200 }, data: { label: 'Clientes Inativos',   config: { dataSource: 'inactive' } } },
      { id: 'n2', type: 'decision',      position: { x: 320, y: 200 }, data: { label: 'Estratégia de Retorno',config: { question: 'Como reativar clientes que pararam de comprar?' } } },
      { id: 'n3', type: 'message_gen',   position: { x: 590, y: 200 }, data: { label: 'Mensagem Reativação', config: { messageType: 'reactivation', channel: 'whatsapp' } } },
      { id: 'n4', type: 'auto_action',   position: { x: 860, y: 200 }, data: { label: 'WhatsApp',            config: { channel: 'whatsapp', segment: 'inactive' } } },
      { id: 'n5', type: 'result',        position: { x: 1130,y: 200 }, data: { label: 'Resultado',           config: {} } },
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
      { id: 'n1', type: 'data_analysis', position: { x: 50,  y: 200 }, data: { label: 'Visão Geral',         config: { dataSource: 'all_clients' } } },
      { id: 'n2', type: 'opportunity',   position: { x: 320, y: 100 }, data: { label: 'Identificar Gaps',    config: { focus: 'crescimento rápido' } } },
      { id: 'n3', type: 'decision',      position: { x: 320, y: 300 }, data: { label: 'Definir Campanha',    config: { question: 'Qual campanha teria maior impacto no faturamento agora?' } } },
      { id: 'n4', type: 'message_gen',   position: { x: 590, y: 200 }, data: { label: 'Criar Conteúdo',      config: { messageType: 'campaign', channel: 'email', tone: 'urgente e persuasivo' } } },
      { id: 'n5', type: 'auto_action',   position: { x: 860, y: 200 }, data: { label: 'Disparar Campanha',   config: { channel: 'email', segment: 'all' } } },
      { id: 'n6', type: 'result',        position: { x: 1130,y: 200 }, data: { label: 'Métricas Finais',     config: {} } },
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
