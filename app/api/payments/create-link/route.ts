// POST /api/payments/create-link — Generate Stripe checkout for any lead/invoice
//
// Unified endpoint — wraps generatePaymentLink with lead tracking

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import { generateTenantPaymentLink } from '@/lib/payments/provider'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

    // Required fields
    const leadId   = getString(body, 'lead_id')
    const valueStr = getString(body, 'amount') ?? getString(body, 'value_raw')
    const title    = getString(body, 'title') ?? getString(body, 'description') ?? 'Proposta NEXUS'

    if (!leadId || !valueStr) {
      return NextResponse.json({ error: 'lead_id and amount required' }, { status: 400 })
    }

    const amount = parseFloat(valueStr)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount — must be a positive number in BRL' }, { status: 400 })
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getSupabaseServerClient()

    // ── Verify lead belongs to company ────────────────────────────────────────
    const { data: lead } = await db
      .from('leads')
      .select('id, name, email, source, status, score')
      .eq('id', leadId)
      .eq('company_id', auth.companyId)
      .maybeSingle()

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // ── Generate payment link using TENANT'S own provider ────────────────────
    const result = await generateTenantPaymentLink({
      invoiceId:     lead.id,
      companyId:     auth.companyId,
      amount,
      description:   title,
      customerEmail: (lead.email as string) ?? undefined,
    })

    const now = new Date().toISOString()

    // ── Persist + update lead in parallel ────────────────────────────────────
    await Promise.all([
      db.from('sales_actions').insert({
        lead_id:     lead.id,
        company_id:  auth.companyId,
        type:        'payment',
        status:      'sent',
        payload:     {
          payment_url: result.url,
          external_id: result.externalId,
          provider:    result.provider,
          amount,
          title,
        },
        executed_at: now,
      }),

      db.from('leads')
        .update({ status: 'proposal' })
        .eq('id', lead.id)
        .in('status', ['new', 'qualified', 'nurture']), // don't regress won/lost

      db.from('analytics_events').insert({
        company_id: auth.companyId,
        lead_id:    lead.id,
        event_type: 'payment_initiated',
        channel:    lead.source as string,
        value:      amount,
        metadata:   { provider: result.provider, external_id: result.externalId },
      }),
    ])

    return NextResponse.json({
      url:         result.url,
      provider:    result.provider,
      external_id: result.externalId,
      lead_id:     lead.id,
      lead_name:   lead.name,
      amount,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[payments/create-link] ERROR:', msg)
    return NextResponse.json({ error: 'Erro ao gerar link de pagamento.' }, { status: 500 })
  }
}
