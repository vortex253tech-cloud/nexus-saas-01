// GET  /api/growth-maps  — list maps
// POST /api/growth-maps  — create map

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }        from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { GROWTH_TEMPLATES }      from '@/lib/growth-map-engine'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('growth_maps')
    .select('id, name, description, status, last_executed_at, created_at, updated_at')
    .eq('company_id', ctx.company.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ maps: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    name?: string; description?: string; templateKey?: string
  }
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const template = body.templateKey ? GROWTH_TEMPLATES[body.templateKey] : null

  const db = getSupabaseServerClient()
  const { data, error } = await db.from('growth_maps').insert({
    company_id:  ctx.company.id,
    name:        body.name.trim(),
    description: body.description ?? template?.description ?? '',
    nodes:       template?.nodes ?? [],
    edges:       template?.edges ?? [],
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
