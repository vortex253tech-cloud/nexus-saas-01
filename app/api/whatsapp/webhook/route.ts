// POST /api/whatsapp/webhook
// Receives Z-API webhook events → NEXUS AI Engine (OpenAI) → Z-API send.
// Returns 200 immediately — processing is async fire-and-forget.

import { NextRequest, NextResponse } from 'next/server'
import { processWhatsAppMessage, ZApiWebhookPayload } from '@/lib/whatsapp-engine'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET
  if (!secret) return true
  const token =
    req.headers.get('x-webhook-secret') ??
    req.nextUrl.searchParams.get('token')
  return token === secret
}

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ status: 'NEXUS WhatsApp Webhook active' })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let rawPayload: ZApiWebhookPayload
  try {
    rawPayload = await req.json() as ZApiWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const companyId = process.env.NEXUS_PLATFORM_COMPANY_ID

  // Fire-and-forget — Z-API needs fast ack
  processWhatsAppMessage(rawPayload, companyId ?? undefined)
    .then(result => {
      if (result.skipped) {
        console.log('[WA Webhook] Skipped:', result.skipped)
      } else if (!result.ok) {
        console.error('[WA Webhook] Error:', result.error, '| phone:', result.phone)
      } else {
        console.log('[WA Webhook] Done | phone:', result.phone, '| reply:', result.reply?.slice(0, 60))
      }
    })
    .catch(err => {
      console.error('[WA Webhook] Fatal:', err)
    })

  return NextResponse.json({ received: true }, { status: 200 })
}
