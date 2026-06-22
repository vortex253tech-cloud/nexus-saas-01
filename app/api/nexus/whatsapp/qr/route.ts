// GET /api/nexus/whatsapp/qr — Proxy Z-API QR code as real PNG
// Resolves the caller's own Z-API instance (business_identity), falling back
// to the platform-level instance only if the company hasn't configured one.

import { NextResponse }        from 'next/server'
import { getAuthContext }      from '@/lib/auth'
import { getCompanyZApiConfig } from '@/lib/business-identity'
import { zapiGetQrCode }       from '@/lib/zapi'
import { denyIfCannot }        from '@/lib/plan-middleware'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

export async function GET() {
  const denied = await denyIfCannot('whatsapp')
  if (denied) return denied

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getCompanyZApiConfig(ctx.company.id)
  if (!config) return NextResponse.json({ error: 'not_configured' }, { status: 404 })

  const result = await zapiGetQrCode(config)

  switch (result.status) {
    case 'already_connected':
      return NextResponse.json({ error: 'already_connected' }, { status: 409 })
    case 'unavailable':
      return NextResponse.json({ error: 'qr_unavailable' }, { status: 503 })
    case 'error':
      return NextResponse.json({ error: result.error ?? 'qr_failed' }, { status: 502 })
    case 'qr':
      if (!result.pngBuffer) return NextResponse.json({ error: 'qr_failed' }, { status: 502 })
      return new NextResponse(new Uint8Array(result.pngBuffer), {
        headers: {
          'Content-Type':  'image/png',
          'Cache-Control': 'no-store',
        },
      })
  }
}
