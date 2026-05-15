// POST /api/nexus/diagnostic — Operational Diagnostic Engine
// Scores: acquisition, conversion, automation, retention, operational
// Returns: gargalos, recomendações, risco, potencial de crescimento

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function ai() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, timeout: 20000 })
}

// ── GET: last diagnostic ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const { data, error } = await db()
    .from('diagnostic_scores')
    .select('*')
    .eq('company_id', companyId)
    .order('data', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ diagnostics: data ?? [] })
}

// ── POST: run diagnostic ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { company_id: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { company_id } = body
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const supabase = db()

  // Fetch real data
  const [leadsRes, tasksRes, eventsRes, personaRes, memoryRes] = await Promise.all([
    supabase.from('leads').select('score, temperatura, stage, canal, created_at').eq('company_id', company_id),
    supabase.from('ai_tasks').select('status, tipo').eq('company_id', company_id),
    supabase.from('seller_events').select('tipo, created_at').eq('company_id', company_id).order('created_at', { ascending: false }).limit(100),
    supabase.from('ai_personas').select('is_active, objetivo').eq('company_id', company_id).maybeSingle(),
    supabase.from('ai_memory').select('taxa_conversao, taxa_resposta').eq('company_id', company_id).maybeSingle(),
  ])

  const leads   = leadsRes.data   ?? []
  const tasks   = tasksRes.data   ?? []
  const events  = eventsRes.data  ?? []
  const persona = personaRes.data
  const memory  = memoryRes.data

  // Compute raw metrics
  const totalLeads      = leads.length
  const hotLeads        = leads.filter(l => l.temperatura === 'quente' || l.temperatura === 'urgente').length
  const closedLeads     = leads.filter(l => l.stage === 'fechado').length
  const avgScore        = totalLeads > 0 ? Math.round(leads.reduce((a, l) => a + (l.score || 0), 0) / totalLeads) : 0
  const convRate        = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0
  const pendingTasks    = tasks.filter(t => t.status === 'pendente').length
  const completedTasks  = tasks.filter(t => t.status === 'concluido').length
  const failedTasks     = tasks.filter(t => t.status === 'falhou').length
  const totalTasks      = tasks.length
  const taskSuccessRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  const hasPersona      = !!persona?.is_active
  const txConversao     = memory?.taxa_conversao ?? convRate
  const txResposta      = memory?.taxa_resposta ?? 0

  // Score calculation
  const scoreAquisicao  = Math.min(100, Math.round(
    (totalLeads > 0 ? 30 : 0) +
    (avgScore > 50 ? 20 : avgScore > 20 ? 10 : 0) +
    (hotLeads > totalLeads * 0.2 ? 30 : hotLeads > 0 ? 15 : 0) +
    (events.length > 10 ? 20 : events.length > 0 ? 10 : 0)
  ))

  const scoreConversao  = Math.min(100, Math.round(
    (txConversao > 20 ? 40 : txConversao > 10 ? 25 : txConversao > 0 ? 10 : 0) +
    (closedLeads > 5 ? 30 : closedLeads > 0 ? 15 : 0) +
    (avgScore > 60 ? 30 : avgScore > 30 ? 15 : 0)
  ))

  const scoreAutomacao  = Math.min(100, Math.round(
    (hasPersona ? 30 : 0) +
    (taskSuccessRate > 80 ? 40 : taskSuccessRate > 40 ? 20 : 0) +
    (completedTasks > 10 ? 30 : completedTasks > 0 ? 15 : 0)
  ))

  const scoreRetencao   = Math.min(100, Math.round(
    (txResposta > 60 ? 40 : txResposta > 30 ? 20 : 0) +
    (leads.filter(l => l.stage === 'negociando').length > 0 ? 30 : 0) +
    (txConversao > 15 ? 30 : 0)
  ))

  const scoreOperacional = Math.min(100, Math.round(
    (scoreAquisicao + scoreConversao + scoreAutomacao + scoreRetencao) / 4
  ))

  // Identify bottlenecks
  const gargalos: string[] = []
  if (scoreAquisicao < 40)  gargalos.push('Baixo volume de leads qualificados')
  if (scoreConversao < 40)  gargalos.push('Taxa de conversão crítica')
  if (scoreAutomacao < 40)  gargalos.push('Automação inexistente ou com falhas')
  if (scoreRetencao < 40)   gargalos.push('Alto churn / baixo engajamento')
  if (failedTasks > 5)      gargalos.push(`${failedTasks} tarefas de IA falhando`)
  if (!hasPersona)          gargalos.push('IA não configurada para a empresa')
  if (pendingTasks > 20)    gargalos.push(`${pendingTasks} follow-ups pendentes acumulados`)

  // Determine risk
  let risco: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' = 'BAIXO'
  if (scoreOperacional < 30) risco = 'CRITICO'
  else if (scoreOperacional < 50) risco = 'ALTO'
  else if (scoreOperacional < 70) risco = 'MEDIO'

  // Dependência operacional em IA
  let dependencia: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA' = 'ALTA'
  if (scoreAutomacao > 70) dependencia = 'BAIXA'
  else if (scoreAutomacao > 40) dependencia = 'MEDIA'

  const perdaEstimada    = gargalos.length * 5000
  const potencialCrescimento = Math.round(((100 - scoreOperacional) / 100) * 50000)

  // AI Recommendations
  let recomendacoes: Array<{ prioridade: string; acao: string; impacto: string }> = []

  try {
    const prompt = `Você é um COO estratégico de IA analisando métricas operacionais.

Dados:
- Total leads: ${totalLeads} | Hot: ${hotLeads} | Fechados: ${closedLeads}
- Score médio: ${avgScore}/100 | Conversão: ${convRate.toFixed(1)}%
- Automação: ${hasPersona ? 'ativa' : 'inativa'} | Tarefas OK: ${completedTasks} | Falhou: ${failedTasks}
- Score Aquisição: ${scoreAquisicao} | Conversão: ${scoreConversao} | Automação: ${scoreAutomacao}
- Risco: ${risco} | Gargalos: ${gargalos.join(', ') || 'Nenhum identificado'}

Gere 3 recomendações estratégicas em JSON (array):
[{"prioridade":"CRÍTICA|ALTA|MÉDIA","acao":"ação específica","impacto":"resultado esperado em 30 dias"}]

Retorne APENAS JSON válido, sem markdown.`

    const completion = await ai().chat.completions.create({
      model:       'gpt-4.1-mini',
      max_tokens:  400,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]'
    recomendacoes = JSON.parse(raw)
  } catch {
    recomendacoes = [
      { prioridade: 'ALTA', acao: 'Configurar IA persona para automatizar follow-ups', impacto: '+30% taxa de resposta' },
      { prioridade: 'ALTA', acao: 'Reativar leads frios com temperatura abaixo de morno', impacto: '+15% conversão' },
      { prioridade: 'MÉDIA', acao: 'Reduzir tempo de resposta para leads quentes (< 5 min)', impacto: '+25% fechamento' },
    ]
  }

  // Upsert diagnostic
  const today = new Date().toISOString().split('T')[0]
  const { data: saved, error: saveErr } = await supabase
    .from('diagnostic_scores')
    .upsert({
      company_id:           company_id,
      data:                 today,
      score_aquisicao:      scoreAquisicao,
      score_conversao:      scoreConversao,
      score_automacao:      scoreAutomacao,
      score_retencao:       scoreRetencao,
      score_operacional:    scoreOperacional,
      dependencia,
      risco,
      perda_estimada:       perdaEstimada,
      potencial_crescimento: potencialCrescimento,
      gargalos,
      recomendacoes,
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'company_id,data', ignoreDuplicates: false })
    .select()
    .single()

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    diagnostic: saved,
    metrics: {
      totalLeads, hotLeads, closedLeads, avgScore,
      convRate: Number(convRate.toFixed(1)),
      taskSuccessRate: Number(taskSuccessRate.toFixed(1)),
      completedTasks, pendingTasks, failedTasks,
    },
  })
}
