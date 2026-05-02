// POST /api/onboarding/demo
// Idempotently creates demo data for the onboarding simulation:
//   • customer "Cliente Teste" in the customers table (invoice contact)
//   • overdue invoice R$2.500
//   • payment link via generatePaymentLink()
//   • CRM client entry tagged with origem='demo'
// Returns { demoId, customerId, invoiceId, paymentLink, existing }

import { NextResponse }            from 'next/server'
import { getAuthContext }          from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { generatePaymentLink }     from '@/lib/payments/stripe'

export const dynamic = 'force-dynamic'

export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  // ── Idempotency: return existing demo if already created ──────────────────
  const { data: existingClient } = await db
    .from('clients')
    .select('id')
    .eq('company_id', ctx.companyId)
    .eq('origem', 'demo')
    .maybeSingle()

  if (existingClient) {
    const { data: invoice } = await db
      .from('invoices')
      .select('id, payment_link, customer_id')
      .eq('company_id', ctx.companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      demoId:      existingClient.id,
      customerId:  invoice?.customer_id ?? null,
      invoiceId:   invoice?.id          ?? null,
      paymentLink: invoice?.payment_link ?? null,
      existing:    true,
    })
  }

  // ── 1. Customer row (invoice contact) ────────────────────────────────────
  const { data: customer, error: custErr } = await db
    .from('customers')
    .insert({
      company_id: ctx.companyId,
      name:       'Cliente Teste',
      email:      'cliente.teste@exemplo.com.br',
      phone:      '+5511991234567',
      notes:      'Cliente demo criado pelo onboarding do NEXUS',
    })
    .select('id')
    .single()

  if (custErr || !customer) {
    console.error('[onboarding/demo] customer insert failed', custErr)
    return NextResponse.json({ error: 'Falha ao criar cliente demo' }, { status: 500 })
  }

  // ── 2. Overdue invoice ────────────────────────────────────────────────────
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() - 15)          // 15 days overdue

  const { data: invoice, error: invErr } = await db
    .from('invoices')
    .insert({
      company_id:  ctx.companyId,
      customer_id: customer.id,
      amount:      2500,
      currency:    'BRL',
      status:      'overdue',
      due_date:    dueDate.toISOString().split('T')[0],
      description: 'Consultoria mensal — Demo NEXUS',
    })
    .select('id')
    .single()

  if (invErr || !invoice) {
    console.error('[onboarding/demo] invoice insert failed', invErr)
    return NextResponse.json({ error: 'Falha ao criar fatura demo' }, { status: 500 })
  }

  // ── 3. Payment link ───────────────────────────────────────────────────────
  const linkResult = await generatePaymentLink({
    invoiceId:     invoice.id,
    companyId:     ctx.companyId,
    amount:        250000,                           // centavos
    description:   'Consultoria mensal — Cliente Teste',
    customerEmail: 'cliente.teste@exemplo.com.br',
  })

  await db
    .from('invoices')
    .update({ payment_link: linkResult.url })
    .eq('id', invoice.id)

  // ── 4. CRM client entry ───────────────────────────────────────────────────
  const { data: client, error: clientErr } = await db
    .from('clients')
    .insert({
      company_id:    ctx.companyId,
      name:          'Cliente Teste',
      email:         'cliente.teste@exemplo.com.br',
      phone:         '+5511991234567',
      status:        'overdue',
      total_revenue: 2500,
      origem:        'demo',
    })
    .select('id')
    .single()

  if (clientErr || !client) {
    console.error('[onboarding/demo] client insert failed', clientErr)
    return NextResponse.json({ error: 'Falha ao criar entrada CRM' }, { status: 500 })
  }

  return NextResponse.json({
    demoId:      client.id,
    customerId:  customer.id,
    invoiceId:   invoice.id,
    paymentLink: linkResult.url,
    existing:    false,
  })
}
