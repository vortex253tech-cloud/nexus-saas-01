// POST /api/sales/create-checkout — Generate Stripe payment link for a lead/offer

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import { generatePaymentLink } from '@/lib/payments/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)

    const leadId      = body ? getString(body, 'lead_id')      : null
    const title       = body ? getString(body, 'title')        : null
    const valueStr    = body ? getString(body, 'value_raw')    : null
    const description = body ? getString(body, 'description')  : null

    if (!leadId || !valueStr) {
      return NextResponse.json({ error: 'lead_id and value_raw required' }, { status: 400 })
    }

    const amount = parseFloat(valueStr)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getSupabaseServerClient()

    // ── Verify lead belongs to company ────────────────────────────────────────
    const { data: lead } = await db
      .from('leads')
      .select('id, name, email, status')
      .eq('id', leadId)
      .eq('company_id', auth.companyId)
      .maybeSingle()

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // ── Generate payment link ─────────────────────────────────────────────────
    const result = await generatePaymentLink({
      invoiceId:     lead.id,
      companyId:     auth.companyId,
      amount,
      description:   description ?? title ?? `Oferta — ${lead.name}`,
      customerEmail: lead.email ?? undefined,
    })

    // ── Save action in DB ─────────────────────────────────────────────────────
    await db.from('sales_actions').insert({
      lead_id:    lead.id,
      company_id: auth.companyId,
      type:       'payment',
      status:     'sent',
      payload: {
        payment_url:  result.url,
        external_id:  result.externalId,
        provider:     result.provider,
        amount,
        title:        title ?? 'Oferta',
      },
      executed_at: new Date().toISOString(),
    })

    // ── Update lead status to proposal ────────────────────────────────────────
    await db
      .from('leads')
      .update({ status: 'proposal' })
      .eq('id', lead.id)
      .eq('status', 'new')  // only bump if still new (don't regress)

    return NextResponse.json({
      url:         result.url,
      provider:    result.provider,
      external_id: result.externalId,
      lead_name:   lead.name,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sales/create-checkout] ERROR:', msg)
    return NextResponse.json({ error: 'Erro ao gerar link de pagamento.' }, { status: 500 })
  }
}
