import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

type WhatsAppContact = {
  profile: { name: string }
  wa_id: string
}

type WhatsAppMessage = {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'image' | 'audio' | 'document' | 'video' | string
  text?: { body: string }
}

type WhatsAppValue = {
  messaging_product: string
  metadata: { display_phone_number: string; phone_number_id: string }
  contacts?: WhatsAppContact[]
  messages?: WhatsAppMessage[]
  statuses?: unknown[]
}

type WhatsAppChange = {
  value: WhatsAppValue
  field: string
}

type WhatsAppEntry = {
  id: string
  changes: WhatsAppChange[]
}

type WhatsAppPayload = {
  object: string
  entry: WhatsAppEntry[]
}

// ─── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    console.log('[whatsapp/webhook] ✅ verification succeeded')
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  console.warn('[whatsapp/webhook] ❌ verification rejected', {
    mode,
    tokenMatch: token === verifyToken,
    hasChallenge: Boolean(challenge),
    configured: Boolean(verifyToken),
  })

  return new Response('Forbidden', {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

// ─── POST — Receive WhatsApp events ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WhatsAppPayload

    console.log('[whatsapp/webhook] event received:', JSON.stringify(body, null, 2))

    // Extract incoming messages for future processing
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue

        const value = change.value
        const messages = value.messages ?? []
        const contacts = value.contacts ?? []

        for (const message of messages) {
          const contact = contacts.find(c => c.wa_id === message.from)
          const senderName = contact?.profile.name ?? 'Desconhecido'

          console.log('[whatsapp/webhook] message received', {
            from: message.from,
            name: senderName,
            type: message.type,
            text: message.text?.body ?? null,
            messageId: message.id,
            timestamp: message.timestamp,
          })

          // ── Future integration points ──────────────────────────────────
          // await saveMessageToSupabase({ message, senderName, phoneNumberId: value.metadata.phone_number_id })
          // const aiReply = await generateAIResponse(message.text?.body ?? '')
          // await sendWhatsAppReply({ to: message.from, text: aiReply })
          // ──────────────────────────────────────────────────────────────
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp/webhook] failed to process event', err)
  }

  // Always return 200 fast — Meta will retry if we don't respond quickly
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
