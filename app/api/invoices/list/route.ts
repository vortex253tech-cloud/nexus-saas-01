import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params   = req.nextUrl.searchParams
  const company_id  = params.get('company_id')
  const status      = params.get('status')       // pending | paid | overdue | all
  const customer_id = params.get('customer_id')

  if (!company_id) return NextResponse.json({ error: 'company_id obrigatório' }, { status: 400 })

  const db = getSupabaseServerClient()

  let query = db
    .from('invoices')
    .select(`*, customers(id, name, email, phone)`)
    .eq('company_id', company_id)
    .order('due_date', { ascending: true })

  if (status && status !== 'all') query = query.eq('status', status)
  if (customer_id) query = query.eq('customer_id', customer_id)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const invoices = data ?? []

  // Summary metrics
  const summary = {
    total_pending:  invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0),
    total_overdue:  invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
    total_paid:     invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    count_pending:  invoices.filter(i => i.status === 'pending').length,
    count_overdue:  invoices.filter(i => i.status === 'overdue').length,
    count_paid:     invoices.filter(i => i.status === 'paid').length,
  }

  return NextResponse.json({ invoices, summary })
}
