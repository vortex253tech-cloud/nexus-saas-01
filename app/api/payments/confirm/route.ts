import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getNumber, getString, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

type InvoiceCustomer = {
  name: string
}

type InvoiceForPayment = {
  id: string
  company_id: string
  amount: number | string
  status: string
  customers: InvoiceCustomer[] | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    const invoice_id = body ? getString(body, 'invoice_id') : undefined
    const amount = body ? getNumber(body, 'amount') : undefined
    const method = body ? getString(body, 'method') : undefined
    const notes = body ? getString(body, 'notes') : undefined
    const paid_at = body ? getString(body, 'paid_at') : undefined

    if (!invoice_id || !amount) {
      return NextResponse.json({ error: 'invoice_id e amount sao obrigatorios' }, { status: 400 })
    }

    const db = getSupabaseServerClient()

    const { data: invoice, error: fetchErr } = await db
      .from('invoices')
      .select('id, company_id, amount, status, customers(name)')
      .eq('id', invoice_id)
      .returns<InvoiceForPayment[]>()
      .single()

    if (fetchErr || !invoice) {
      return NextResponse.json({ error: 'Fatura nao encontrada' }, { status: 404 })
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Fatura ja foi paga' }, { status: 400 })
    }

    const customerName = Array.isArray(invoice.customers) ? invoice.customers[0]?.name : null
    console.log('[payments/confirm] confirming invoice payment', { invoice_id, customerName })

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

    await db.from('invoices').update({ status: 'paid' }).eq('id', invoice_id)

    try {
      await db.rpc('increment_ganho_acumulado', {
        p_company_id: invoice.company_id,
        p_value: Number(amount),
      })
    } catch {
      // non-critical
    }

    return NextResponse.json({ payment, message: 'Pagamento confirmado com sucesso' })
  } catch (err) {
    console.error('[payments/confirm]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
