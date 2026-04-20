import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { invoice_id, amount, method, notes, paid_at } = await req.json()

    if (!invoice_id || !amount) {
      return NextResponse.json({ error: 'invoice_id e amount são obrigatórios' }, { status: 400 })
    }

    const db = getSupabaseServerClient()

    // Fetch invoice
    const { data: invoice, error: fetchErr } = await db
      .from('invoices')
      .select('id, company_id, amount, status, customers(name)')
      .eq('id', invoice_id)
      .single()

    if (fetchErr || !invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Fatura já foi paga' }, { status: 400 })
    }

    // Register payment
    const { data: payment, error: payErr } = await db
      .from('payments')
      .insert({
        invoice_id,
        company_id: invoice.company_id,
        amount: Number(amount),
        method: method ?? 'manual',
        notes: notes ?? null,
        paid_at: paid_at ?? new Date().toISOString(),
      })
      .select()
      .single()

    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })

    // Mark invoice as paid
    await db.from('invoices').update({ status: 'paid' }).eq('id', invoice_id)

    // Update company ganho_acumulado
    try {
      await db.rpc('increment_ganho_acumulado', {
        p_company_id: invoice.company_id,
        p_value: Number(amount),
      })
    } catch { /* non-critical */ }

    return NextResponse.json({ payment, message: 'Pagamento confirmado com sucesso' })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
