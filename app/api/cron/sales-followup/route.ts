// GET /api/cron/sales-followup — Multi-stage follow-up automation
//
// Runs every hour via Vercel cron
// Stages: 1h no-reply → 24h no-conversion → 3d final push

import { NextRequest, NextResponse } from 'next/server'
import { runFollowupEngine } from '@/lib/followup-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[cron/sales-followup] Starting follow-up engine...')

  try {
    const result = await runFollowupEngine()

    console.log(`[cron/sales-followup] Done: ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed`)

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/sales-followup] ERROR:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
