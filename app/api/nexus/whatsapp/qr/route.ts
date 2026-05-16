// GET /api/nexus/whatsapp/qr — Proxy Z-API QR code image
// Returns the QR code PNG so the client never exposes credentials

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

    const buf = await res.arrayBuffer()
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
