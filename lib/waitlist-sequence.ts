// ─── Waitlist nurture sequence ──────────────────────────────────────────────
// Server-side only. Sends one step of the waitlist nurture sequence to every
// matching signup. Used by both the HTTP route (app/api/waitlist/send-sequence)
// and the daily cron (app/api/cron/waitlist-sequence) that replaced the n8n
// workflows this used to depend on — see docs/decisoes.md, item 9.

import { createClient } from '@supabase/supabase-js'
import {
  sendBastidoresEmail,
  sendCaseStudyEmail,
  sendUrgencyEmail,
  sendAccessEmail,
} from '@/lib/email-waitlist'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface SequenceParams {
  step:             2 | 3 | 4 | 5
  days_ago?:        number
  email?:           string
  remaining_spots?: number
  login_url?:       string
}

export interface SequenceResult {
  sent:    number
  failed:  number
  results: Array<{ email: string; success: boolean; error?: string }>
}

export async function runWaitlistSequenceStep(params: SequenceParams): Promise<SequenceResult | { error: string }> {
  const { step, days_ago, email, remaining_spots, login_url } = params
  const supabase = db()

  let query = supabase
    .from('waitlist')
    .select('name, email, position, referral_code')

  if (email) {
    query = query.eq('email', email.toLowerCase()) as typeof query
  } else if (days_ago != null) {
    const target = new Date()
    target.setUTCDate(target.getUTCDate() - days_ago)
    const dateStr = target.toISOString().slice(0, 10)
    query = query
      .gte('created_at', `${dateStr}T00:00:00Z`)
      .lt('created_at',  `${dateStr}T23:59:59Z`) as typeof query
  }

  const { data: users, error } = await query

  if (error) {
    console.error('[waitlist-sequence] query error:', error)
    return { error: `Database error: ${error.message}` }
  }

  if (!users?.length) {
    return { sent: 0, failed: 0, results: [] }
  }

  const results: SequenceResult['results'] = []

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

  return {
    sent:   results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  }
}
