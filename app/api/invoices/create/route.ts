import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { company_id, customer_id, amount, description, due_date, payment_link } = await req.json()

    if (!company_id || !customer_id || !amount || !due_date) {
      return NextResponse.json({ error: 'company_id, customer_id, amount e due_date são obrigatórios' }, { status: 400 })
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'amount deve ser um número positivo' }, { status: 400 })
    }

    const db = getSupabaseServerClient()

    // Auto-detect overdue on creation
    const today = new Date().toISOString().split('T')[0]
    const status = due_date < today ? 'overdue' : 'pending'

    const { data, error } = await db
      .from('invoices')
      .insert({
        company_id,
        customer_id,
        amount: Number(amount),
        description: description ?? null,
        due_date,
        status,
        payment_link: payment_link ?? null,
      })
      .select(`*, customers(name, email, phone)`)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ invoice: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
