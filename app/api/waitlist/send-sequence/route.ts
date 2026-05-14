// POST /api/waitlist/send-sequence
// Dispatches a specific email from the waitlist nurturing sequence.
// Protected by CRON_SECRET. Called by n8n on schedule.
//
// Body:
//   step         : 2 | 3 | 4 | 5
//   days_ago     : number  — filter users who signed up N days ago (optional)
//   email        : string  — send to one user only (optional)
//   remaining_spots: number — for step 4 urgency email (default 23)
//   login_url    : string  — for step 5 access email

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  sendBastidoresEmail,
  sendCaseStudyEmail,
  sendUrgencyEmail,
  sendAccessEmail,
} from '@/lib/email-waitlist'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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

  // Build query
  let query = supabase
    .from('waitlist')
    .select('name, email, position, referral_code')

  if (email) {
    query = query.eq('email', email.toLowerCase()) as typeof query
  } else if (days_ago != null) {
    // Filter users who signed up exactly N days ago (UTC date match)
    const target = new Date()
    target.setUTCDate(target.getUTCDate() - days_ago)
    const dateStr = target.toISOString().slice(0, 10) // YYYY-MM-DD
    query = query
      .gte('created_at', `${dateStr}T00:00:00Z`)
      .lt('created_at',  `${dateStr}T23:59:59Z`) as typeof query
  }

  const { data: users, error } = await query

  if (error) {
    console.error('[send-sequence] query error:', error)
    return NextResponse.json({ error: 'Database error', detail: error.message }, { status: 500 })
  }

  if (!users?.length) {
    return NextResponse.json({ sent: 0, failed: 0, message: 'No users found for this criteria' })
  }

  const results: Array<{ email: string; success: boolean; error?: string }> = []

  for (const user of users) {
    try {
      let result: { success: boolean; error?: string }

      if (step === 2) {
        result = await sendBastidoresEmail({
          name:          user.name,
          email:         user.email,
          position:      user.position ?? 999,
          referral_code: user.referral_code ?? '',
        })
      } else if (step === 3) {
        result = await sendCaseStudyEmail({
          name:          user.name,
          email:         user.email,
          referral_code: user.referral_code ?? '',
        })
      } else if (step === 4) {
        result = await sendUrgencyEmail({
          name:            user.name,
          email:           user.email,
          position:        user.position ?? 999,
          referral_code:   user.referral_code ?? '',
          remaining_spots: remaining_spots ?? 23,
        })
      } else {
        result = await sendAccessEmail({
          name:      user.name,
          email:     user.email,
          login_url: login_url ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/login`,
        })
      }

      results.push({ email: user.email, success: result.success, error: result.error })
    } catch (err) {
      results.push({ email: user.email, success: false, error: String(err) })
    }
  }

  return NextResponse.json({
    sent:    results.filter(r => r.success).length,
    failed:  results.filter(r => !r.success).length,
    results,
  })
}
