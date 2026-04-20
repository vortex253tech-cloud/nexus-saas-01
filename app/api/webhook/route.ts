import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from '@/lib/supabase'
import { replyWhatsApp, buildHelpMessage, buildStatusMessage } from '@/lib/whatsapp'

export const dynamic = "force-dynamic"

// ─── Types ──────────────────────────────────────────────────────

interface WAMessage {
  from: string
  id: string
  type: string
  text?: { body: string }
}

interface WAEntry {
  changes: Array<{
    field: string
    value: {
      messaging_product: string
      metadata: { phone_number_id: string }
      messages?: WAMessage[]
    }
  }>
}

// ─── GET — Meta webhook verification ────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get("hub.mode")
  const token     = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  console.log("[Webhook GET]", { mode, token, challenge })

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) {
    return new Response("Server error: verify token not configured", { status: 500 })
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("[Webhook] ✓ Verificação aprovada")
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
  }

  return new Response("Forbidden", { status: 403 })
}

// ─── POST — Receive & process messages ──────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { object?: string; entry?: WAEntry[] }
    console.log("📩 WhatsApp Webhook Event:", JSON.stringify(body, null, 2))

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: "ok" })
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue
        const { phone_number_id } = change.value.metadata
        for (const msg of change.value.messages ?? []) {
          if (msg.type !== 'text' || !msg.text?.body) continue
          await handleMessage({ phoneNumberId: phone_number_id, from: msg.from, text: msg.text.body.trim().toLowerCase() })
        }
      }
    }

    return NextResponse.json({ status: "ok" })
  } catch (err) {
    console.error("[Webhook POST] Erro:", err)
    return NextResponse.json({ status: "ok" })
  }
}

// ─── Message handler ─────────────────────────────────────────────

async function handleMessage(params: { phoneNumberId: string; from: string; text: string }) {
  const { phoneNumberId, from, text } = params
  const db = getSupabaseServerClient()

  const normalized = from.startsWith('55') ? `+${from}` : `+55${from}`
  const { data: company } = await db
    .from('companies')
    .select('id, name, phone')
    .or(`phone.eq.${normalized},phone.eq.${from}`)
    .maybeSingle()

  if (!company) {
    await replyWhatsApp({
      phoneNumberId, to: from,
      message: `Olá! Não encontrei sua empresa no NEXUS.\nAcesse o dashboard: ${process.env.NEXT_PUBLIC_APP_URL ?? ''}`,
    })
    return
  }

  if (text === 'status') {
    const { data: actions } = await db
      .from('actions')
      .select('titulo, impacto_estimado, prioridade')
      .eq('company_id', company.id)
      .eq('status', 'pending')
      .order('impacto_estimado', { ascending: false })
      .limit(5)
    await replyWhatsApp({ phoneNumberId, to: from, message: buildStatusMessage(actions ?? []) })
    return
  }

  if (text === 'ok' || text === 'sim') {
    const { data: action } = await db
      .from('actions')
      .select('id, titulo')
      .eq('company_id', company.id)
      .eq('status', 'pending')
      .order('impacto_estimado', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!action) {
      await replyWhatsApp({ phoneNumberId, to: from, message: `✅ Nenhuma ação pendente no momento.` })
      return
    }

    await replyWhatsApp({ phoneNumberId, to: from, message: `⚙️ Executando: *${action.titulo}*...\nAcompanhe no dashboard.` })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl) {
      fetch(`${appUrl}/api/actions/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: action.id }),
      }).catch(() => null)
    }
    return
  }

  await replyWhatsApp({ phoneNumberId, to: from, message: buildHelpMessage() })
}
