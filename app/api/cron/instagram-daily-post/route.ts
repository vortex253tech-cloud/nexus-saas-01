// GET|POST /api/cron/instagram-daily-post — Vercel cron: 1 organic post/day on @nexus.saas.ia
// Vercel sends Authorization: Bearer <CRON_SECRET>
//
// Also doubles as the manual entry point for the creative library (ad
// creatives, Stories) via ?action=. This is deliberate, not laziness: the
// Hobby plan caps the number of distinctly-configured (maxDuration)
// serverless functions per deployment at 12, and this project is already
// at that ceiling — adding new standalone routes for these actions broke
// deployment entirely ("No more than 12 Serverless Functions..."). Folding
// them into this existing function avoids consuming a new slot.

import { NextRequest, NextResponse } from 'next/server'
import { runDailyInstagramPost } from '@/lib/instagram-content-machine'
import { generateAdCreative, generateAndPublishStory } from '@/lib/creative-library'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function handler(req: NextRequest) {
  const auth   = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const action = req.nextUrl.searchParams.get('action')

  // ── Creative library: on-demand ad creative or Story, not auto-scheduled ──
  if (action === 'generate-ad' || action === 'publish-story') {
    const angleId = req.nextUrl.searchParams.get('angleId') ?? undefined
    if (!angleId) return NextResponse.json({ error: 'angleId é obrigatório' }, { status: 400 })

    try {
      if (action === 'generate-ad') {
        const ctaLabel = req.nextUrl.searchParams.get('cta') ?? undefined
        const creative = await generateAdCreative(angleId, ctaLabel)
        return NextResponse.json({ ok: true, creative })
      }
      const result = await generateAndPublishStory(angleId)
      return NextResponse.json({ ok: true, ...result })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
  }

  // ── Default: daily organic feed/carousel post ──────────────────────────
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
