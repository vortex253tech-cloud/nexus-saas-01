import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getNumber, getString, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

type InvoiceCustomer = {
  name: string
  email: string | null
  phone: string | null
}

type CreatedInvoiceRow = {
  id: string
  company_id: string
  customer_id: string
  amount: number | string
  description: string | null
  due_date: string
  status: string
  payment_link: string | null
  customers: InvoiceCustomer[] | null
}

type CreatedInvoice = Omit<CreatedInvoiceRow, 'customers'> & {
  customer: InvoiceCustomer | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    const company_id = body ? getString(body, 'company_id') : undefined
    const customer_id = body ? getString(body, 'customer_id') : undefined
    const amount = body ? getNumber(body, 'amount') : undefined
    const description = body ? getString(body, 'description') : undefined
    const due_date = body ? getString(body, 'due_date') : undefined
    const payment_link = body ? getString(body, 'payment_link') : undefined

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
      .returns<CreatedInvoiceRow[]>()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ invoice: normalizeCreatedInvoice(data) }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

function normalizeCreatedInvoice(invoice: CreatedInvoiceRow): CreatedInvoice {
  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] ?? null : null
  const { customers: _customers, ...rest } = invoice
  return { ...rest, customer }
}
