// POST /api/projects/[id]/ai-setup
// AI generates and creates initial tasks based on project type + description.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data: project } = await db
    .from('projects')
    .select('id, name, type, description, company_id')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const typeLabels: Record<string, string> = {
    lancamento: 'Lançamento de produto/oferta',
    produto:    'Desenvolvimento de produto',
    marketing:  'Campanha de marketing',
    automacao:  'Automação de processos',
    crm:        'Gestão de relacionamento com clientes',
    trafego:    'Tráfego pago e aquisição',
    conteudo:   'Produção de conteúdo',
    operacao:   'Operação e processos internos',
    servico:    'Prestação de serviço',
    interno:    'Projeto interno',
  }

  const typeLabel = typeLabels[project.type] ?? project.type

  const prompt = `Você é especialista em gestão de projetos operacionais para empresas digitais.

Projeto: "${project.name}"
Tipo: ${typeLabel}
${project.description ? `Objetivo: ${project.description}` : ''}

Crie entre 6 e 8 tarefas iniciais essenciais para este projeto.
As tarefas devem ser:
- Práticas, acionáveis e específicas
- Ordenadas logicamente (do início ao fim)
- Cobrir as etapas mais críticas do tipo de projeto

Responda APENAS com um JSON array válido, sem texto adicional:
[
  {"title": "...", "description": "...", "priority": "high|medium|low", "status": "todo"},
  ...
]`

  try {
    const res = await ai.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1200,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text : '[]'
    const match = raw.match(/\[[\s\S]*\]/)

    type RawTask = { title?: string; description?: string; priority?: string; status?: string }
    const suggested: RawTask[] = match ? JSON.parse(match[0]) : []

    const created = []
    for (let i = 0; i < suggested.length; i++) {
      const t = suggested[i]
      if (!t.title?.trim()) continue
      const { data } = await db
        .from('project_tasks')
        .insert({
          project_id:  id,
          company_id:  project.company_id,
          title:       t.title.trim(),
          description: t.description ?? null,
          status:      t.status    ?? 'todo',
          priority:    t.priority  ?? 'medium',
          position:    i,
        })
        .select()
        .single()
      if (data) created.push(data)
    }

    return NextResponse.json({ tasks: created, count: created.length })
  } catch (err) {
    console.error('[ai-setup] error', err)
    return NextResponse.json({ error: 'AI setup failed', tasks: [], count: 0 }, { status: 500 })
  }
}
