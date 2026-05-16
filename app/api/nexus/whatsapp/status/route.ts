// GET /api/nexus/whatsapp/status — Z-API connection check
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token      = process.env.ZAPI_TOKEN
  const client     = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) {
    return NextResponse.json({ connected: false, status: 'not_configured' })
  }

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/status`,
      { headers: { 'Client-Token': client ?? '' }, signal: AbortSignal.timeout(6000) },
    )

    if (!res.ok) return NextResponse.json({ connected: false, status: 'error' })

    const data = await res.json()
    const connected = data?.connected === true || data?.status === 'Connected'

    return NextResponse.json({ connected, status: connected ? 'connected' : 'disconnected', phone: data?.phone ?? null })
  } catch {
    return NextResponse.json({ connected: false, status: 'timeout' })
  }
}
