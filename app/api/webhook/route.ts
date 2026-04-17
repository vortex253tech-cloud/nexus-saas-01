// ─── WhatsApp Webhook — Meta Cloud API ──────────────────────────
// GET  → verificação do endpoint pela Meta
// POST → recebimento de eventos (mensagens, status, etc.)

import { NextRequest, NextResponse } from 'next/server'

// ─── Types ─────────────────────────────────────────────────────

interface WhatsAppMessage {
  from: string          // phone number (E.164, sem +)
  id: string            // message ID
  timestamp: string
  type: 'text' | 'image' | 'audio' | 'document' | 'interactive' | 'button'
  text?: { body: string }
}

interface WhatsAppStatus {
  id: string            // message ID (do enviado)
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string }>
}

interface WebhookEntry {
  id: string            // WhatsApp Business Account ID
  changes: Array<{
    value: {
      messaging_product: 'whatsapp'
      metadata: { display_phone_number: string; phone_number_id: string }
      contacts?: Array<{ profile: { name: string }; wa_id: string }>
      messages?: WhatsAppMessage[]
      statuses?: WhatsAppStatus[]
    }
    field: 'messages'
  }>
}

interface WebhookPayload {
  object: 'whatsapp_business_account'
  entry: WebhookEntry[]
}

// ─── GET — Meta verification challenge ─────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (!verifyToken) {
    console.error('[Webhook] WHATSAPP_VERIFY_TOKEN not set')
    return new NextResponse('Server misconfigured', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Webhook] Meta verification passed ✓')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[Webhook] Verification failed — token mismatch or wrong mode')
  return new NextResponse('Forbidden', { status: 403 })
}

// ─── POST — Incoming events ─────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: WebhookPayload

  try {
    body = await req.json() as WebhookPayload
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Meta expects 200 quickly — process async, respond first
  processWebhookAsync(body).catch(err =>
    console.error('[Webhook] Processing error:', err)
  )

  return new NextResponse('OK', { status: 200 })
}

// ─── Async processor ───────────────────────────────────────────

async function processWebhookAsync(payload: WebhookPayload) {
  if (payload.object !== 'whatsapp_business_account') return

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue

      const { value } = change
      const phoneNumberId = value.metadata.phone_number_id

      // ── Incoming messages ──────────────────────────────────
      if (value.messages) {
        for (const msg of value.messages) {
          await handleIncomingMessage(msg, phoneNumberId, value.contacts)
        }
      }

      // ── Status updates (sent/delivered/read/failed) ────────
      if (value.statuses) {
        for (const status of value.statuses) {
          handleStatusUpdate(status)
        }
      }
    }
  }
}

// ─── Message handler (extend here to reply) ────────────────────

async function handleIncomingMessage(
  msg: WhatsAppMessage,
  phoneNumberId: string,
  contacts?: Array<{ profile: { name: string }; wa_id: string }>
) {
  const senderName = contacts?.find(c => c.wa_id === msg.from)?.profile.name ?? 'Desconhecido'
  const text = msg.type === 'text' ? msg.text?.body ?? '' : `[${msg.type}]`

  console.log('[Webhook] Mensagem recebida:', {
    de: msg.from,
    nome: senderName,
    tipo: msg.type,
    texto: text,
    id: msg.id,
    phoneNumberId,
  })

  // ── TODO: adicionar lógica de resposta aqui ────────────────
  // Exemplo para responder:
  //
  // await sendWhatsAppReply({
  //   phoneNumberId,
  //   to: msg.from,
  //   message: `Olá ${senderName}! Recebi sua mensagem: "${text}"`,
  // })
}

// ─── Status update handler ─────────────────────────────────────

function handleStatusUpdate(status: WhatsAppStatus) {
  if (status.status === 'failed') {
    console.error('[Webhook] Mensagem falhou:', {
      id: status.id,
      para: status.recipient_id,
      erros: status.errors,
    })
    return
  }

  console.log('[Webhook] Status atualizado:', {
    id: status.id,
    status: status.status,
    para: status.recipient_id,
  })
}

// ─── Helper: send reply (descomente quando quiser usar) ────────
//
// async function sendWhatsAppReply(params: {
//   phoneNumberId: string
//   to: string
//   message: string
// }) {
//   const token = process.env.WHATSAPP_TOKEN
//   if (!token) return
//
//   await fetch(`https://graph.facebook.com/v19.0/${params.phoneNumberId}/messages`, {
//     method: 'POST',
//     headers: {
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({
//       messaging_product: 'whatsapp',
//       to: params.to,
//       type: 'text',
//       text: { body: params.message },
//     }),
//   })
// }
