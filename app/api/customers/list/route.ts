import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id obrigatório' }, { status: 400 })

  const db = getSupabaseServerClient()

  const { data, error } = await db
    .from('customers')
    .select(`
      *,
      invoices (
        id, amount, status, due_date
      )
    `)
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enriquecer com métricas por cliente
  const enriched = (data ?? []).map((c) => {
    const invoices = (c.invoices ?? []) as Array<{ amount: number; status: string; due_date: string }>
    const total_due     = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + i.amount, 0)
    const total_overdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
    const total_paid    = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
    return { ...c, metrics: { total_due, total_overdue, total_paid, invoice_count: invoices.length } }
  })

  return NextResponse.json({ customers: enriched })
}
