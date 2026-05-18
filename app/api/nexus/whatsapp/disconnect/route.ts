// GET /api/nexus/whatsapp/disconnect — Disconnect Z-API instance
// Z-API disconnect uses GET method (POST/DELETE return 405)

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 10

export async function GET() {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token      = process.env.ZAPI_TOKEN
  const client     = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) {
    return NextResponse.json({ error: 'not_configured' }, { status: 404 })
  }

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/disconnect`,
      {
        headers: { 'Client-Token': client ?? '' },
        signal:  AbortSignal.timeout(8000),
      },
    )

    const data = await res.json() as { value?: boolean }
    return NextResponse.json({ ok: data.value === true })
  } catch {
    return NextResponse.json({ error: 'timeout' }, { status: 504 })
  }
}
