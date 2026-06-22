// GET /api/nexus/whatsapp/disconnect — Disconnect Z-API instance
// Resolves the caller's own Z-API instance (business_identity), falling back
// to the platform-level instance only if the company hasn't configured one.

import { NextResponse }         from 'next/server'
import { getAuthContext }       from '@/lib/auth'
import { getCompanyZApiConfig } from '@/lib/business-identity'
import { zapiDisconnect }       from '@/lib/zapi'
import { denyIfCannot }         from '@/lib/plan-middleware'

export const dynamic    = 'force-dynamic'
export const maxDuration = 10

export async function GET() {
  const denied = await denyIfCannot('whatsapp')
  if (denied) return denied

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getCompanyZApiConfig(ctx.company.id)
  if (!config) return NextResponse.json({ error: 'not_configured' }, { status: 404 })

  const result = await zapiDisconnect(config)
  if (result.error) return NextResponse.json({ error: 'timeout' }, { status: 504 })
  return NextResponse.json({ ok: result.ok })
}
