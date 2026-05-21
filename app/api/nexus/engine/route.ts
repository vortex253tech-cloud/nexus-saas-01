// POST /api/nexus/engine
// Nexus Core AI Engine — Claude with tool use for real action execution.
// Accepts a natural language command and executes real operations:
// read data, create leads, projects, tasks, navigate, send alerts.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_business_overview',
    description: 'Get a complete business overview: leads count, revenue, projects status, tasks, messages.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_leads',
    description: 'Fetch leads from the pipeline with optional filters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        temperatura: { type: 'string', enum: ['quente', 'morno', 'frio'], description: 'Filter by lead temperature' },
        limit: { type: 'number', description: 'Max results to return, default 10' },
      },
      required: [],
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new lead in the pipeline. Use when user wants to add a contact, prospect, or lead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name:    { type: 'string',  description: 'Full name of the lead' },
        phone:   { type: 'string',  description: 'Phone with country code, e.g. +5511999999999' },
        empresa: { type: 'string',  description: 'Company or business name' },
        email:   { type: 'string',  description: 'Email address' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_projects',
    description: 'List all active projects with their tasks and status.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'create_project',
    description: 'Create a new operational project. Use when user says "criar projeto", "abrir projeto", "novo projeto".',
    input_schema: {
      type: 'object' as const,
      properties: {
        name:        { type: 'string', description: 'Project name' },
        type:        { type: 'string', enum: ['lancamento', 'produto', 'marketing', 'automacao', 'crm', 'trafego', 'conteudo', 'operacao', 'servico', 'interno'], description: 'Project type' },
        description: { type: 'string', description: 'Short description of the project goal' },
        goal:        { type: 'number', description: 'Financial target in BRL (optional)' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task inside a project. Requires project_id — use get_projects first if you need to find it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_id:  { type: 'string', description: 'ID of the project to add the task to' },
        title:       { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description (optional)' },
        priority:    { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority' },
        status:      { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done'], description: 'Task status (default: todo)' },
      },
      required: ['project_id', 'title'],
    },
  },
  {
    name: 'get_financial_summary',
    description: 'Get financial data: total revenue, expenses, profit, pending charges.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_recent_activity',
    description: 'Get recent platform activity: messages sent, leads moved, AI actions taken.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Number of events to return, default 10' },
      },
      required: [],
    },
  },
  {
    name: 'navigate_to',
    description: 'Tell the frontend to navigate the user to a specific page. Use after creating something or when the user asks to open a page.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path:  { type: 'string', description: 'The dashboard path, e.g. /dashboard/leads or /dashboard/projects' },
        label: { type: 'string', description: 'Human-readable description of where we are navigating' },
      },
      required: ['path', 'label'],
    },
  },
]

// ─── Tool executors ───────────────────────────────────────────────────────────

async function execGetBusinessOverview(db: ReturnType<typeof getSupabaseServerClient>, companyId: string) {
  const [leadsR, projR, eventsR] = await Promise.all([
    db.from('leads').select('id, temperatura, stage', { count: 'exact' }).eq('company_id', companyId).limit(200),
    db.from('projects').select('id, name, type').eq('company_id', companyId).limit(50),
    db.from('seller_events').select('tipo, conteudo, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
  ])

  const leads = leadsR.data ?? []
  const hot   = leads.filter(l => l.temperatura === 'quente' || l.temperatura === 'urgente').length
  const total = leadsR.count ?? leads.length

  return {
    leads:    { total, hot, cold: leads.filter(l => l.temperatura === 'frio').length },
    projects: { total: projR.data?.length ?? 0, list: (projR.data ?? []).map(p => ({ id: p.id, name: p.name, type: p.type })) },
    recent_activity: eventsR.data ?? [],
  }
}

async function execGetLeads(db: ReturnType<typeof getSupabaseServerClient>, companyId: string, input: Record<string, unknown>) {
  let q = db.from('leads').select('id, name, phone, empresa, temperatura, stage, score, email, created_at').eq('company_id', companyId)
  if (input.temperatura) q = q.eq('temperatura', input.temperatura as string)
  const limit = typeof input.limit === 'number' ? input.limit : 10
  const { data } = await q.order('score', { ascending: false }).limit(limit)
  return { leads: data ?? [], count: data?.length ?? 0 }
}

async function execCreateLead(db: ReturnType<typeof getSupabaseServerClient>, companyId: string, input: Record<string, unknown>) {
  const { data, error } = await db
    .from('leads')
    .insert({
      company_id:  companyId,
      name:        input.name,
      phone:       input.phone ?? null,
      empresa:     input.empresa ?? null,
      email:       input.email ?? null,
      stage:       null,
      temperatura: 'morno',
      score:       50,
    })
    .select('id, name, phone, empresa, email')
    .single()

  if (error) throw new Error(error.message)
  return { created: true, lead: data }
}

async function execGetProjects(db: ReturnType<typeof getSupabaseServerClient>, companyId: string) {
  const { data } = await db
    .from('projects')
    .select('id, name, type, description, goal, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20)
  return { projects: data ?? [], count: data?.length ?? 0 }
}

async function execCreateProject(db: ReturnType<typeof getSupabaseServerClient>, companyId: string, input: Record<string, unknown>) {
  const { data, error } = await db
    .from('projects')
    .insert({
      company_id:  companyId,
      name:        input.name,
      type:        input.type ?? 'operacao',
      description: input.description ?? '',
      goal:        input.goal ?? null,
    })
    .select('id, name, type, description, goal')
    .single()

  if (error) throw new Error(error.message)
  return { created: true, project: data, navigate: `/dashboard/projects/${data.id}` }
}

async function execCreateTask(db: ReturnType<typeof getSupabaseServerClient>, companyId: string, input: Record<string, unknown>) {
  const { data: proj } = await db
    .from('projects')
    .select('id')
    .eq('id', input.project_id as string)
    .eq('company_id', companyId)
    .single()

  if (!proj) throw new Error('Projeto não encontrado')

  const { data: tasks } = await db
    .from('project_tasks')
    .select('position')
    .eq('project_id', input.project_id as string)
    .order('position', { ascending: false })
    .limit(1)

  const position = ((tasks?.[0]?.position ?? -1) as number) + 1

  const { data, error } = await db
    .from('project_tasks')
    .insert({
      project_id:  input.project_id,
      company_id:  companyId,
      title:       input.title,
      description: input.description ?? null,
      priority:    input.priority ?? 'medium',
      status:      input.status ?? 'todo',
      position,
    })
    .select('id, title, priority, status')
    .single()

  if (error) throw new Error(error.message)
  return { created: true, task: data }
}

async function execGetFinancial(db: ReturnType<typeof getSupabaseServerClient>, companyId: string) {
  const [invR, chargesR] = await Promise.all([
    db.from('invoices')
      .select('amount, status')
      .eq('company_id', companyId)
      .limit(200),
    db.from('collection_charges')
      .select('amount, status')
      .eq('company_id', companyId)
      .limit(200),
  ])

  const invoices = invR.data ?? []
  const charges  = chargesR.data ?? []

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s: number, i) => s + (i.amount ?? 0), 0)
  const pending      = charges.filter(c => c.status === 'pending').reduce((s: number, c) => s + (c.amount ?? 0), 0)
  const overdue      = charges.filter(c => c.status === 'overdue').reduce((s: number, c) => s + (c.amount ?? 0), 0)

  return {
    revenue_received:  totalRevenue / 100,
    pending_amount:    pending / 100,
    overdue_amount:    overdue / 100,
    total_invoices:    invoices.length,
    pending_charges:   charges.filter(c => c.status === 'pending').length,
  }
}

async function execGetRecentActivity(db: ReturnType<typeof getSupabaseServerClient>, companyId: string, input: Record<string, unknown>) {
  const limit = typeof input.limit === 'number' ? input.limit : 10
  const { data } = await db
    .from('seller_events')
    .select('tipo, canal, conteudo, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { events: data ?? [], count: data?.length ?? 0 }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json() as { message: string; history?: Array<{ role: string; content: string }> }
    if (!body.message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const db        = getSupabaseServerClient()
    const companyId = ctx.company.id
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `Você é o NEXUS Engine — o núcleo de inteligência operacional da empresa.
Você pode executar ações reais: criar leads, projetos, tarefas, buscar dados financeiros e de pipeline.

REGRAS:
- Sempre use ferramentas quando o usuário pedir para criar, buscar ou executar algo
- Após executar ferramentas, confirme o que foi feito de forma clara e direta
- Se criar algo, navegue para o local correto usando navigate_to
- Responda em português brasileiro, de forma executiva e direta
- Quando buscar dados, apresente de forma organizada com números reais
- Jamais diga que não pode fazer algo sem tentar a ferramenta correspondente

Dados do contexto: company_id = ${companyId}`

    // Build message history
    const messages: Anthropic.MessageParam[] = []

    if (body.history?.length) {
      for (const h of body.history.slice(-6)) {
        messages.push({
          role:    h.role as 'user' | 'assistant',
          content: h.content,
        })
      }
    }

    messages.push({ role: 'user', content: body.message })

    // Agentic loop — max 5 iterations
    let response: Anthropic.Message | null = null
    const actionsExecuted: Array<{ tool: string; result: unknown }> = []
    let navigateTo: string | null = null

    for (let i = 0; i < 5; i++) {
      response = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 2048,
        system:     systemPrompt,
        tools:      TOOLS,
        messages,
      })

      if (response.stop_reason !== 'tool_use') break

      // Process tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        const input = block.input as Record<string, unknown>
        let result: unknown

        try {
          switch (block.name) {
            case 'get_business_overview':
              result = await execGetBusinessOverview(db, companyId)
              break
            case 'get_leads':
              result = await execGetLeads(db, companyId, input)
              break
            case 'create_lead':
              result = await execCreateLead(db, companyId, input)
              actionsExecuted.push({ tool: 'create_lead', result })
              break
            case 'get_projects':
              result = await execGetProjects(db, companyId)
              break
            case 'create_project':
              result = await execCreateProject(db, companyId, input)
              actionsExecuted.push({ tool: 'create_project', result })
              if ((result as { navigate?: string }).navigate) navigateTo = (result as { navigate: string }).navigate
              break
            case 'create_task':
              result = await execCreateTask(db, companyId, input)
              actionsExecuted.push({ tool: 'create_task', result })
              break
            case 'get_financial_summary':
              result = await execGetFinancial(db, companyId)
              break
            case 'get_recent_activity':
              result = await execGetRecentActivity(db, companyId, input)
              break
            case 'navigate_to':
              navigateTo = input.path as string
              result = { navigating: true, path: input.path, label: input.label }
              break
            default:
              result = { error: 'Tool not found' }
          }
        } catch (err) {
          result = { error: String(err) }
        }

        toolResults.push({
          type:       'tool_result',
          tool_use_id: block.id,
          content:    JSON.stringify(result),
        })
      }

      // Add assistant turn + tool results to messages
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
    }

    // Extract final text
    const textBlock = response?.content?.find(b => b.type === 'text')
    const message   = textBlock?.type === 'text' ? textBlock.text : 'Ação executada.'

    return NextResponse.json({
      message,
      actions_executed: actionsExecuted,
      navigate_to: navigateTo,
    })
  } catch (err) {
    console.error('[nexus/engine]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
