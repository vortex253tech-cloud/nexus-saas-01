// Stripe payment helper — singleton client + link generation.
// Falls back to a manual-pay URL when STRIPE_SECRET_KEY is not set.

import Stripe from 'stripe'

let _stripe: Stripe | null = null

function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' })
  }
  return _stripe
}

export interface PaymentLinkInput {
  invoiceId:   string
  companyId:   string
  amount:      number   // in BRL cents or smallest unit
  description: string
  customerEmail?: string
  currency?:   string  // default 'brl'
}

export interface PaymentLinkResult {
  url:        string
  externalId: string | null  // Stripe session id or null for manual
  provider:   'stripe' | 'manual'
}

export async function generatePaymentLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
  const stripe = getStripe()

  if (!stripe) {
    // No Stripe key — return a hosted manual-pay URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    return {
      url:        `${baseUrl}/pay/${input.invoiceId}`,
      externalId: null,
      provider:   'manual',
    }
  }

  const currency = input.currency ?? 'brl'

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: Math.round(input.amount * 100), // convert R$ to centavos
          product_data: { name: input.description || `Fatura ${input.invoiceId.slice(0, 8)}` },
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id:  input.invoiceId,
      company_id:  input.companyId,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/pay/success?invoice_id=${input.invoiceId}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/pay/cancel?invoice_id=${input.invoiceId}`,
  }

  if (input.customerEmail) {
    sessionParams.customer_email = input.customerEmail
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  return {
    url:        session.url ?? '',
    externalId: session.id,
    provider:   'stripe',
  }
}

export { getStripe }
