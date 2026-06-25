// POST /api/instagram/generate-ad — generates an ad creative (1080x1080
// image with a baked-in CTA bar + matching ad copy) for manual upload into
// Meta Ads Manager. Does NOT publish anywhere or touch the Marketing API —
// no ad spend or live campaign is affected by calling this.

import { NextRequest, NextResponse } from 'next/server'
import { generateAdCreative } from '@/lib/creative-library'

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
    const creative = await generateAdCreative(angleId, body.ctaLabel)
    return NextResponse.json({ ok: true, creative })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
