// POST /api/webhook/stripe
// Receives Stripe webhook events and updates invoice/payment records.
//
// Required env vars:
//   STRIPE_SECRET_KEY        — Stripe secret
//   STRIPE_WEBHOOK_SECRET    — From Stripe dashboard → Webhooks → Signing secret

import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/payments/stripe'
import { getSupabaseServerClient } from '@/lib/supabase'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// Raw body is needed for signature verification
export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sig    = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const rawBody = await req.text()
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe/webhook] signature verification failed:', msg)
    return NextResponse.json({ error: `Webhook error: ${msg}` }, { status: 400 })
  }

  const db = getSupabaseServerClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session, db)
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        console.warn('[stripe/webhook] payment failed:', pi.id, pi.last_payment_error?.message)
        break
      }

      default:
        // Ignore unknown events
        break
    }
  } catch (err) {
    console.error('[stripe/webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof getSupabaseServerClient>

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  db: SupabaseClient,
) {
  if (session.payment_status !== 'paid') return

  const invoice_id = session.metadata?.invoice_id
  const company_id = session.metadata?.company_id

  if (!invoice_id || !company_id) {
    console.warn('[stripe/webhook] session missing metadata:', session.id)
    return
  }

  // Fetch invoice — include client_id for downstream client update
  const { data: invoice } = await db
    .from('invoices')
    .select('id, company_id, amount, status, client_id')
    .eq('id', invoice_id)
    .eq('company_id', company_id)
    .single()

  if (!invoice || invoice.status === 'paid') return

  const amountPaid = session.amount_total ? session.amount_total / 100 : Number(invoice.amount)
  const clientId   = (invoice as Record<string, unknown>).client_id as string | null

  // Record payment
  await db.from('payments').insert({
    invoice_id,
    company_id,
    amount:  amountPaid,
    method:  'stripe',
    notes:   `Stripe session ${session.id}`,
    paid_at: new Date().toISOString(),
  })

  // Mark invoice paid
  await db.from('invoices').update({ status: 'paid' }).eq('id', invoice_id)

  // ── Revenue engine post-payment actions ──────────────────────────────────────

  if (clientId) {
    // Mark client as paid → appears as recovered in dashboard
    await db.from('clients').update({
      status:     'paid',
      updated_at: new Date().toISOString(),
    }).eq('id', clientId)

    // Mark the collection log as paid (closes the collection funnel)
    await db.from('collection_logs')
      .update({ status: 'paid' })
      .eq('invoice_id', invoice_id)
      .eq('company_id', company_id)

    // Log revenue event for accurate recovery tracking
    try {
      await db.from('revenue_events').insert({
        company_id,
        client_id:  clientId,
        invoice_id,
        event_type: 'payment_received',
        amount:     amountPaid,
        source:     'stripe',
        metadata:   { stripe_session_id: session.id },
      })
    } catch {
      // Table may not exist yet (pre-migration) — non-critical
    }
  }

  // Increment company accumulated revenue counter
  try {
    await db.rpc('increment_ganho_acumulado', {
      p_company_id: company_id,
      p_value: amountPaid,
    })
  } catch {
    // non-critical RPC
  }

  console.log(`[stripe/webhook] invoice ${invoice_id} paid — amount ${amountPaid} — client ${clientId ?? 'n/a'}`)
}
