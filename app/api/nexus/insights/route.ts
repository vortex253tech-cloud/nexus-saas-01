// GET /api/nexus/insights — AI-powered business intelligence
// Analyzes pipeline, leads, and activity to surface actionable insights

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
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export interface Insight {
  id:         string
  title:      string
  body:       string
  action:     string
  actionHref: string
  severity:   'critical' | 'warning' | 'opportunity' | 'success'
  metric?:    { label: string; value: string }
}

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const supabase  = db()
  const todayStr  = new Date().toISOString().split('T')[0]
  const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString()

  const [leadsRes, stagesRes, msgsRes, eventsRes, personaRes] = await Promise.all([
    supabase.from('leads')
      .select('id, name, stage, temperatura, score, empresa, created_at, updated_at')
      .eq('company_id', companyId)
      .order('score', { ascending: false }),

    supabase.from('pipeline_stages')
      .select('id, nome, posicao, tipo')
      .eq('company_id', companyId)
      .order('posicao'),

    supabase.from('whatsapp_messages')
      .select('id, direction, created_at')
      .eq('company_id', companyId)
      .gte('created_at', weekAgo),

    supabase.from('seller_events')
      .select('tipo, canal, conteudo, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase.from('ai_personas')
      .select('nome, objetivo, nicho, is_active')
      .eq('company_id', companyId)
      .maybeSingle(),
  ])

  const leads   = leadsRes.data  ?? []
  const stages  = stagesRes.data ?? []
  const msgs    = msgsRes.data   ?? []
  const events  = eventsRes.data ?? []
  const persona = personaRes.data

  // Build compact data snapshot for GPT
  const stageMap = Object.fromEntries(stages.map(s => [s.id, s.nome]))
  const stageCounts: Record<string, number> = {}
  for (const s of stages) stageCounts[s.nome] = 0
  for (const l of leads) {
    const sname = stageMap[l.stage] ?? l.stage
    stageCounts[sname] = (stageCounts[sname] ?? 0) + 1
  }

  const hotLeads    = leads.filter(l => l.temperatura === 'quente' || l.temperatura === 'urgente')
  const coldLeads   = leads.filter(l => l.temperatura === 'frio')
  const newToday    = leads.filter(l => l.created_at?.startsWith(todayStr))
  const outgoing    = msgs.filter(m => m.direction === 'outgoing')
  const closedStage = stages.find(s => s.tipo === 'fechado' || s.nome.toLowerCase().includes('fechado'))
  const closedCount = closedStage ? (stageCounts[closedStage.nome] ?? 0) : 0
  const convRate    = leads.length > 0 ? ((closedCount / leads.length) * 100).toFixed(1) : '0'

  const snapshot = {
    ai: { active: persona?.is_active ?? false, objetivo: persona?.objetivo, nicho: persona?.nicho },
    pipeline: {
      total:      leads.length,
      hot:        hotLeads.length,
      cold:       coldLeads.length,
      closed:     closedCount,
      newToday:   newToday.length,
      convRate:   `${convRate}%`,
      stageCounts,
    },
    messages: {
      weekTotal: msgs.length,
      outgoing:  outgoing.length,
    },
    recentEvents: events.slice(0, 5).map(e => e.conteudo),
  }

  // Ask GPT for insights
  const openai = ai()
  let insights: Insight[] = []

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.4,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Você é um analista de negócios especialista em CRM, vendas e IA.
Analise os dados do pipeline de vendas e retorne exatamente 4 insights acionáveis em JSON.
Seja direto, específico e use os números reais dos dados. Responda em português brasileiro.

Retorne SOMENTE este JSON:
{
  "insights": [
    {
      "id": "string único",
      "title": "título curto (max 6 palavras)",
      "body": "análise específica com números (max 2 frases)",
      "action": "ação concreta (max 5 palavras)",
      "actionHref": "/dashboard/leads ou /dashboard/nexus ou /dashboard/messages",
      "severity": "critical|warning|opportunity|success",
      "metric": { "label": "nome da métrica", "value": "valor com unidade" }
    }
  ]
}

Regras de severity:
- critical: taxa de conversão < 10%, leads quentes sem resposta, IA desativada
- warning: leads esfriando, inatividade > 3 dias, mensagens baixas
- opportunity: leads quentes disponíveis, pipeline cheio, momento de follow-up
- success: bom volume de leads, taxa de conversão saudável, IA ativa e operando`,
        },
        {
          role: 'user',
          content: `Dados do pipeline:\n${JSON.stringify(snapshot, null, 2)}`,
        },
      ],
    })

    const raw = JSON.parse(completion.choices[0].message.content ?? '{}')
    insights = (raw.insights ?? []).slice(0, 4)
  } catch {
    // Fallback: rule-based insights if OpenAI fails
    insights = buildFallbackInsights(snapshot)
  }

  return NextResponse.json({ insights, generatedAt: new Date().toISOString() })
}

function buildFallbackInsights(snap: {
  ai: { active: boolean; objetivo?: string; nicho?: string | null }
  pipeline: { total: number; hot: number; cold: number; closed: number; newToday: number; convRate: string; stageCounts: Record<string, number> }
  messages: { weekTotal: number; outgoing: number }
  recentEvents: string[]
}): Insight[] {
  const out: Insight[] = []
  const p = snap.pipeline

  if (!snap.ai.active) {
    out.push({
      id: 'ai-off', title: 'IA desativada', severity: 'critical',
      body: 'A NEXUS IA está pausada e não está respondendo leads automaticamente.',
      action: 'Ativar IA', actionHref: '/dashboard/nexus',
      metric: { label: 'Status', value: 'Pausada' },
    })
  }

  if (p.hot > 0) {
    out.push({
      id: 'hot-leads', title: `${p.hot} leads quentes`, severity: 'opportunity',
      body: `Você tem ${p.hot} leads quentes no pipeline. É o melhor momento para acionar follow-up.`,
      action: 'Ver leads quentes', actionHref: '/dashboard/leads',
      metric: { label: 'Quentes', value: String(p.hot) },
    })
  }

  if (p.total > 0) {
    out.push({
      id: 'conv-rate', title: 'Taxa de conversão', severity: parseFloat(p.convRate) < 10 ? 'warning' : 'success',
      body: `Taxa de conversão atual: ${p.convRate}. Total de ${p.total} leads no pipeline, ${p.closed} fechados.`,
      action: 'Ver pipeline', actionHref: '/dashboard/leads',
      metric: { label: 'Conversão', value: p.convRate },
    })
  }

  if (snap.messages.weekTotal < 10) {
    out.push({
      id: 'low-msgs', title: 'Mensagens baixas', severity: 'warning',
      body: `Apenas ${snap.messages.weekTotal} mensagens enviadas esta semana. Active a IA para aumentar o engajamento.`,
      action: 'Ativar automações', actionHref: '/dashboard/nexus',
      metric: { label: 'Mensagens/sem', value: String(snap.messages.weekTotal) },
    })
  }

  return out.slice(0, 4)
}
