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
    .select('id, name, type, description, goal, company_id')
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
  const goalLine  = project.goal ? `Meta de receita: R$ ${Number(project.goal).toLocaleString('pt-BR')}` : ''

  const prompt = `Você é especialista em gestão de projetos operacionais para empresas digitais.

Projeto: "${project.name}"
Tipo: ${typeLabel}
${project.description ? `Objetivo: ${project.description}` : ''}
${goalLine}

Crie entre 10 e 14 tarefas essenciais para este projeto, cobrindo todo o ciclo operacional.
As tarefas devem:
- Ser práticas, acionáveis e específicas (não genéricas)
- Cobrir fases distintas: planejamento → execução → otimização → escala
- Ter mix de prioridades (2-3 urgentes, 4-5 high, 3-4 medium, 1-2 low)
- Ter descrições detalhadas e úteis (20-50 palavras cada)
- Ser ordenadas logicamente

Para tipo "${typeLabel}", inclua especificamente tarefas relacionadas a:
${getTypeSpecificInstructions(project.type)}

Responda APENAS com um JSON array válido, sem texto adicional:
[
  {
    "title": "...",
    "description": "...",
    "priority": "urgent|high|medium|low",
    "status": "todo"
  }
]`

  try {
    const res = await ai.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw   = res.content[0].type === 'text' ? res.content[0].text : '[]'
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

function getTypeSpecificInstructions(type: string): string {
  const map: Record<string, string> = {
    lancamento: 'copy de vendas, página de vendas, CPL (Conteúdo de Pré-Lançamento), remarketing, sequência de e-mails, checkout e upsell, métricas de conversão',
    produto:    'definição de MVP, roadmap de features, testes com usuários, documentação técnica, lançamento beta, métricas de produto',
    marketing:  'criação de criativos, segmentação de público, calendário editorial, A/B testing, análise de concorrência, métricas de campanha',
    automacao:  'mapeamento de fluxos atuais, ferramentas de automação, integração de sistemas, testes de fluxo, documentação, treinamento da equipe',
    crm:        'configuração do CRM, importação de contatos, funil de vendas, sequências de follow-up, relatórios de pipeline, treinamento de SDRs',
    trafego:    'estrutura de campanhas, criativos por etapa do funil, pixels e rastreamento, otimização de lances, relatórios de ROAS, escala de campanhas',
    conteudo:   'calendário editorial, produção de roteiros, gravação e edição, distribuição multicanal, análise de engajamento, reaproveitamento de conteúdo',
    operacao:   'mapeamento de processos, definição de KPIs, SOPs (procedimentos), treinamentos, ferramentas operacionais, relatórios de performance',
    servico:    'onboarding do cliente, cronograma de entrega, checkpoints de qualidade, documentação do projeto, relatórios de progresso, pesquisa de satisfação',
    interno:    'definição de objetivos, cronograma, alocação de recursos, reuniões de alinhamento, documentação, revisão de resultados',
  }
  return map[type] ?? 'planejamento estratégico, execução, monitoramento e otimização de resultados'
}
