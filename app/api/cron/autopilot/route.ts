// GET|POST /api/cron/autopilot — Vercel cron: daily auto-pilot (08:00 UTC = 05:00 BRT)
// Vercel sends Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { runAutoPilot } from '@/lib/autopilot'

export const dynamic = 'force-dynamic'

async function handler(req: NextRequest) {
  // Verify Vercel cron secret
  const auth   = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseServerClient()

  // Only run for companies that have autopilot enabled
  const { data: companies } = await db
    .from('companies')
    .select('id')
    .eq('autopilot_enabled', true)

  if (!companies || companies.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No companies with autopilot enabled' })
  }

  let totalExecuted = 0
  let totalFailed   = 0
  let totalInsights = 0

  for (const company of companies) {
    try {
      const result = await runAutoPilot(company.id as string, 'cron')
      totalExecuted += result.actionsExecuted
      totalFailed   += result.actionsFailed
      totalInsights += result.newInsights
    } catch (err) {
      console.error(`[cron/autopilot] company ${company.id} failed:`, err)
      totalFailed++
    }
  }

  console.log(
    `[cron/autopilot] ${new Date().toISOString()} — ` +
    `companies: ${companies.length}, executed: ${totalExecuted}, ` +
    `failed: ${totalFailed}, new_insights: ${totalInsights}`
  )

  return NextResponse.json({
    ok:          true,
    companies:   companies.length,
    executed:    totalExecuted,
    failed:      totalFailed,
    newInsights: totalInsights,
  })
}

export const GET  = handler
export const POST = handler
