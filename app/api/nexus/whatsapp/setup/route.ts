// POST /api/nexus/whatsapp/setup — Auto-configure Z-API webhook + connected phone
// Called once after successful QR scan so NEXUS AI receives all incoming messages.
// Resolves the caller's own Z-API instance (business_identity), falling back
// to the platform-level instance only if the company hasn't configured one.

import { NextResponse }         from 'next/server'
import { getAuthContext }       from '@/lib/auth'
import { getCompanyZApiConfig } from '@/lib/business-identity'
import { zapiSetupWebhooks }    from '@/lib/zapi'
import { denyIfCannot }         from '@/lib/plan-middleware'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

export async function POST() {
  const denied = await denyIfCannot('whatsapp')
  if (denied) return denied

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getCompanyZApiConfig(ctx.company.id)
  if (!config) return NextResponse.json({ error: 'Z-API not configured' }, { status: 503 })

  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const webhookUrl = `${siteUrl}/api/nexus/whatsapp/webhook`

  const results = await zapiSetupWebhooks(config, webhookUrl)

  for (const [i, r] of results.entries()) {
    if (r.status === 'rejected') {
      console.error(`[wa/setup] call ${i} failed:`, String(r.reason))
    }
  }

  return NextResponse.json({ ok: true, webhook_url: webhookUrl })
}
