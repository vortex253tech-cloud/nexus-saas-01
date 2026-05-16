// GET /api/nexus/overview — single endpoint for NEXUS command center
// Returns everything the dashboard needs in one round-trip

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const supabase = db()
  const todayStr = new Date().toISOString().split('T')[0]

  const [personaRes, eventsRes, leadsRes, stagesRes, msgTodayRes, leadTodayRes] = await Promise.all([
    supabase.from('ai_personas')
      .select('nome, tom, objetivo, nicho, instrucoes, saudacao, is_active')
      .eq('company_id', companyId)
      .maybeSingle(),

    supabase.from('seller_events')
      .select('tipo, canal, conteudo, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(15),

    supabase.from('leads')
      .select('id, name, stage, temperatura, score, empresa, phone')
      .eq('company_id', companyId)
      .order('score', { ascending: false }),

    supabase.from('pipeline_stages')
      .select('id, nome, cor, posicao, tipo')
      .eq('company_id', companyId)
      .order('posicao'),

    supabase.from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('direction', 'outgoing')
      .gte('created_at', todayStr + 'T00:00:00'),

    supabase.from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', todayStr + 'T00:00:00'),
  ])

  const leads  = leadsRes.data  ?? []
  const stages = stagesRes.data ?? []

  // Stage → lead slug mapping
  const SLUG: Record<string, string> = {
    'novo lead':   'novo',
    'contatado':   'contatado',
    'qualificado': 'qualificado',
    'proposta':    'proposta',
    'negociando':  'negociando',
    'fechado':     'fechado',
    'perdido':     'perdido',
  }

  const pipelineStages = stages.map(s => {
    const slug  = SLUG[s.nome.toLowerCase()] ?? s.nome.toLowerCase()
    const count = leads.filter(l => l.stage === slug || l.stage === s.nome).length
    return { id: s.id, nome: s.nome, cor: s.cor, posicao: s.posicao, tipo: s.tipo, count }
  })

  const hotLeads    = leads.filter(l => l.temperatura === 'quente' || l.temperatura === 'urgente')
  const totalLeads  = leads.length
  const closedLeads = leads.filter(l => l.stage === 'fechado').length

  return NextResponse.json({
    ai: {
      active:    personaRes.data?.is_active ?? false,
      nome:      personaRes.data?.nome      ?? 'NEXUS AI',
      tom:       personaRes.data?.tom       ?? 'profissional',
      objetivo:  personaRes.data?.objetivo  ?? 'converter',
      nicho:     personaRes.data?.nicho     ?? null,
      instrucoes: personaRes.data?.instrucoes ?? null,
      saudacao:  personaRes.data?.saudacao  ?? null,
    },
    today: {
      mensagens:   msgTodayRes.count  ?? 0,
      leads_novos: leadTodayRes.count ?? 0,
    },
    pipeline: {
      total:  totalLeads,
      hot:    hotLeads.length,
      closed: closedLeads,
      stages: pipelineStages,
      leads:  leads.slice(0, 20),
    },
    events: eventsRes.data ?? [],
  })
}
