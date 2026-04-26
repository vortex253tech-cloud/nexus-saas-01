// GET  /api/projects/[id]/expenses — list expenses
// POST /api/projects/[id]/expenses — create expense

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
    .from('project_expenses')
    .select('id, name, value, category, date, created_at')
    .eq('project_id', id)
    .eq('company_id', ctx.company.id)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    name?: string; value?: number; category?: string; date?: string
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('project_expenses')
    .insert({
      project_id: id,
      company_id: ctx.company.id,
      name:       body.name.trim(),
      value:      body.value    ?? 0,
      category:   body.category ?? 'other',
      date:       body.date     ?? new Date().toISOString().slice(0, 10),
    })
    .select('id, name, value, category, date')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data }, { status: 201 })
}
