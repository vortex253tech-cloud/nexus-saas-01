// /api/nexus/pipeline — Pipeline (Kanban stages) + lead movement
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Stage name → lead.stage slug mapping (handles both directions)
const STAGE_SLUG: Record<string, string> = {
  'novo lead':   'novo',
  'contatado':   'contatado',
  'qualificado': 'qualificado',
  'proposta':    'proposta',
  'negociando':  'negociando',
  'fechado':     'fechado',
  'perdido':     'perdido',
}

// ── GET: stages with nested leads ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const [stagesRes, leadsRes] = await Promise.all([
    db().from('pipeline_stages')
      .select('id, nome, cor, posicao, tipo')
      .eq('company_id', companyId)
      .order('posicao'),
    db().from('leads')
      .select('id, name, phone, empresa, nicho, stage, temperatura, score, canal, updated_at')
      .eq('company_id', companyId)
      .order('score', { ascending: false }),
  ])

  if (stagesRes.error) return NextResponse.json({ error: stagesRes.error.message }, { status: 500 })

  const rawStages = stagesRes.data ?? []
  const leads     = leadsRes.data  ?? []

  // Match leads to their stage (by slug or by nome)
  const stages = rawStages.map(stage => {
    const slug = STAGE_SLUG[stage.nome.toLowerCase()] ?? stage.nome.toLowerCase()
    return {
      ...stage,
      leads: leads.filter(l =>
        l.stage === slug ||
        l.stage === stage.nome.toLowerCase() ||
        l.stage === stage.nome
      ),
    }
  })

  return NextResponse.json({ stages })
}

// ── POST: move lead to different stage ────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { company_id: string; lead_id: string; stage_id?: string; stage?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { company_id, lead_id, stage_id, stage: stageName } = body
  if (!company_id || !lead_id) {
    return NextResponse.json({ error: 'company_id and lead_id required' }, { status: 400 })
  }

  let targetSlug = stageName

  // If stage_id given, look up its name → convert to slug
  if (stage_id && !stageName) {
    const { data: stageRow } = await db()
      .from('pipeline_stages')
      .select('nome')
      .eq('id', stage_id)
      .eq('company_id', company_id)
      .maybeSingle()

    if (!stageRow) return NextResponse.json({ error: 'stage not found' }, { status: 404 })
    targetSlug = STAGE_SLUG[stageRow.nome.toLowerCase()] ?? stageRow.nome.toLowerCase()
  }

  if (!targetSlug) return NextResponse.json({ error: 'stage or stage_id required' }, { status: 400 })

  const { data, error } = await db()
    .from('leads')
    .update({ stage: targetSlug, updated_at: new Date().toISOString() })
    .eq('id', lead_id)
    .eq('company_id', company_id)
    .select('id, stage')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, lead: data })
}

// ── PUT: update stage configuration ──────────────────────────────────────

export async function PUT(req: NextRequest) {
  let body: { company_id: string; stage_id: string; nome?: string; cor?: string; posicao?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { company_id, stage_id, ...fields } = body
  if (!company_id || !stage_id) {
    return NextResponse.json({ error: 'company_id and stage_id required' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('pipeline_stages')
    .update(fields)
    .eq('id', stage_id)
    .eq('company_id', company_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, stage: data })
}
