// GET /api/nexus/os
// NEXUS OS — Aggregated operating system status.
// Returns: agents, metrics, activities, insights, growth, health score.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-server'
import { createClient }            from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Agent catalogue ───────────────────────────────────────────────────────────

const AGENTS = [
  { id: 'ceo',       label: 'CEO IA',        description: 'Estratégia e decisões',     icon: '🧠', color: 'violet' },
  { id: 'marketing', label: 'Marketing IA',   description: 'Campanhas e conteúdo',      icon: '📢', color: 'blue'   },
  { id: 'vendas',    label: 'Vendas IA',      description: 'Leads e conversões',        icon: '💰', color: 'emerald'},
  { id: 'financeiro',label: 'Financeiro IA',  description: 'Fluxo de caixa e lucro',   icon: '📊', color: 'amber'  },
  { id: 'growth',    label: 'Growth IA',      description: 'Crescimento contínuo',      icon: '🚀', color: 'cyan'   },
  { id: 'operacoes', label: 'Operações IA',   description: 'Processos e eficiência',    icon: '⚙️', color: 'slate'  },
  { id: 'atendimento',label: 'Atendimento IA',description: 'Atendimento e clientes',   icon: '💬', color: 'pink'   },
  { id: 'projetos',  label: 'Projetos IA',    description: 'Gestão e entregas',         icon: '📋', color: 'indigo' },
  { id: 'conteudo',  label: 'Conteúdo IA',    description: 'Criação e distribuição',    icon: '✍️', color: 'rose'   },
]

// ── Safe query helper ─────────────────────────────────────────────────────────

async function safeQuery<T>(fn: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const { data, error } = await fn()
    if (error) return null
    return data
  } catch { return null }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = svc()

  // Get company_id
  const { data: member } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()
  const companyId = member?.company_id ?? null

  if (!companyId) {
    return NextResponse.json({ error: 'No company' }, { status: 404 })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  // ── Parallel queries ────────────────────────────────────────────────────────
  const [
    convData,
    msgData,
    todayMsgData,
    leadData,
    autoData,
    eventData,
    taskData,
    projectData,
    financialData,
  ] = await Promise.all([
    // Conversations
    safeQuery(() => supabase
      .from('whatsapp_conversations')
      .select('id, status, ai_active, unread_count')
      .eq('company_id', companyId)
    ),
    // All messages (for activity)
    safeQuery(() => supabase
      .from('whatsapp_messages')
      .select('id, content, direction, created_at, conversation_id')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(20)
    ),
    // Today messages
    safeQuery(() => supabase
      .from('whatsapp_messages')
      .select('id', { count: 'exact' })
      .eq('company_id', companyId)
      .gte('created_at', todayStr)
    ),
    // Leads (hot = temp quente or score >= 70)
    safeQuery(() => supabase
      .from('whatsapp_conversations')
      .select('id, nome, temperatura, score, status')
      .eq('company_id', companyId)
      .in('temperatura', ['quente', 'muito_quente'])
      .limit(10)
    ),
    // Automations
    safeQuery(() => supabase
      .from('automations')
      .select('id, name, active, trigger_count, last_triggered_at')
      .eq('company_id', companyId)
    ),
    // Events / activity log
    safeQuery(() => supabase
      .from('nexus_events')
      .select('id, event_type, description, metadata, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(15)
    ),
    // Tasks
    safeQuery(() => supabase
      .from('tasks')
      .select('id, title, status, priority, source')
      .eq('company_id', companyId)
      .limit(10)
    ),
    // Projects
    safeQuery(() => supabase
      .from('projects')
      .select('id, name, status')
      .eq('company_id', companyId)
    ),
    // Financial (revenue)
    safeQuery(() => supabase
      .from('project_revenues')
      .select('amount, received_at')
      .eq('company_id', companyId)
    ),
  ])

  // ── Compute metrics ─────────────────────────────────────────────────────────

  const conversations = (convData as Array<{ id: string; status: string; ai_active: boolean; unread_count: number }> | null) ?? []
  const activeConvs   = conversations.filter(c => c.status === 'open' || c.status === 'active').length
  const aiActive      = conversations.filter(c => c.ai_active).length
  const unreadTotal   = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0)

  const messages      = (msgData as Array<{ id: string; content: string; direction: string; created_at: string; conversation_id: string }> | null) ?? []
  const todayMessages = Array.isArray(todayMsgData) ? todayMsgData.length : 0

  const hotLeads      = (leadData as Array<{ id: string; nome: string; temperatura: string; score: number; status: string }> | null) ?? []

  const automations   = (autoData as Array<{ id: string; name: string; active: boolean; trigger_count: number; last_triggered_at: string | null }> | null) ?? []
  const activeAutos   = automations.filter(a => a.active).length
  const totalTriggers = automations.reduce((s, a) => s + (a.trigger_count ?? 0), 0)

  const events        = (eventData as Array<{ id: string; event_type: string; description: string; metadata: unknown; created_at: string }> | null) ?? []

  const projects      = (projectData as Array<{ id: string; name: string; status: string }> | null) ?? []
  const activeProjects= projects.filter(p => p.status === 'active' || p.status === 'in_progress').length

  const revenues      = (financialData as Array<{ amount: number; received_at: string }> | null) ?? []
  const monthStr      = new Date().toISOString().slice(0, 7)
  const mrr           = revenues
    .filter(r => r.received_at?.startsWith(monthStr))
    .reduce((s, r) => s + (r.amount ?? 0), 0)

  // ── Health score ────────────────────────────────────────────────────────────

  const healthScore = Math.min(100, Math.round(
    (activeConvs > 0     ? 15 : 0) +
    (aiActive > 0        ? 20 : 0) +
    (hotLeads.length > 0 ? 15 : 0) +
    (activeAutos > 0     ? 20 : 0) +
    (todayMessages > 5   ? 20 : todayMessages > 0 ? 10 : 0) +
    (unreadTotal === 0   ? 10 : unreadTotal < 5 ? 5 : 0),
  ))

  // ── Build activity feed ─────────────────────────────────────────────────────

  type ActivityItem = {
    id: string; type: string; label: string
    detail: string; time: string; icon: string; color: string
  }

  const activity: ActivityItem[] = []

  // From nexus_events
  for (const e of events.slice(0, 8)) {
    activity.push({
      id:     e.id,
      type:   e.event_type,
      label:  eventLabel(e.event_type),
      detail: e.description,
      time:   e.created_at,
      icon:   eventIcon(e.event_type),
      color:  eventColor(e.event_type),
    })
  }

  // From messages (fill up to 10 items)
  for (const m of messages.slice(0, Math.max(0, 10 - activity.length))) {
    activity.push({
      id:     m.id,
      type:   'message',
      label:  m.direction === 'inbound' ? 'Mensagem recebida' : 'Mensagem enviada',
      detail: (m.content ?? '').slice(0, 60),
      time:   m.created_at,
      icon:   '💬',
      color:  'blue',
    })
  }

  // Sort by time desc
  activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  // ── Insights / Opportunities ────────────────────────────────────────────────

  const insights: Array<{ type: string; title: string; desc: string; impact: string; action: string }> = []

  if (hotLeads.length > 0) {
    insights.push({
      type:   'opportunity',
      title:  `${hotLeads.length} leads quentes`,
      desc:   'Leads com alta temperatura prontos para fechar',
      impact: `Potencial: ${hotLeads.length} vendas`,
      action: 'Ver leads',
    })
  }
  if (unreadTotal > 0) {
    insights.push({
      type:   'warning',
      title:  `${unreadTotal} mensagens não lidas`,
      desc:   'Leads aguardando resposta — risco de perda',
      impact: `-R$ ${(unreadTotal * 500).toLocaleString('pt-BR')} potencial`,
      action: 'Responder agora',
    })
  }
  if (activeAutos > 0) {
    insights.push({
      type:   'info',
      title:  `${activeAutos} automações ativas`,
      desc:   `${totalTriggers} execuções realizadas automaticamente`,
      impact: `+${Math.round(totalTriggers * 0.5)}h economizadas`,
      action: 'Ver automações',
    })
  }
  if (aiActive < activeConvs && activeConvs > 0) {
    insights.push({
      type:   'opportunity',
      title:  'IA pode assumir mais conversas',
      desc:   `${activeConvs - aiActive} conversas sem IA ativa`,
      impact: 'Ativar IA = +80% resposta automática',
      action: 'Ativar IA',
    })
  }

  // ── Agents with real activity context ──────────────────────────────────────

  const agentsPayload = AGENTS.map(a => ({
    ...a,
    status:  'active',
    task:    agentTask(a.id, { activeConvs, hotLeads: hotLeads.length, activeAutos, mrr }),
    metrics: agentMetrics(a.id, { activeConvs, hotLeads: hotLeads.length, activeAutos, mrr, todayMessages }),
  }))

  // ── Response ────────────────────────────────────────────────────────────────

  return NextResponse.json({
    health:  healthScore,
    metrics: {
      conversations:  activeConvs,
      unread:         unreadTotal,
      ai_active:      aiActive,
      hot_leads:      hotLeads.length,
      today_messages: todayMessages,
      active_autos:   activeAutos,
      total_triggers: totalTriggers,
      active_projects:activeProjects,
      mrr:            mrr,
    },
    agents:   agentsPayload,
    activity: activity.slice(0, 12),
    insights: insights.slice(0, 4),
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    agent_orchestrated: 'Agente acionado',
    automation_triggered: 'Automação disparada',
    lead_qualified: 'Lead qualificado',
    message_sent: 'Mensagem enviada',
    task_created: 'Tarefa criada',
    followup_scheduled: 'Follow-up agendado',
  }
  return map[type] ?? 'Evento do sistema'
}

function eventIcon(type: string): string {
  const map: Record<string, string> = {
    agent_orchestrated: '🤖',
    automation_triggered: '⚡',
    lead_qualified: '🎯',
    message_sent: '📤',
    task_created: '✅',
    followup_scheduled: '📅',
  }
  return map[type] ?? '🔔'
}

function eventColor(type: string): string {
  const map: Record<string, string> = {
    agent_orchestrated: 'violet',
    automation_triggered: 'amber',
    lead_qualified: 'emerald',
    message_sent: 'blue',
    task_created: 'cyan',
    followup_scheduled: 'pink',
  }
  return map[type] ?? 'slate'
}

function agentTask(id: string, ctx: {
  activeConvs: number; hotLeads: number; activeAutos: number; mrr: number
}): string {
  const tasks: Record<string, string> = {
    ceo:        'Analisando performance geral',
    marketing:  ctx.activeAutos > 0 ? 'Executando campanhas ativas' : 'Planejando campanhas',
    vendas:     ctx.hotLeads > 0 ? `Qualificando ${ctx.hotLeads} leads quentes` : 'Monitorando pipeline',
    financeiro: ctx.mrr > 0 ? 'Monitorando fluxo de caixa' : 'Aguardando dados financeiros',
    growth:     'Identificando oportunidades de crescimento',
    operacoes:  'Otimizando processos e automações',
    atendimento:ctx.activeConvs > 0 ? `Monitorando ${ctx.activeConvs} conversas` : 'Aguardando atendimentos',
    projetos:   'Atualizando status de projetos',
    conteudo:   'Gerando conteúdo estratégico',
  }
  return tasks[id] ?? 'Operando em segundo plano'
}

function agentMetrics(id: string, ctx: {
  activeConvs: number; hotLeads: number; activeAutos: number; mrr: number; todayMessages: number
}): string {
  const m: Record<string, string> = {
    ceo:        `Saúde do negócio monitorada`,
    marketing:  ctx.activeAutos > 0 ? `${ctx.activeAutos} campanhas ativas` : 'Pronto para operar',
    vendas:     `${ctx.hotLeads} leads no radar`,
    financeiro: ctx.mrr > 0 ? `R$ ${ctx.mrr.toLocaleString('pt-BR')} MRR` : 'Aguardando receitas',
    growth:     'Crescimento contínuo',
    operacoes:  `${ctx.activeAutos} fluxos ativos`,
    atendimento:`${ctx.todayMessages} msgs hoje`,
    projetos:   'Projetos em dia',
    conteudo:   'Conteúdo programado',
  }
  return m[id] ?? 'Online'
}
