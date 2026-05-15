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

// ── GET: stages + leads per stage ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const [stagesRes, leadsRes] = await Promise.all([
    db().from('pipeline_stages')
      .select('*')
      .eq('company_id', companyId)
      .order('posicao'),
    db().from('leads')
      .select('id, name, email, phone, stage, temperatura, score, valor_potencial, empresa, canal, created_at')
      .eq('company_id', companyId)
      .order('score', { ascending: false }),
  ])

  if (stagesRes.error) return NextResponse.json({ error: stagesRes.error.message }, { status: 500 })

  const stages = stagesRes.data ?? []
  const leads  = leadsRes.data  ?? []

  // Group leads by stage
  const board = stages.map(stage => ({
    ...stage,
    leads: leads.filter(l => l.stage === stage.nome.toLowerCase().replace(' ', '_') || l.stage === stage.nome),
  }))

  return NextResponse.json({ board, stages, leads })
}

// ── POST: move lead to different stage ────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { company_id: string; lead_id: string; stage: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { company_id, lead_id, stage } = body
  if (!company_id || !lead_id || !stage) {
    return NextResponse.json({ error: 'company_id, lead_id, stage required' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('leads')
    .update({ stage, updated_at: new Date().toISOString() })
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
