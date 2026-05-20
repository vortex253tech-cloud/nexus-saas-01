// POST /api/projects/[id]/copilot
// NEXUS Copilot — AI chat for project management.
// Can answer questions, create tasks, and give strategic advice.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface HistoryItem { role: 'user' | 'assistant'; content: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history = [] }: { message: string; history?: HistoryItem[] } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const db = getSupabaseServerClient()

  const [{ data: project }, { data: tasks }] = await Promise.all([
    db.from('projects').select('*').eq('id', id).single(),
    db.from('project_tasks').select('*').eq('project_id', id).order('position'),
  ])

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const taskSummary = tasks?.length
    ? tasks.map(t => `  • [${t.status}] [${t.priority}] ${t.title}`).join('\n')
    : '  (sem tarefas ainda)'

  const system = `Você é o NEXUS Copilot, assistente operacional de IA integrado ao projeto "${project.name}".

CONTEXTO DO PROJETO:
- Nome: ${project.name}
- Tipo: ${project.type}
- Descrição: ${project.description ?? 'N/A'}
- Tarefas (${tasks?.length ?? 0} total):
${taskSummary}

SUAS CAPACIDADES:
1. Responder perguntas sobre o projeto
2. Analisar progresso e identificar riscos
3. Sugerir próximas ações
4. Criar tarefas automaticamente (use o bloco <tasks> abaixo)
5. Reorganizar prioridades
6. Gerar ideias e estratégias

PARA CRIAR TAREFAS — inclua no final da resposta:
<tasks>
[{"title": "...", "description": "...", "priority": "high|medium|low|urgent", "status": "todo"}]
</tasks>

REGRAS:
- Responda em português, de forma direta e operacional
- Seja específico, não genérico
- Se criar tarefas, confirme o que criou
- Máximo 3 parágrafos por resposta (seja conciso)`

  try {
    const messages: Anthropic.MessageParam[] = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const res = await ai.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages,
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text : ''

    // Parse + create tasks if AI requested
    const taskMatch = raw.match(/<tasks>([\s\S]*?)<\/tasks>/)
    const createdTasks: unknown[] = []

    if (taskMatch) {
      try {
        type RawTask = { title?: string; description?: string; priority?: string; status?: string }
        const suggested: RawTask[] = JSON.parse(taskMatch[1])
        for (const t of suggested) {
          if (!t.title?.trim()) continue
          const { data } = await db
            .from('project_tasks')
            .insert({
              project_id:  id,
              company_id:  project.company_id,
              title:       t.title.trim(),
              description: t.description ?? null,
              status:      t.status   ?? 'todo',
              priority:    t.priority ?? 'medium',
              position:    (tasks?.length ?? 0) + createdTasks.length,
            })
            .select()
            .single()
          if (data) createdTasks.push(data)
        }
      } catch { /* ignore parse errors */ }
    }

    const cleanText = raw.replace(/<tasks>[\s\S]*?<\/tasks>/g, '').trim()

    return NextResponse.json({
      message:       cleanText,
      tasks_created: createdTasks,
    })
  } catch (err) {
    console.error('[copilot] error', err)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 })
  }
}
