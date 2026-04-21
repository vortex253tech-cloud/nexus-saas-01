import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("[webhook] verification succeeded")
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  console.warn("[webhook] verification rejected", {
    mode,
    hasToken: Boolean(token),
    configured: Boolean(verifyToken),
  })

  return new Response("Forbidden", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "unknown"

  try {
    const rawBody = await req.text()
    const parsedBody = parseJsonBody(rawBody)

    console.log("[webhook] event received", {
      contentType,
      hasBody: rawBody.length > 0,
      payload: parsedBody,
    })
  } catch (error) {
    console.error("[webhook] request read failed", error)
  }

  return NextResponse.json({ status: "ok" })
}

function parseJsonBody(rawBody: string): unknown {
  if (!rawBody.trim()) return null

  try {
    return JSON.parse(rawBody)
  } catch {
    return { invalidJson: true, rawBody }
  }
}
