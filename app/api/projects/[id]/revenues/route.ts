// GET  /api/projects/[id]/revenues — list revenues
// POST /api/projects/[id]/revenues — create revenue

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('project_revenues')
    .select('id, name, value, source, date, created_at')
    .eq('project_id', id)
    .eq('company_id', ctx.company.id)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ revenues: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    name?: string; value?: number; source?: string; date?: string
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('project_revenues')
    .insert({
      project_id: id,
      company_id: ctx.company.id,
      name:       body.name.trim(),
      value:      body.value  ?? 0,
      source:     body.source ?? 'other',
      date:       body.date   ?? new Date().toISOString().slice(0, 10),
    })
    .select('id, name, value, source, date')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ revenue: data }, { status: 201 })
}
