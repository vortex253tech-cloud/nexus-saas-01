import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type CustomerInvoice = {
  id: string
  amount: number | string
  status: string
  due_date: string
}

type CustomerRow = {
  id: string
  company_id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  invoices: CustomerInvoice[] | null
}

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id obrigatorio' }, { status: 400 })

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
    .returns<CustomerRow[]>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (data ?? []).map((customer) => {
    const invoices = Array.isArray(customer.invoices) ? customer.invoices : []
    const total_due = invoices
      .filter(invoice => invoice.status !== 'paid' && invoice.status !== 'cancelled')
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0)
    const total_overdue = invoices
      .filter(invoice => invoice.status === 'overdue')
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0)
    const total_paid = invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0)

    return {
      ...customer,
      invoices,
      metrics: { total_due, total_overdue, total_paid, invoice_count: invoices.length },
    }
  })

  return NextResponse.json({ customers: enriched })
}
