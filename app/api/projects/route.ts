// GET /api/projects        — list projects for company
// POST /api/projects       — create project

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()

  // Projects with aggregated revenue/expense totals
  const { data, error } = await db
    .from('projects')
    .select(`
      id, name, type, description, goal, created_at,
      products:project_products(id, name, price, cost, margin, status),
      revenues:project_revenues(id, value),
      expenses:project_expenses(id, value)
    `)
    .eq('company_id', ctx.company.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const projects = (data ?? []).map(p => {
    const revenues = (p.revenues as { value: number }[] ?? [])
    const expenses = (p.expenses as { value: number }[] ?? [])
    const totalRevenue = revenues.reduce((s, r) => s + r.value, 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.value, 0)
    return {
      ...p,
      totalRevenue,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
    }
  })

  return NextResponse.json({ projects })
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    name?: string; type?: string; description?: string; goal?: string
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('projects')
    .insert({
      company_id:  ctx.company.id,
      name:        body.name.trim(),
      type:        body.type        ?? 'product',
      description: body.description ?? '',
      goal:        body.goal        ?? '',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
