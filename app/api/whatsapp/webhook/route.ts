// POST /api/whatsapp/webhook
// Receives Z-API webhook events and routes them through the NEXUS AI engine.
// Returns 200 immediately — processing is async fire-and-forget.

import { NextRequest, NextResponse } from 'next/server'
import { processWhatsAppMessage, ZApiWebhookPayload } from '@/lib/whatsapp-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60  // Vercel function max (seconds)

// ── Optional webhook secret validation ───────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET
  if (!secret) return true  // no secret configured = accept all (fine for Z-API)

  const token =
    req.headers.get('x-webhook-secret') ??
    req.nextUrl.searchParams.get('token')
  return token === secret
}

// ── GET: Webhook verification (Z-API may ping this) ──────────────
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ status: 'NEXUS WhatsApp Webhook active' })
}

// ── POST: Receive Z-API message event ────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Auth
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let rawPayload: ZApiWebhookPayload
  try {
    rawPayload = await req.json() as ZApiWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 3. Respond immediately (Z-API requires fast ack)
  // Fire-and-forget the actual processing
  const companyId = process.env.NEXUS_PLATFORM_COMPANY_ID
  processWhatsAppMessage(rawPayload, companyId ?? undefined)
    .then(result => {
      if (!result.ok && !result.skipped) {
        console.error('[WA Webhook] Processing error:', result.error, '| phone:', result.phone)
      } else if (result.skipped) {
        console.log('[WA Webhook] Skipped:', result.skipped)
      } else {
        console.log('[WA Webhook] Replied to:', result.phone)
      }
    })
    .catch(err => {
      console.error('[WA Webhook] Unhandled error:', err)
    })

  return NextResponse.json({ received: true }, { status: 200 })
}
