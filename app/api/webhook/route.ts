import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (!verifyToken) {
    return new Response("Token não configurado", { status: 500 })
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("✅ Webhook verificado com sucesso")
    return new Response(challenge || "", { status: 200 })
  }

  return new Response("Forbidden", { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log("📩 Evento recebido:", JSON.stringify(body, null, 2))

    return NextResponse.json({ status: "ok" })
  } catch (err) {
    console.error("❌ Erro webhook:", err)
    return NextResponse.json({ status: "error" })
  }
}
