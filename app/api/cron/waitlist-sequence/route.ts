// GET|POST /api/cron/waitlist-sequence — Vercel cron: daily waitlist nurture sequence
// Vercel sends Authorization: Bearer <CRON_SECRET>
//
// Replaces 3 n8n schedule-triggered workflows (NEXUS-email-d2-bastidores,
// -d5-casestudy, -d9-urgencia) that were decommissioned along with the n8n
// instance — see docs/decisoes.md, item 9. Step 5 (access email) stays
// manual-only, matching the original n8n design (NEXUS-email-acesso-manual
// had a manual trigger, not a schedule).

import { NextRequest, NextResponse } from 'next/server'
import { runWaitlistSequenceStep } from '@/lib/waitlist-sequence'

export const dynamic = 'force-dynamic'

const STEPS: Array<{ step: 2 | 3 | 4; days_ago: number; name: string }> = [
  { step: 2, days_ago: 2, name: 'bastidores' },
  { step: 3, days_ago: 5, name: 'case-study' },
  { step: 4, days_ago: 9, name: 'urgencia' },
]

async function handler(req: NextRequest) {
  const auth   = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary: Record<string, unknown> = {}

  for (const { step, days_ago, name } of STEPS) {
    const result = await runWaitlistSequenceStep({ step, days_ago })
    summary[name] = result
    if ('error' in result) {
      console.error(`[waitlist-sequence] step ${step} (${name}) failed:`, result.error)
    } else if (result.sent || result.failed) {
      console.log(`[waitlist-sequence] step ${step} (${name}): sent=${result.sent} failed=${result.failed}`)
    }
  }

  return NextResponse.json({ ok: true, summary })
}

export const GET  = handler
export const POST = handler
