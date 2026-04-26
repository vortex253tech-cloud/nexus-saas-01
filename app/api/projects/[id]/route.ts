// GET    /api/projects/[id]  — get single project with all data
// PATCH  /api/projects/[id]  — update project
// DELETE /api/projects/[id]  — delete project

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
    .from('projects')
    .select(`
      id, name, type, description, goal, created_at,
      products:project_products(id, name, price, cost, margin, status, created_at),
      revenues:project_revenues(id, name, value, source, date, created_at),
      expenses:project_expenses(id, name, value, category, date, created_at)
    `)
    .eq('id', id)
    .eq('company_id', ctx.company.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
  return NextResponse.json({ project: data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const db   = getSupabaseServerClient()

  const { error } = await db
    .from('projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
