// POST /api/invoices/payment-link
// Generates a Stripe Checkout Session (or manual URL) for an invoice,
// stores the link in the DB, and returns it.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, getNumber, readJsonObject } from '@/lib/unknown'
import { generatePaymentLink } from '@/lib/payments/stripe'

export const dynamic = 'force-dynamic'

type InvoiceRow = {
  id:          string
  company_id:  string
  amount:      number
  description: string | null
  status:      string
  payment_link: string | null
  customers:   { email: string | null; name: string }[] | null
}

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const invoice_id = getString(body, 'invoice_id')
  const company_id = getString(body, 'company_id')

  // Optional overrides
  const amount_override  = getNumber(body, 'amount')
  const desc_override    = getString(body, 'description')

  if (!invoice_id || !company_id) {
    return NextResponse.json({ error: 'invoice_id and company_id required' }, { status: 400 })
  }

  const db = getSupabaseServerClient()

  // Fetch invoice + customer email
  const { data: invoice, error: fetchErr } = await db
    .from('invoices')
    .select('id, company_id, amount, description, status, payment_link, customers(name, email)')
    .eq('id', invoice_id)
    .eq('company_id', company_id)
    .returns<InvoiceRow[]>()
    .single()

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (invoice.status === 'paid') {
    return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 })
  }

  // Return cached link if it already exists
  if (invoice.payment_link && !getString(body, 'force_regenerate')) {
    return NextResponse.json({ payment_link: invoice.payment_link, cached: true })
  }

  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : null

  try {
    const result = await generatePaymentLink({
      invoiceId:     invoice.id,
      companyId:     invoice.company_id,
      amount:        amount_override ?? Number(invoice.amount),
      description:   desc_override ?? invoice.description ?? `Fatura #${invoice.id.slice(0, 8)}`,
      customerEmail: customer?.email ?? undefined,
    })

    // Persist to invoice row
    await db
      .from('invoices')
      .update({ payment_link: result.url })
      .eq('id', invoice_id)

    return NextResponse.json({
      payment_link: result.url,
      provider:     result.provider,
      external_id:  result.externalId,
      cached:       false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Payment provider error: ${msg}` }, { status: 502 })
  }
}
