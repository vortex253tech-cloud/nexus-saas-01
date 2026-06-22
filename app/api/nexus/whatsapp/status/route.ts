// GET /api/nexus/whatsapp/status — Z-API connection check for the logged-in company
// Resolves the caller's own Z-API instance (business_identity), falling back
// to the platform-level instance only if the company hasn't configured one.

import { NextResponse }         from 'next/server'
import { getAuthContext }       from '@/lib/auth'
import { getCompanyZApiConfig } from '@/lib/business-identity'
import { zapiGetStatus }        from '@/lib/zapi'
import { denyIfCannot }         from '@/lib/plan-middleware'

export const dynamic    = 'force-dynamic'
export const maxDuration = 10

export async function GET() {
  const denied = await denyIfCannot('whatsapp')
  if (denied) return denied

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getCompanyZApiConfig(ctx.company.id)
  if (!config) return NextResponse.json({ connected: false, status: 'not_configured' })

  const result = await zapiGetStatus(config)
  if (result.error) return NextResponse.json({ connected: false, status: 'timeout' })

  return NextResponse.json({
    connected: result.connected,
    status:    result.connected ? 'connected' : 'disconnected',
    phone:     result.phone ?? null,
  })
}
