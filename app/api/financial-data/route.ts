// GET /api/financial-data?company_id=...
// POST /api/financial-data  { company_id, revenue, costs, profit, period_label, period_date }

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('financial_data')
    .select()
    .eq('company_id', company_id)
    .order('period_date', { ascending: false })
    .limit(24)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { company_id, revenue, costs, profit, period_label, period_date, note } = body as {
    company_id: string
    revenue: number
    costs: number
    profit: number
    period_label: string
    period_date: string
    note?: string
  }

  if (!company_id || revenue == null || costs == null || profit == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('financial_data')
    .insert({ company_id, revenue, costs, profit, period_label, period_date, note: note ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { error } = await db.from('financial_data').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
