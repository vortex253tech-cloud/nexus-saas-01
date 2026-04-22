import { NextRequest, NextResponse } from 'next/server'
import { generateWhatsAppReply } from '@/lib/ai'
import { replyWhatsApp } from '@/lib/whatsapp'

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

  const mode        = searchParams.get('hub.mode')
  const token       = searchParams.get('hub.verify_token')
  const challenge   = searchParams.get('hub.challenge')
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

// ─── POST — Receive and reply to WhatsApp messages ───────────────────────────

export async function POST(req: NextRequest) {
  // Always return 200 fast — Meta will retry if we don't respond quickly
  // Heavy processing happens after the response is queued (fire-and-forget)
  try {
    const body = (await req.json()) as WhatsAppPayload
    console.log('[whatsapp/webhook] event received:', JSON.stringify(body, null, 2))

    // Process each message entry asynchronously (no await — non-blocking)
    void processIncomingMessages(body)
  } catch (err) {
    console.error('[whatsapp/webhook] failed to parse event body', err)
  }

  return NextResponse.json({ status: 'ok' }, { status: 200 })
}

// ─── Message processing (fire-and-forget) ────────────────────────────────────

async function processIncomingMessages(body: WhatsAppPayload): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      const value           = change.value
      const phoneNumberId   = value.metadata.phone_number_id
      const messages        = value.messages ?? []
      const contacts        = value.contacts ?? []

      for (const message of messages) {
        // Skip non-text messages (images, audio, etc.)
        if (message.type !== 'text' || !message.text?.body?.trim()) {
          console.log('[whatsapp/webhook] skipping non-text message', {
            type: message.type,
            from: message.from,
          })
          continue
        }

        const userText   = message.text.body.trim()
        const contact    = contacts.find(c => c.wa_id === message.from)
        const senderName = contact?.profile.name

        console.log('[whatsapp/webhook] processing message', {
          from: message.from,
          name: senderName,
          text: userText,
          messageId: message.id,
        })

        await handleTextMessage({
          from: message.from,
          userText,
          senderName,
          phoneNumberId,
        })
      }
    }
  }
}

// ─── Handle a single text message ────────────────────────────────────────────

async function handleTextMessage(params: {
  from: string
  userText: string
  senderName?: string
  phoneNumberId: string
}): Promise<void> {
  const { from, userText, senderName, phoneNumberId } = params

  try {
    // 1. Generate AI reply
    const aiReply = await generateWhatsAppReply({ userMessage: userText, senderName })
    console.log('[whatsapp/webhook] AI reply generated', { to: from, reply: aiReply })

    // 2. Send reply via WhatsApp Cloud API
    const result = await replyWhatsApp({ phoneNumberId, to: from, message: aiReply })

    if (result.success) {
      console.log('[whatsapp/webhook] ✅ reply sent', { to: from, messageId: result.messageId, simulated: result.simulated })
    } else {
      console.error('[whatsapp/webhook] ❌ reply failed', { to: from, error: result.error })
    }

    // ── Future integration points ──────────────────────────────────────────
    // await saveConversationToSupabase({ from, senderName, userText, aiReply, phoneNumberId })
    // ──────────────────────────────────────────────────────────────────────
  } catch (err) {
    console.error('[whatsapp/webhook] error handling message', { from, err })
  }
}
