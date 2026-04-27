// POST /api/flow-templates/[id]/import — clone template into user's workspace

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({})) as { name?: string }

  const db = getSupabaseServerClient()

  // Fetch template
  const { data: tpl, error: tplErr } = await db
    .from('flow_templates')
    .select('name, description, nodes, edges, usage_count')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (tplErr || !tpl) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

  const t = tpl as { name: string; description: string; nodes: unknown; edges: unknown; usage_count: number }

  // Create new growth_map from template
  const { data: map, error: mapErr } = await db.from('growth_maps').insert({
    company_id:  ctx.company.id,
    name:        body.name?.trim() || t.name,
    description: t.description,
    nodes:       t.nodes,
    edges:       t.edges,
  }).select('id').single()

  if (mapErr) return NextResponse.json({ error: mapErr.message }, { status: 500 })

  // Increment usage_count (fire-and-forget)
  void db.from('flow_templates').update({ usage_count: t.usage_count + 1 }).eq('id', id)

  return NextResponse.json({ id: (map as { id: string }).id }, { status: 201 })
}
