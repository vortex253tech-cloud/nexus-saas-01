// GET  /api/flow-templates        — list public templates
// POST /api/flow-templates        — save flow as template

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const tier     = searchParams.get('tier')

  const db = getSupabaseServerClient()
  let query = db
    .from('flow_templates')
    .select('id, name, description, category, icon, color, tier, usage_count, rating, rating_count, created_at')
    .eq('is_public', true)
    .order('usage_count', { ascending: false })

  if (category && category !== 'all') query = query.eq('category', category)
  if (tier     && tier     !== 'all') query = query.eq('tier', tier)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    name?: string; description?: string; category?: string
    icon?: string; color?: string; nodes?: unknown[]; edges?: unknown[]
  }
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!body.nodes?.length) return NextResponse.json({ error: 'Fluxo não pode ser vazio' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { data, error } = await db.from('flow_templates').insert({
    name:        body.name.trim(),
    description: body.description?.trim() ?? '',
    category:    body.category ?? 'general',
    icon:        body.icon ?? '🤖',
    color:       body.color ?? 'violet',
    nodes:       body.nodes,
    edges:       body.edges ?? [],
    created_by:  ctx.company.id,
    is_public:   true,
    tier:        'free',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
