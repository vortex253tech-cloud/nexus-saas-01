// POST /api/instagram/publish-story — generates AND immediately publishes
// an Instagram Story (9:16) for a given content angle. Manual trigger only
// — intentionally NOT registered in vercel.json crons, since Stories are
// time-sensitive and shouldn't be posted on a fixed automatic schedule the
// way the daily feed post is.

import { NextRequest, NextResponse } from 'next/server'
import { generateAndPublishStory } from '@/lib/creative-library'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const auth   = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const angleId = body.angleId as string | undefined
  if (!angleId) return NextResponse.json({ error: 'angleId é obrigatório' }, { status: 400 })

  try {
    const result = await generateAndPublishStory(angleId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
