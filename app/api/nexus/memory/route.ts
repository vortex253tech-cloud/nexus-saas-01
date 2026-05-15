// /api/nexus/memory — AI Memory (global learning per company)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── GET: load AI memory ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const { data, error } = await db()
    .from('nexus_memory')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ memory: data })
}

// ── POST: update AI memory ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { company_id, ...fields } = body
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const allowed = [
    'fatos', 'padrao_leads', 'melhores_abordagens', 'objecoes_comuns',
    'horarios_pico', 'taxa_resposta', 'taxa_conversao', 'notas',
  ]

  const payload: Record<string, unknown> = { company_id, updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in fields) payload[key] = fields[key]
  }

  const supabase = db()

  // Check if row exists
  const { data: existing } = await supabase
    .from('nexus_memory')
    .select('id')
    .eq('company_id', company_id as string)
    .maybeSingle()

  let data, error
  if (existing?.id) {
    ;({ data, error } = await supabase
      .from('nexus_memory')
      .update(payload)
      .eq('company_id', company_id as string)
      .select()
      .single())
  } else {
    ;({ data, error } = await supabase
      .from('nexus_memory')
      .insert(payload)
      .select()
      .single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, memory: data })
}
