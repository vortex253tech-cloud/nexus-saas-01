import { NextResponse }                from 'next/server'
import { zapiGetStatus, resolveZApiConfig } from '@/lib/zapi'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = resolveZApiConfig()

    if (!config) {
      return NextResponse.json({
        connected:  false,
        error:      'Z-API not configured',
        webhookUrl: null,
      })
    }

    const result = await zapiGetStatus(config)

    return NextResponse.json({
      connected:  result.connected,
      phone:      result.phone ?? null,
      error:      result.error ?? null,
      webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/nexus/whatsapp/webhook`,
      instanceId: config.instanceId,
    })
  } catch (err) {
    console.error('[WA status]', err)
    return NextResponse.json({
      connected:  false,
      error:      err instanceof Error ? err.message : 'Unknown error',
      webhookUrl: null,
    })
  }
}
