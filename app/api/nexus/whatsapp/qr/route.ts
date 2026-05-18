// GET /api/nexus/whatsapp/qr — Proxy Z-API QR code as real PNG
// Z-API always returns JSON: {"value":"data:image/png;base64,..."} or {"connected":true}

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

export async function GET() {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token      = process.env.ZAPI_TOKEN
  const client     = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) {
    return NextResponse.json({ error: 'not_configured' }, { status: 404 })
  }

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code/image`,
      {
        headers: { 'Client-Token': client ?? '' },
        signal:  AbortSignal.timeout(10000),
      },
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'qr_failed' }, { status: 502 })
    }

    // Z-API always returns JSON regardless of Content-Type header
    const json = await res.json() as { value?: string; connected?: boolean }

    // Instance already connected — no QR needed
    if (json.connected === true) {
      return NextResponse.json({ error: 'already_connected' }, { status: 409 })
    }

    // No QR value present
    if (!json.value) {
      return NextResponse.json({ error: 'qr_unavailable' }, { status: 503 })
    }

    // value = "data:image/png;base64,<b64data>"
    const b64 = json.value.includes(',') ? json.value.split(',')[1] : json.value
    const buf = Buffer.from(b64, 'base64')

    return new NextResponse(buf, {
      headers: {
        'Content-Type':  'image/png',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'timeout' }, { status: 504 })
  }
}
