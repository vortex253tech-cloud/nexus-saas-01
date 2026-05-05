// lib/payments/provider.ts
//
// Tenant-aware payment link generator.
//
// RULE: Payment links ALWAYS use the TENANT'S own credentials.
//       The platform (NEXUS) Stripe key is NEVER used here.
//
// Supported providers:
//   stripe       — tenant's own Stripe account
//   mercadopago  — tenant's Mercado Pago access token
//   pix          — Pix copia-e-cola payload (BR standard EMV)
//   manual       — hosted /pay/:invoiceId page (no payment integration)

import Stripe from 'stripe'
import { getSupabaseServerClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentProvider = 'stripe' | 'mercadopago' | 'pix' | 'manual'

export interface TenantPaymentConfig {
  provider:              PaymentProvider
  // Stripe
  stripe_secret_key?:    string | null
  // Mercado Pago
  mp_access_token?:      string | null
  // Pix
  pix_key?:              string | null
  pix_key_type?:         string | null
  pix_holder_name?:      string | null
  pix_city?:             string | null
}

export interface TenantPaymentInput {
  companyId:      string
  invoiceId:      string
  amount:         number   // BRL (e.g., 497.00)
  description:    string
  customerEmail?: string
  customerName?:  string
}

export interface TenantPaymentResult {
  url:        string
  externalId: string | null
  provider:   PaymentProvider
}

// ─── Load tenant config ───────────────────────────────────────────────────────

export async function getTenantPaymentConfig(
  companyId: string,
): Promise<TenantPaymentConfig | null> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('user_payment_config')
    .select('provider, stripe_secret_key, mp_access_token, mp_public_key, pix_key, pix_key_type, pix_holder_name, pix_city')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as TenantPaymentConfig | null
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateTenantPaymentLink(
  input: TenantPaymentInput,
): Promise<TenantPaymentResult> {
  const config = await getTenantPaymentConfig(input.companyId)

  if (!config) {
    return fallbackManualLink(input)
  }

  switch (config.provider) {
    case 'stripe':      return generateStripeLink(input, config)
    case 'mercadopago': return generateMercadoPagoLink(input, config)
    case 'pix':         return generatePixLink(input, config)
    default:            return fallbackManualLink(input)
  }
}

// ─── Stripe (tenant's own account) ───────────────────────────────────────────

async function generateStripeLink(
  input: TenantPaymentInput,
  config: TenantPaymentConfig,
): Promise<TenantPaymentResult> {
  const secretKey = config.stripe_secret_key
  if (!secretKey) return fallbackManualLink(input)

  const stripe = new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' })
  const base   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'brl',
          unit_amount: Math.round(input.amount * 100),
          product_data: { name: input.description },
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: input.invoiceId,
      company_id: input.companyId,
    },
    success_url: `${base}/pay/success?invoice_id=${input.invoiceId}`,
    cancel_url:  `${base}/pay/cancel?invoice_id=${input.invoiceId}`,
  }

  if (input.customerEmail) params.customer_email = input.customerEmail

  const session = await stripe.checkout.sessions.create(params)

  return {
    url:        session.url ?? fallbackManualLink(input).url,
    externalId: session.id,
    provider:   'stripe',
  }
}

// ─── Mercado Pago (tenant's own account) ─────────────────────────────────────

async function generateMercadoPagoLink(
  input: TenantPaymentInput,
  config: TenantPaymentConfig,
): Promise<TenantPaymentResult> {
  const token = config.mp_access_token
  if (!token) return fallbackManualLink(input)

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const body = {
    items: [
      {
        title:       input.description,
        quantity:    1,
        unit_price:  input.amount,
        currency_id: 'BRL',
      },
    ],
    payer:               input.customerEmail ? { email: input.customerEmail } : undefined,
    external_reference:  input.invoiceId,
    back_urls: {
      success: `${base}/pay/success?invoice_id=${input.invoiceId}`,
      failure: `${base}/pay/cancel?invoice_id=${input.invoiceId}`,
      pending: `${base}/pay/pending?invoice_id=${input.invoiceId}`,
    },
    auto_return: 'approved',
  }

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Mercado Pago error: ${res.status} — ${err}`)
  }

  const data = await res.json() as { id: string; init_point: string }

  return {
    url:        data.init_point,
    externalId: data.id,
    provider:   'mercadopago',
  }
}

// ─── Pix copia-e-cola (EMV payload) ──────────────────────────────────────────
//
// Generates a static Pix payload following BR EMV standard.
// The result URL points to a hosted page that displays the payload + QR code.

function generatePixPayload(
  pixKey:      string,
  holderName:  string,
  city:        string,
  amount:      number,
  txId:        string,
  description: string,
): string {
  const name = holderName.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 25)
  const cty  = city.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 15)
  const desc = description.slice(0, 72)
  const amtStr = amount.toFixed(2)

  function tlv(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0')
    return `${id}${len}${value}`
  }

  const merchantAccountInfo = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', pixKey) + (desc ? tlv('02', desc) : '')
  const payload = [
    tlv('00', '01'),                              // payload format indicator
    tlv('26', merchantAccountInfo),               // merchant account info
    tlv('52', '0000'),                            // merchant category code
    tlv('53', '986'),                             // transaction currency (BRL)
    tlv('54', amtStr),                            // transaction amount
    tlv('58', 'BR'),                              // country code
    tlv('59', name),                              // merchant name
    tlv('60', cty),                               // merchant city
    tlv('62', tlv('05', txId.slice(0, 25))),      // additional data (txid)
    '6304',                                       // CRC placeholder
  ].join('')

  // CRC16-CCITT
  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1
    }
    crc &= 0xFFFF
  }

  return payload + crc.toString(16).toUpperCase().padStart(4, '0')
}

async function generatePixLink(
  input: TenantPaymentInput,
  config: TenantPaymentConfig,
): Promise<TenantPaymentResult> {
  const { pix_key, pix_holder_name, pix_city } = config
  if (!pix_key || !pix_holder_name) return fallbackManualLink(input)

  const city    = pix_city ?? 'SAO PAULO'
  const payload = generatePixPayload(
    pix_key,
    pix_holder_name,
    city,
    input.amount,
    input.invoiceId.replace(/-/g, '').slice(0, 25),
    input.description,
  )

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url  = `${base}/pay/pix/${input.invoiceId}?payload=${encodeURIComponent(payload)}`

  return {
    url,
    externalId: payload,
    provider:   'pix',
  }
}

// ─── Manual fallback ──────────────────────────────────────────────────────────

function fallbackManualLink(input: TenantPaymentInput): TenantPaymentResult {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return {
    url:        `${base}/pay/${input.invoiceId}`,
    externalId: null,
    provider:   'manual',
  }
}
