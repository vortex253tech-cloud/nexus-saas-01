// POST /api/waitlist/send-sequence
// Dispatches a specific email from the waitlist nurturing sequence.
// Protected by CRON_SECRET. Historically called by n8n on schedule — n8n was
// decommissioned (see docs/decisoes.md, item 9); the schedule is now native,
// via app/api/cron/waitlist-sequence. This route stays for manual/ad-hoc
// triggers (e.g. step 5, the access email, which was always manual).
//
// Body:
//   step         : 2 | 3 | 4 | 5
//   days_ago     : number  — filter users who signed up N days ago (optional)
//   email        : string  — send to one user only (optional)
//   remaining_spots: number — for step 4 urgency email (default 23)
//   login_url    : string  — for step 5 access email

import { NextResponse } from 'next/server'
import { runWaitlistSequenceStep } from '@/lib/waitlist-sequence'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    step?: number
    days_ago?: number
    email?: string
    remaining_spots?: number
    login_url?: string
  }

  const { step, days_ago, email, remaining_spots, login_url } = body

  if (!step || ![2, 3, 4, 5].includes(step)) {
    return NextResponse.json({ error: 'step must be 2, 3, 4, or 5' }, { status: 400 })
  }

  const result = await runWaitlistSequenceStep({ step: step as 2 | 3 | 4 | 5, days_ago, email, remaining_spots, login_url })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(result)
}
