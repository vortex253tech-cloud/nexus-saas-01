// GET|POST /api/cron/instagram-daily-post — Vercel cron: 1 organic post/day on @nexus.saas.ia
// Vercel sends Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from 'next/server'
import { runDailyInstagramPost } from '@/lib/instagram-content-machine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handler(req: NextRequest) {
  const auth   = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forceAngleId = req.nextUrl.searchParams.get('angle') ?? undefined
  const result = await runDailyInstagramPost(forceAngleId)

  if (result.error) {
    console.error('[instagram-daily-post] failed:', result.error)
    return NextResponse.json({ ok: false, ...result }, { status: 500 })
  }

  console.log(`[instagram-daily-post] published angle=${result.angleId} media=${result.mediaId}`)
  return NextResponse.json({ ok: true, ...result })
}

export const GET  = handler
export const POST = handler
