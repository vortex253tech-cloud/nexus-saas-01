import { NextRequest, NextResponse } from 'next/server'
import { generateWhatsAppReply } from '@/lib/ai'
import { replyWhatsApp } from '@/lib/whatsapp'
import { getSupabaseServerClient } from '@/lib/supabase'
import { captureLead, classifyTier } from '@/lib/lead-capture'
import { generateSalesResponse, type Lead, type BusinessContext } from '@/lib/sales-engine'

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
    // ── Resolve company from phone number ID ──────────────────────────────────
    const companyId = await resolveCompanyFromPhoneId(phoneNumberId)

    if (companyId) {
      // ── Sales Engine Path: capture lead + AI sales response ───────────────
      const { lead, isNew } = await captureLead({
        name:      senderName ?? `WhatsApp ${from}`,
        phone:     from,
        source:    'whatsapp',
        message:   userText,
        companyId,
      })

      const db = getSupabaseServerClient()

      // Load business context
      const [companyRes, clientsRes] = await Promise.all([
        db.from('companies').select('name, brand_name').eq('id', companyId).maybeSingle(),
        db.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      ])
      const ctx: BusinessContext = {
        company_name:    companyRes.data?.brand_name ?? companyRes.data?.name ?? 'NEXUS',
        average_ticket:  497,
        monthly_revenue: 0,
        total_clients:   clientsRes.count ?? 0,
      }

      // Get conversation history
      const { data: conv } = await db
        .from('sales_conversations')
        .select('id')
        .eq('lead_id', lead.id as string)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const salesLead: Lead = {
        id:         lead.id as string,
        company_id: companyId,
        name:       lead.name as string,
        phone:      lead.phone as string | null,
        email:      lead.email as string | null,
        source:     lead.source as Lead['source'],
        status:     lead.status as Lead['status'],
        score:      lead.score as number,
        notes:      null,
        metadata:   {},
        created_at: lead.created_at as string,
        updated_at: lead.updated_at as string,
      }

      const result = await generateSalesResponse(salesLead, [], userText, ctx)
      const aiReply = result.message

      // Persist conversation + messages
      if (conv?.id) {
        await db.from('sales_messages').insert([
          { conversation_id: conv.id, role: 'lead', content: userText },
          { conversation_id: conv.id, role: 'ai',   content: aiReply },
        ])
      }

      // Update lead
      await db.from('leads')
        .update({ score: result.new_score, status: result.new_status })
        .eq('id', lead.id as string)

      console.log('[whatsapp/webhook] sales reply', {
        to: from, tier: result.tier, score: result.new_score, isNew,
      })

      // Send via WhatsApp
      await replyWhatsApp({ phoneNumberId, to: from, message: aiReply })
      return
    }

    // ── Generic AI Path (no company configured) ───────────────────────────────
    const aiReply = await generateWhatsAppReply({ userMessage: userText, senderName })
    console.log('[whatsapp/webhook] generic reply generated', { to: from })

    const result = await replyWhatsApp({ phoneNumberId, to: from, message: aiReply })
    if (result.success) {
      console.log('[whatsapp/webhook] ✅ reply sent', { to: from, messageId: result.messageId })
    } else {
      console.error('[whatsapp/webhook] ❌ reply failed', { to: from, error: result.error })
    }
  } catch (err) {
    console.error('[whatsapp/webhook] error handling message', { from, err })
  }
}

// ─── Resolve company from WhatsApp phone number ID ───────────────────────────

async function resolveCompanyFromPhoneId(phoneNumberId: string): Promise<string | null> {
  if (!phoneNumberId) return null
  try {
    const db = getSupabaseServerClient()
    const { data } = await db
      .from('companies')
      .select('id')
      .eq('whatsapp_phone_id', phoneNumberId)
      .maybeSingle()
    return data?.id ?? null
  } catch {
    return null
  }
}
