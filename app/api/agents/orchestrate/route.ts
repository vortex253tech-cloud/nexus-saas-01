// POST /api/agents/orchestrate
// NEXUS Multi-Agent Orchestrator — routes requests to specialized agents,
// executes tool-use loops, runs cascades, and logs activity.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import {
  classifyIntent,
  AGENT_PROMPTS,
  AGENT_TOOLS,
  ALL_TOOLS,
  CASCADE_RULES,
  AGENTS,
  type AgentId,
  type AgentAction,
  type CascadeEvent,
  type OrchestrateResult,
} from '@/lib/agents'

export const dynamic    = 'force-dynamic'
export const maxDuration = 90

// ─── Tool executors (shared with engine, co-located here) ─────────────────────

async function execTool(
  name: string,
  input: Record<string, unknown>,
  db: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
): Promise<unknown> {
  switch (name) {
    case 'get_business_overview': {
      const [leadsR, projR, eventsR] = await Promise.all([
        db.from('leads').select('id, temperatura', { count: 'exact' }).eq('company_id', companyId).limit(200),
        db.from('projects').select('id, name, type').eq('company_id', companyId).limit(50),
        db.from('seller_events').select('tipo, conteudo, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
      ])
      const leads = leadsR.data ?? []
      return {
        leads:    { total: leadsR.count ?? leads.length, hot: leads.filter(l => l.temperatura === 'quente' || l.temperatura === 'urgente').length },
        projects: { total: projR.data?.length ?? 0, list: (projR.data ?? []).slice(0, 5).map(p => ({ id: p.id, name: p.name })) },
        recent_activity: eventsR.data ?? [],
      }
    }

    case 'get_leads': {
      let q = db.from('leads').select('id, name, phone, empresa, temperatura, stage, score, email, created_at').eq('company_id', companyId)
      if (input.temperatura) q = q.eq('temperatura', input.temperatura as string)
      const { data } = await q.order('score', { ascending: false }).limit(typeof input.limit === 'number' ? input.limit : 10)
      return { leads: data ?? [], count: data?.length ?? 0 }
    }

    case 'create_lead': {
      const { data, error } = await db.from('leads').insert({
        company_id:  companyId,
        name:        input.name,
        phone:       input.phone ?? null,
        empresa:     input.empresa ?? null,
        email:       input.email ?? null,
        stage:       null,
        temperatura: 'morno',
        score:       50,
      }).select('id, name, phone, empresa, email').single()
      if (error) throw new Error(error.message)
      return { created: true, lead: data }
    }

    case 'update_lead': {
      const updates: Record<string, unknown> = {}
      if (input.temperatura) updates.temperatura = input.temperatura
      if (input.stage)       updates.stage       = input.stage
      if (input.score != null) updates.score = input.score
      const { data, error } = await db.from('leads').update(updates).eq('id', input.lead_id as string).eq('company_id', companyId).select('id, name, temperatura, stage, score').single()
      if (error) throw new Error(error.message)
      return { updated: true, lead: data }
    }

    case 'get_projects': {
      const { data } = await db.from('projects').select('id, name, type, description, goal, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20)
      return { projects: data ?? [], count: data?.length ?? 0 }
    }

    case 'create_project': {
      const { data, error } = await db.from('projects').insert({
        company_id:  companyId,
        name:        input.name,
        type:        input.type ?? 'operacao',
        description: input.description ?? '',
        goal:        input.goal ?? null,
      }).select('id, name, type, description, goal').single()
      if (error) throw new Error(error.message)
      return { created: true, project: data, navigate: `/dashboard/projects/${data.id}` }
    }

    case 'create_task': {
      const { data: proj } = await db.from('projects').select('id').eq('id', input.project_id as string).eq('company_id', companyId).single()
      if (!proj) throw new Error('Projeto não encontrado')
      const { data: tasks } = await db.from('project_tasks').select('position').eq('project_id', input.project_id as string).order('position', { ascending: false }).limit(1)
      const position = ((tasks?.[0]?.position ?? -1) as number) + 1
      const { data, error } = await db.from('project_tasks').insert({
        project_id:  input.project_id,
        company_id:  companyId,
        title:       input.title,
        description: input.description ?? null,
        priority:    input.priority ?? 'medium',
        status:      'todo',
        position,
      }).select('id, title, priority, status').single()
      if (error) throw new Error(error.message)
      return { created: true, task: data }
    }

    case 'get_financial_summary': {
      const [invR, chargesR] = await Promise.all([
        db.from('invoices').select('amount, status').eq('company_id', companyId).limit(200),
        db.from('collection_charges').select('amount, status').eq('company_id', companyId).limit(200),
      ])
      const invoices = invR.data ?? []
      const charges  = chargesR.data ?? []
      return {
        revenue_received: invoices.filter(i => i.status === 'paid').reduce((s: number, i) => s + (i.amount ?? 0), 0) / 100,
        pending_amount:   charges.filter(c => c.status === 'pending').reduce((s: number, c) => s + (c.amount ?? 0), 0) / 100,
        overdue_amount:   charges.filter(c => c.status === 'overdue').reduce((s: number, c) => s + (c.amount ?? 0), 0) / 100,
        total_invoices:   invoices.length,
        pending_charges:  charges.filter(c => c.status === 'pending').length,
      }
    }

    case 'get_recent_activity': {
      const limit = typeof input.limit === 'number' ? input.limit : 10
      const { data } = await db.from('seller_events').select('tipo, canal, conteudo, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(limit)
      return { events: data ?? [], count: data?.length ?? 0 }
    }

    case 'generate_content': {
      // Content is generated by Claude itself; tool just structures the request
      return {
        generated: true,
        type:      input.type,
        topic:     input.topic,
        note:      'Content will be part of the agent response text',
      }
    }

    case 'navigate_to': {
      return { navigating: true, path: input.path, label: input.label }
    }

    default:
      return { error: 'Tool not found' }
  }
}

// ─── Run a single agent's tool-use loop ───────────────────────────────────────

async function runAgentLoop(
  agentId: AgentId,
  userMessage: string,
  companyId: string,
  db: ReturnType<typeof getSupabaseServerClient>,
  client: Anthropic,
  history: Array<{ role: string; content: string }> = [],
): Promise<{ text: string; actions: AgentAction[]; navigateTo: string | null }> {
  const agentMeta    = AGENTS[agentId]
  const systemPrompt = `${AGENT_PROMPTS[agentId]}\n\nDados do contexto: company_id = ${companyId}`
  const agentToolNames = AGENT_TOOLS[agentId]
  const tools = ALL_TOOLS.filter(t => agentToolNames.includes(t.name))

  const messages: Anthropic.MessageParam[] = []
  for (const h of history.slice(-4)) {
    messages.push({ role: h.role as 'user' | 'assistant', content: h.content })
  }
  messages.push({ role: 'user', content: userMessage })

  const actions: AgentAction[] = []
  let navigateTo: string | null = null
  let response: Anthropic.Message | null = null

  for (let i = 0; i < 5; i++) {
    response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: agentMeta.maxTokens,
      system:     systemPrompt,
      tools,
      messages,
    })

    if (response.stop_reason !== 'tool_use') break

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      const input = block.input as Record<string, unknown>
      let result: unknown

      try {
        result = await execTool(block.name, input, db, companyId)
        actions.push({ agent: agentId, tool: block.name, result })

        if (block.name === 'navigate_to' || (result as { navigate?: string })?.navigate) {
          navigateTo = (block.name === 'navigate_to' ? input.path : (result as { navigate: string }).navigate) as string
        }
        if (block.name === 'create_project' && (result as { navigate?: string }).navigate) {
          navigateTo = (result as { navigate: string }).navigate
        }
      } catch (err) {
        result = { error: String(err) }
      }

      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
    }

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
  }

  const textBlock = response?.content?.find(b => b.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : 'Ação executada.'

  return { text, actions, navigateTo }
}

// ─── Emit agent event to seller_events ────────────────────────────────────────

async function logAgentEvent(
  db: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
  agentId: AgentId,
  action: string,
  summary: string,
) {
  try {
    await db.from('seller_events').insert({
      company_id: companyId,
      tipo:       `agent.${agentId}.${action}`,
      canal:      'nexus-agents',
      conteudo:   summary,
    })
  } catch {
    // Non-critical logging — swallow errors
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json() as {
      message:   string
      history?:  Array<{ role: string; content: string }>
      sessionId?: string
    }
    if (!body.message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const db        = getSupabaseServerClient()
    const companyId = ctx.company.id
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // 1. Classify intent → pick primary agent
    const primaryAgentId = classifyIntent(body.message)

    // 2. Run primary agent tool-use loop
    const primary = await runAgentLoop(
      primaryAgentId,
      body.message,
      companyId,
      db,
      client,
      body.history ?? [],
    )

    // 3. Log primary agent activity
    const toolsUsed = primary.actions.map(a => a.tool).join(', ') || 'analysis'
    await logAgentEvent(db, companyId, primaryAgentId, toolsUsed, body.message.slice(0, 200))

    // 4. Detect cascade conditions
    const toolNamesUsed = new Set(primary.actions.map(a => a.tool))
    const cascadeEvents: CascadeEvent[] = []
    const agentsInvolved: AgentId[] = [primaryAgentId]

    for (const rule of CASCADE_RULES) {
      if (rule.triggerAgent !== primaryAgentId) continue
      if (!toolNamesUsed.has(rule.triggerTool)) continue

      // Cascades are secondary: brief single-turn, no tool loops
      const cascadeSummary = `${rule.prompt}\n\nPrimary result: ${primary.text.slice(0, 500)}`
      const cascadeMessages: Anthropic.MessageParam[] = [
        { role: 'user', content: cascadeSummary },
      ]

      let cascadeText = ''
      try {
        const cascadeResp = await client.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system:     `${AGENT_PROMPTS[rule.targetAgent]}\n\nVocê está recebendo um evento de cascata de outro agente. Responda brevemente com sua análise ou ação relevante. company_id = ${companyId}`,
          messages:   cascadeMessages,
        })
        cascadeText = cascadeResp.content.find(b => b.type === 'text')?.type === 'text'
          ? (cascadeResp.content.find(b => b.type === 'text') as { type: 'text'; text: string }).text
          : ''
      } catch {
        cascadeText = ''
      }

      if (cascadeText) {
        cascadeEvents.push({
          from:    primaryAgentId,
          to:      rule.targetAgent,
          trigger: rule.triggerTool,
          summary: cascadeText.slice(0, 300),
        })
        agentsInvolved.push(rule.targetAgent)
        await logAgentEvent(db, companyId, rule.targetAgent, 'cascade', cascadeText.slice(0, 200))
      }
    }

    const result: OrchestrateResult = {
      message:         primary.text,
      primaryAgent:    primaryAgentId,
      agentsInvolved,
      actionsExecuted: primary.actions,
      cascade:         cascadeEvents,
      navigateTo:      primary.navigateTo,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[agents/orchestrate]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
